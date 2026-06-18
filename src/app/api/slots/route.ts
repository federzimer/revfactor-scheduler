import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getBusyTimes } from '@/lib/google-calendar';
import { generateTimeSlots, isSlotBusy } from '@/lib/utils';

// GET /api/slots?date=2025-03-15&tz=America/Los_Angeles
export async function GET(req: NextRequest) {
  const date = req.nextUrl.searchParams.get('date');
  if (!date) {
    return NextResponse.json({ error: 'Date parameter required' }, { status: 400 });
  }

  // Visitor's timezone (detected by frontend, defaults to ET)
  const visitorTz = req.nextUrl.searchParams.get('tz') || 'America/New_York';

  // Optional: restrict to a single host (person-first booking flow). Omitted = all bookable hosts.
  const userId = req.nextUrl.searchParams.get('userId') || undefined;

  const duration = parseInt(process.env.NEXT_PUBLIC_BOOKING_DURATION || '15', 10);

  // Get the day of week for the requested date
  const dayOfWeek = new Date(date + 'T12:00:00').getDay();

  // Find all active team members who have availability for this day.
  // Only offer hosts who have actually granted Google Calendar access — without the
  // calendar scope we can't create the event / Meet link, and (because getBusyTimes
  // fails open) the host would otherwise appear *fully free* and silently swallow
  // bookings that never land on anyone's calendar.
  const adminUsers = await prisma.user.findMany({
    where: {
      active: true,
      bookable: true,
      ...(userId ? { id: userId } : {}),
      accounts: { some: { provider: 'google', scope: { contains: 'calendar' } } },
    },
    include: {
      availability: { where: { dayOfWeek } },
      dateOverrides: { where: { date } },
    },
  });

  // Get existing bookings for this date
  const existingBookings = await prisma.booking.findMany({
    where: { date, status: 'confirmed' },
  });

  // For each user, generate their available slots and convert to visitor's timezone
  // Key = display time in visitor TZ, value = list of available users with their host-tz times
  // NOTE: no `image` here on purpose. Avatars can be ~20KB data URLs and would repeat
  // for every slot a host appears in, bloating this response. The booking page resolves
  // avatars from /api/hosts (fetched once) keyed by user id.
  const slotMap: Record<string, {
    id: string;
    name: string;
    bio?: string;
    hometown?: string;
    basedIn?: string;
    strExperience?: string;
    hostStart: string;
    hostEnd: string;
    hostTimezone: string;
  }[]> = {};

  for (const user of adminUsers) {
    // Per-user timezone and settings
    const userTimezone = (user as any).timezone || 'America/New_York';
    const minBufferHours = (user as any).minBufferHours ?? 2;
    const maxDays = (user as any).maxAdvanceDays ?? 30;

    // Check maxAdvanceDays
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const requestedDate = new Date(date + 'T12:00:00');
    const daysFromNow = Math.ceil((requestedDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    if (daysFromNow > maxDays) continue;

    // Check for date-specific override
    const override = user.dateOverrides[0];

    let timeRanges: { startTime: string; endTime: string }[] = [];

    if (override) {
      if (override.isBlocked) continue;
      if (override.startTime && override.endTime) {
        timeRanges = [{ startTime: override.startTime, endTime: override.endTime }];
      } else {
        continue;
      }
    } else {
      if (user.availability.length === 0) continue;
      timeRanges = user.availability.map((a) => ({ startTime: a.startTime, endTime: a.endTime }));
    }

    // Combine slots from all time ranges (in host's timezone)
    const timeSlots = timeRanges.flatMap((range) =>
      generateTimeSlots(range.startTime, range.endTime, duration)
    );

    // Get Google Calendar busy times using per-user timezone
    let busyTimes: { start: string; end: string }[] = [];
    try {
      busyTimes = await getBusyTimes(user.id, date, userTimezone);
    } catch (e: any) {
      if (e?.message === 'NO_CALENDAR_ACCESS') {
        // Token missing/revoked — don't offer a host we can't book. Fail safe (skip)
        // rather than fail open (show them as fully free).
        console.warn(`Skipping host ${user.email}: no calendar access`);
        continue;
      }
      console.error(`Error getting busy times for ${user.email}:`, e);
    }

    // Buffer cutoff
    const now = new Date();
    const bufferCutoff = new Date(now.getTime() + minBufferHours * 60 * 60 * 1000);

    for (const slot of timeSlots) {
      // Buffer time check
      if (minBufferHours > 0) {
        const slotStartUTC = localToUTC(`${date}T${slot.start}:00`, userTimezone);
        if (slotStartUTC < bufferCutoff) continue;
      }

      // Google Calendar busy check
      const isBusy = isSlotBusy(slot.start, slot.end, date, busyTimes, userTimezone);
      if (isBusy) continue;

      // Already booked check
      const isBooked = existingBookings.some(
        (b) => b.userId === user.id && b.startTime === slot.start
      );
      if (isBooked) continue;

      // Convert host-timezone slot to visitor timezone for display/grouping
      const displayStart = convertTime(slot.start, date, userTimezone, visitorTz);
      const displayEnd = convertTime(slot.end, date, userTimezone, visitorTz);

      const key = `${displayStart}-${displayEnd}`;
      if (!slotMap[key]) slotMap[key] = [];
      slotMap[key].push({
        id: user.id,
        name: user.name || user.email || 'Team Member',
        bio: (user as any).bio || undefined,
        hometown: (user as any).hometown || undefined,
        basedIn: (user as any).basedIn || undefined,
        strExperience: (user as any).strExperience || undefined,
        hostStart: slot.start,
        hostEnd: slot.end,
        hostTimezone: userTimezone,
      });
    }
  }

  // Convert to sorted array
  const slots = Object.entries(slotMap)
    .map(([key, users]) => {
      const [start, end] = key.split('-');
      return { start, end, availableUsers: users };
    })
    .sort((a, b) => a.start.localeCompare(b.start));

  return NextResponse.json({ date, slots, displayTimezone: visitorTz });
}

/**
 * Convert a time string (e.g. "09:00") from one timezone to another on a given date.
 */
function convertTime(time: string, date: string, fromTz: string, toTz: string): string {
  if (fromTz === toTz) return time;

  const refDate = new Date(`${date}T12:00:00Z`);
  const fromOffset = getTimezoneOffsetMinutes(refDate, fromTz);
  const toOffset = getTimezoneOffsetMinutes(refDate, toTz);
  const diffMinutes = toOffset - fromOffset;

  const [h, m] = time.split(':').map(Number);
  let totalMinutes = h * 60 + m + diffMinutes;

  // Handle day overflow (unlikely for US business hours but just in case)
  if (totalMinutes < 0) totalMinutes += 24 * 60;
  if (totalMinutes >= 24 * 60) totalMinutes -= 24 * 60;

  const newH = Math.floor(totalMinutes / 60);
  const newM = totalMinutes % 60;
  return `${String(newH).padStart(2, '0')}:${String(newM).padStart(2, '0')}`;
}

/**
 * Get the UTC offset in minutes for a timezone on a given date.
 * E.g., America/New_York in winter = -300 (UTC-5), America/Denver = -420 (UTC-7)
 */
function getTimezoneOffsetMinutes(date: Date, tz: string): number {
  const utcStr = date.toLocaleString('en-US', { timeZone: 'UTC' });
  const tzStr = date.toLocaleString('en-US', { timeZone: tz });
  return (new Date(tzStr).getTime() - new Date(utcStr).getTime()) / 60000;
}

/**
 * Convert a local datetime string in a given timezone to UTC Date.
 */
function localToUTC(localDateTimeStr: string, timezone: string): Date {
  const localDate = new Date(localDateTimeStr);
  const utcStr = localDate.toLocaleString('en-US', { timeZone: 'UTC' });
  const tzStr = localDate.toLocaleString('en-US', { timeZone: timezone });
  const utcDate = new Date(utcStr);
  const tzDate = new Date(tzStr);
  const offsetMs = utcDate.getTime() - tzDate.getTime();
  return new Date(localDate.getTime() + offsetMs);
}
