import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { createCalendarEvent } from '@/lib/google-calendar';

const WEBHOOK_TIMEOUT_MS = 5_000;

async function deliverWebhook(
  label: string,
  url: string,
  init: RequestInit,
): Promise<void> {
  try {
    const response = await fetch(url, {
      ...init,
      signal: AbortSignal.timeout(WEBHOOK_TIMEOUT_MS),
    });

    if (!response.ok) {
      console.error(`[${label}] forward failed with status ${response.status}`);
    }
  } catch (error) {
    console.error(`[${label}] forward failed:`, error);
  }
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { date, startTime, endTime, userId, visitorName, visitorEmail, visitorPhone, visitorAirbnbLink, visitorAddress, visitorHeardAbout, visitorReferralName, visitorNotes } = body;

  if (!date || !startTime || !endTime || !userId || !visitorName || !visitorEmail) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  // A lead must identify their property: either an Airbnb listing link or a physical address.
  if (!visitorAirbnbLink && !visitorAddress) {
    return NextResponse.json({ error: 'Please provide your Airbnb listing link or property address' }, { status: 400 });
  }
  if (!visitorHeardAbout) {
    return NextResponse.json({ error: 'Please tell us how you heard about us' }, { status: 400 });
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
  if (visitorAddress) descriptionParts.push(`Property Address: ${visitorAddress}`);
  if (visitorHeardAbout) {
    const heard = visitorHeardAbout === 'Referral' && visitorReferralName
      ? `Referral (${visitorReferralName})`
      : visitorHeardAbout;
    descriptionParts.push(`Heard about us via: ${heard}`);
  }
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

  // Fail loudly: a booking with no event/link is a broken booking — no Meet link and no
  // calendar invite for the lead. Rather than silently saving a phantom
  // "confirmed" booking that lands on nobody's calendar, abort so the visitor can pick
  // another time/host and the slot stays open. (This is the symptom that hid Ethan's
  // missing calendar scope: bookings "succeeded" but no event or link was ever created.)
  if (!calendarEvent || !calendarEvent.meetLink) {
    console.error(
      `Booking aborted — could not create calendar event/Meet link for host ${user.email} (${userId}). ` +
      `Likely the host has not granted Google Calendar access or their token was revoked.`,
    );
    return NextResponse.json(
      { error: "We couldn't finalize this booking. Please choose another time, or contact us if it keeps happening." },
      { status: 502 },
    );
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
      visitorAddress: visitorAddress || null,
      visitorHeardAbout: visitorHeardAbout || null,
      visitorReferralName: visitorReferralName || null,
      visitorNotes: visitorNotes || null,
      meetLink: calendarEvent?.meetLink || null,
      calendarEventId: calendarEvent?.id || null,
    },
  });

  // Keep the function alive until downstream systems accept the booking. Vercel can
  // terminate unawaited requests as soon as the response is returned.
  const webhookDeliveries: Promise<void>[] = [];

  // Forward booking to the hub as a lead.
  const hubUrl = process.env.HUB_WEBHOOK_URL;
  const hubSecret = process.env.HUB_WEBHOOK_SECRET;
  if (hubUrl && hubSecret) {
    webhookDeliveries.push(deliverWebhook('hub webhook', hubUrl, {
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
        visitorAddress: visitorAddress || null,
        visitorHeardAbout: visitorHeardAbout || null,
        visitorReferralName: visitorReferralName || null,
        visitorNotes: visitorNotes || null,
        date,
        startTime,
        endTime,
        timezone: hostTimezone,
        hostName: user.name,
        hostEmail: user.email,
        meetLink: calendarEvent?.meetLink || null,
      }),
    }));
  }

  // Send booking data to n8n so it can send the confirmation email and
  // schedule reminder emails (e.g. 24h + 1h before) to reduce no-shows. n8n owns the
  // scheduling and delivery; the app just hands over everything it needs. No-op if unset.
  const n8nUrl = process.env.N8N_BOOKING_WEBHOOK_URL;
  if (n8nUrl) {
    webhookDeliveries.push(deliverWebhook('n8n webhook', n8nUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event: 'booking.confirmed',
        bookingId: booking.id,
        leadName: visitorName,
        leadEmail: visitorEmail,
        leadPhone: visitorPhone || null,
        date,
        startTime,
        endTime,
        startDateTime, // local wall-clock start, pair with `timezone`
        timezone: hostTimezone,
        meetLink: calendarEvent?.meetLink || null,
        hostName: user.name,
        property: visitorAirbnbLink || visitorAddress || null,
        heardAbout: visitorHeardAbout || null,
        companyName,
      }),
    }));
  }

  await Promise.all(webhookDeliveries);

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
