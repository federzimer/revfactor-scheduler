import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { createCalendarEvent } from '@/lib/google-calendar';

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { date, startTime, endTime, userId, visitorName, visitorEmail, visitorPhone, visitorAirbnbLink, visitorNotes } = body;

  if (!date || !startTime || !endTime || !userId || !visitorName || !visitorEmail) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  const companyName = process.env.NEXT_PUBLIC_COMPANY_NAME || 'RevFactor';

  // Verify the user exists
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    return NextResponse.json({ error: 'Team member not found' }, { status: 404 });
  }

  // Check for double booking
  const existing = await prisma.booking.findFirst({
    where: { userId, date, startTime, status: 'confirmed' },
  });
  if (existing) {
    return NextResponse.json({ error: 'This slot is no longer available' }, { status: 409 });
  }

  // Build description with all visitor info
  const descriptionParts = [
    `Discovery call with ${visitorName}`,
    `Email: ${visitorEmail}`,
  ];
  if (visitorPhone) descriptionParts.push(`Phone: ${visitorPhone}`);
  if (visitorAirbnbLink) descriptionParts.push(`Airbnb Listing: ${visitorAirbnbLink}`);
  if (visitorNotes) descriptionParts.push(`\nNotes to prepare:\n${visitorNotes}`);
  descriptionParts.push(`\nBooked via ${companyName} Scheduler`);

  // Use the host's per-user timezone
  const hostTimezone = (user as any).timezone || 'America/New_York';

  // Create Google Calendar event with Meet link
  const startDateTime = `${date}T${startTime}:00`;
  const endDateTime = `${date}T${endTime}:00`;

  let calendarEvent = null;
  try {
    calendarEvent = await createCalendarEvent(userId, {
      summary: `${companyName} Discovery Call - ${visitorName}`,
      description: descriptionParts.join('\n'),
      startTime: startDateTime,
      endTime: endDateTime,
      attendeeEmail: visitorEmail,
      hostEmail: user.email || '',
      timezone: hostTimezone,
    });
  } catch (e) {
    console.error('Error creating calendar event:', e);
  }

  // Save booking in database
  const booking = await prisma.booking.create({
    data: {
      userId,
      date,
      startTime,
      endTime,
      visitorName,
      visitorEmail,
      visitorPhone: visitorPhone || null,
      visitorAirbnbLink: visitorAirbnbLink || null,
      visitorNotes: visitorNotes || null,
      meetLink: calendarEvent?.meetLink || null,
      calendarEventId: calendarEvent?.id || null,
    },
  });

  // Forward booking to the hub as a lead (fire-and-forget).
  const hubUrl = process.env.HUB_WEBHOOK_URL;
  const hubSecret = process.env.HUB_WEBHOOK_SECRET;
  if (hubUrl && hubSecret) {
    fetch(hubUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${hubSecret}`,
      },
      body: JSON.stringify({
        bookingId: booking.id,
        visitorName,
        visitorEmail,
        visitorPhone: visitorPhone || null,
        visitorAirbnbLink: visitorAirbnbLink || null,
        visitorNotes: visitorNotes || null,
        date,
        startTime,
        endTime,
        timezone: hostTimezone,
        hostName: user.name,
        hostEmail: user.email,
        meetLink: calendarEvent?.meetLink || null,
      }),
    }).catch((e) => {
      console.error('[hub webhook] forward failed:', e);
    });
  }

  // Forward booking to n8n for the follow-up "next steps" email (fire-and-forget).
  const followupUrl = process.env.BOOKING_FOLLOWUP_WEBHOOK_URL;
  if (followupUrl) {
    fetch(followupUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        bookingId: booking.id,
        visitorName,
        visitorEmail,
        date,
        startTime,
        endTime,
        timezone: hostTimezone,
        hostName: user.name,
        meetLink: calendarEvent?.meetLink || null,
      }),
    }).catch((e) => {
      console.error('[followup webhook] forward failed:', e);
    });
  }

  return NextResponse.json({
    booking: {
      id: booking.id,
      date: booking.date,
      startTime: booking.startTime,
      endTime: booking.endTime,
      meetLink: booking.meetLink,
      hostName: user.name,
    },
  });
}
