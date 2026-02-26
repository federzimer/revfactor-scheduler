import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getBusyTimes } from '@/lib/google-calendar';
import { generateTimeSlots, isSlotBusy } from '@/lib/utils';

const PHOTO_FALLBACK: Record<string, string> = {
  'federico@blackbirdhm.com': '/federico.jpg',
  'emily@blackbirdhm.com': '/emily.png',
};

export interface AvailableSlot {
  start: string;
  end: string;
  availableUsers: { id: string; name: string; image?: string }[];
}

// GET /api/slots?date=2025-03-15
export async function GET(req: NextRequest) {
  const date = req.nextUrl.searchParams.get('date');
  if (!date) {
    return NextResponse.json({ error: 'Date parameter required' }, { status: 400 });
  }

  const duration = parseInt(process.env.NEXT_PUBLIC_BOOKING_DURATION || '15', 10);

  // Get the day of week for the requested date
  const dayOfWeek = new Date(date + 'T12:00:00').getDay();

  // Find all admin users who have availability for this day
  const adminEmails = (process.env.ADMIN_EMAILS || '').split(',').map((e) => e.trim().toLowerCase());
  const adminUsers = await prisma.user.findMany({
    where: { email: { in: adminEmails } },
    include: {
      availability: { where: { dayOfWeek } },
      dateOverrides: { where: { date } },
    },
  });

  // Get existing bookings for this date
  const existingBookings = await prisma.booking.findMany({
    where: { date, status: 'confirmed' },
  });

  // For each user, generate their available slots
  const slotMap: Record<string, { id: string; name: string; image?: string }[]> = {};

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
    const override = user.dateOverrides[0]; // at most one per user per date

    let timeRanges: { startTime: string; endTime: string }[] = [];

    if (override) {
      if (override.isBlocked) continue; // user blocked this date entirely
      if (override.startTime && override.endTime) {
        timeRanges = [{ startTime: override.startTime, endTime: override.endTime }];
      } else {
        continue; // blocked with no custom hours
      }
    } else {
      // Use weekly availability
      if (user.availability.length === 0) continue;
      timeRanges = user.availability.map((a) => ({ startTime: a.startTime, endTime: a.endTime }));
    }

    // Combine slots from all time ranges
    const timeSlots = timeRanges.flatMap((range) =>
      generateTimeSlots(range.startTime, range.endTime, duration)
    );

    // Get Google Calendar busy times using per-user timezone
    let busyTimes: { start: string; end: string }[] = [];
    try {
      busyTimes = await getBusyTimes(user.id, date, userTimezone);
    } catch (e) {
      console.error(`Error getting busy times for ${user.email}:`, e);
    }

    // Resolve profile photo with fallback
    const userImage = user.image || PHOTO_FALLBACK[user.email?.toLowerCase() || ''] || undefined;

    // Calculate the buffer cutoff time: current time + minBufferHours
    const now = new Date();
    const bufferCutoff = new Date(now.getTime() + minBufferHours * 60 * 60 * 1000);

    for (const slot of timeSlots) {
      // Check buffer time: is this slot starting too soon?
      if (minBufferHours > 0) {
        // Build a Date for the slot start in the user's timezone
        const slotStartDateTime = new Date(`${date}T${slot.start}:00`);
        // Use Intl to get the actual UTC time for this local slot
        const slotStartStr = `${date}T${slot.start}:00`;
        // Create date interpreting slot time in user's timezone
        const slotStartUTC = localToUTC(slotStartStr, userTimezone);
        if (slotStartUTC < bufferCutoff) continue;
      }

      // Check if slot conflicts with Google Calendar
      const isBusy = isSlotBusy(slot.start, slot.end, date, busyTimes, userTimezone);
      if (isBusy) continue;

      // Check if slot is already booked
      const isBooked = existingBookings.some(
        (b) => b.userId === user.id && b.startTime === slot.start
      );
      if (isBooked) continue;

      const key = `${slot.start}-${slot.end}`;
      if (!slotMap[key]) slotMap[key] = [];
      slotMap[key].push({
        id: user.id,
        name: user.name || user.email || 'Team Member',
        image: userImage,
      });
    }
  }

  // Convert to sorted array
  const slots: AvailableSlot[] = Object.entries(slotMap)
    .map(([key, users]) => {
      const [start, end] = key.split('-');
      return { start, end, availableUsers: users };
    })
    .sort((a, b) => a.start.localeCompare(b.start));

  return NextResponse.json({ date, slots });
}

/**
 * Convert a local datetime string (e.g. "2026-03-03T09:00:00") in a given timezone to UTC Date.
 */
function localToUTC(localDateTimeStr: string, timezone: string): Date {
  // Parse the local datetime
  const localDate = new Date(localDateTimeStr);
  // Get the UTC representation by using Intl
  const utcStr = localDate.toLocaleString('en-US', { timeZone: 'UTC' });
  const tzStr = localDate.toLocaleString('en-US', { timeZone: timezone });
  const utcDate = new Date(utcStr);
  const tzDate = new Date(tzStr);
  const offsetMs = utcDate.getTime() - tzDate.getTime();
  // The actual UTC time = localDate + offset
  return new Date(localDate.getTime() + offsetMs);
}
