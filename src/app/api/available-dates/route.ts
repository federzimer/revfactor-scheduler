import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getBusyTimesRange } from '@/lib/google-calendar';
import { generateTimeSlots, isSlotBusy } from '@/lib/utils';

// GET /api/available-dates?from=2025-03-01&to=2025-03-31
// Returns dates that have at least one admin with actual availability
// (checks weekly schedule, date overrides, maxAdvanceDays, AND Google Calendar freebusy)
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

  // Fetch busy times for the entire range in ONE API call per user
  const userBusyMap: Record<string, Record<string, { start: string; end: string }[]>> = {};
  for (const user of adminUsers) {
    try {
      userBusyMap[user.id] = await getBusyTimesRange(user.id, from, to, timezone);
    } catch (e) {
      console.error(`Error fetching busy range for ${user.email}:`, e);
      userBusyMap[user.id] = {};
    }
  }

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
      // Check maxAdvanceDays — skip if date is too far in the future for this user
      const maxDays = (user as any).maxAdvanceDays ?? 60;
      const daysFromNow = Math.ceil((d.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      if (daysFromNow > maxDays) continue;

      // Check for date-specific override
      const override = user.dateOverrides.find((o: any) => o.date === dateStr);

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
        const dayAvail = user.availability.filter((a: any) => a.dayOfWeek === dayOfWeek);
        if (dayAvail.length === 0) continue;
        timeRanges = dayAvail.map((a: any) => ({ startTime: a.startTime, endTime: a.endTime }));
      }

      // Generate time slots for this user's availability
      const timeSlots = timeRanges.flatMap((range) =>
        generateTimeSlots(range.startTime, range.endTime, duration)
      );

      if (timeSlots.length === 0) continue;

      // Get this user's busy times for this specific date from the pre-fetched map
      const busyTimes = userBusyMap[user.id]?.[dateStr] || [];

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
