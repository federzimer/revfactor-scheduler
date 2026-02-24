import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { createCalendarEvent } from '@/lib/google-calendar';

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { date, startTime, endTime, userId, visitorName, visitorEmail, visitorCompany } = body;

  if (!date || !startTime || !endTime || !userId || !visitorName || !visitorEmail) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  const timezone = process.env.NEXT_PUBLIC_TIMEZONE || 'America/New_York';
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

  // Create Google Calendar event with Meet link
  const startDateTime = `${date}T${startTime}:00`;
  const endDateTime = `${date}T${endTime}:00`;

  let calendarEvent = null;
  try {
    calendarEvent = await createCalendarEvent(userId, {
      summary: `${companyName} Sales Call - ${visitorName}`,
      description: `Sales call with ${visitorName}${visitorCompany ? ` from ${visitorCompany}` : ''}\nEmail: ${visitorEmail}\n\nBooked via ${companyName} Scheduler`,
      startTime: startDateTime,
      endTime: endDateTime,
      attendeeEmail: visitorEmail,
      timezone,
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
      visitorCompany: visitorCompany || null,
      meetLink: calendarEvent?.meetLink || null,
      calendarEventId: calendarEvent?.id || null,
    },
  });

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
