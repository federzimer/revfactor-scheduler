import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getBusyTimes } from '@/lib/google-calendar';
import { generateTimeSlots, isSlotBusy } from '@/lib/utils';

// GET /api/available-dates?from=2025-03-01&to=2025-03-31
// Returns dates that have at least one admin with actual availability
// (checks both weekly schedule AND Google Calendar freebusy)
export async function GET(req: NextRequest) {
  const from = req.nextUrl.searchParams.get('from');
  const to = req.nextUrl.searchParams.get('to');

  if (!from || !to) {
    return NextResponse.json({ error: 'from and to parameters required' }, { status: 400 });
  }

  const timezone = process.env.NEXT_PUBLIC_TIMEZONE || 'America/New_York';
  const duration = parseInt(process.env.NEXT_PUBLIC_BOOKING_DURATION || '15', 10);
  const adminEmails = (process.env.ADMIN_EMAILS || '').split(',').map((e) => e.trim().toLowerCase());

  // Get all admin users with their weekly availability and date overrides
  const adminUsers = await prisma.user.findMany({
    where: { email: { in: adminEmails } },
    include: {
      availability: true,
      dateOverrides: true,
    },
  });

  const availableDates: string[] = [];
  const fromDate = new Date(from + 'T12:00:00');
  const toDate = new Date(to + 'T12:00:00');
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (let d = new Date(fromDate); d <= toDate; d.setDate(d.getDate() + 1)) {
    // Skip past dates (including today)
    if (d <= today) continue;

    const dateStr = d.toISOString().split('T')[0];
    const dayOfWeek = d.getDay();

    // Check if any admin has availability for this date
    let dateHasAvailability = false;

    for (const user of adminUsers) {
      // Check for date-specific override
      const override = user.dateOverrides.find((o) => o.date === dateStr);

      let timeRanges: { startTime: string; endTime: string }[] = [];

      if (override) {
        if (override.isBlocked) continue;
        if (override.startTime && override.endTime) {
          timeRanges = [{ startTime: override.startTime, endTime: override.endTime }];
        } else {
          continue;
        }
      } else {
        // Check weekly availability for this day of week
        const dayAvail = user.availability.filter((a) => a.dayOfWeek === dayOfWeek);
        if (dayAvail.length === 0) continue;
        timeRanges = dayAvail.map((a) => ({ startTime: a.startTime, endTime: a.endTime }));
      }

      // Generate time slots for this user's availability
      const timeSlots = timeRanges.flatMap((range) =>
        generateTimeSlots(range.startTime, range.endTime, duration)
      );

      if (timeSlots.length === 0) continue;

      // Check Google Calendar freebusy for this user on this date
      let busyTimes: { start: string; end: string }[] = [];
      try {
        busyTimes = await getBusyTimes(user.id, dateStr, timezone);
      } catch (e) {
        // If we can't check freebusy, assume the date is available
        // (better to show it and filter at slot level than to hide it)
        dateHasAvailability = true;
        break;
      }

      // Check if at least one slot is NOT busy
      const hasOpenSlot = timeSlots.some(
        (slot) => !isSlotBusy(slot.start, slot.end, dateStr, busyTimes, timezone)
      );

      if (hasOpenSlot) {
        dateHasAvailability = true;
        break;
      }
    }

    if (dateHasAvailability) {
      availableDates.push(dateStr);
    }
  }

  return NextResponse.json({ availableDates });
}
