import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getBusyTimesRange } from '@/lib/google-calendar';
import { generateTimeSlots, isSlotBusy } from '@/lib/utils';

// GET /api/available-dates?from=2025-03-01&to=2025-03-31
// Returns dates that have at least one admin with actual availability
// (checks weekly schedule, date overrides, maxAdvanceDays, buffer time, AND Google Calendar freebusy)
export async function GET(req: NextRequest) {
  const from = req.nextUrl.searchParams.get('from');
  const to = req.nextUrl.searchParams.get('to');

  if (!from || !to) {
    return NextResponse.json({ error: 'from and to parameters required' }, { status: 400 });
  }

  const duration = parseInt(process.env.NEXT_PUBLIC_BOOKING_DURATION || '15', 10);

  // Optional: restrict to a single host (person-first booking flow). Omitted = all bookable hosts.
  const userId = req.nextUrl.searchParams.get('userId') || undefined;

  // Get all active, bookable team members with their weekly availability and date overrides.
  // Mirror /api/slots: only consider hosts who have granted Google Calendar access, so a
  // host we can't actually book never makes a date look available.
  const adminUsers = (await prisma.user.findMany({
    where: {
      active: true,
      bookable: true,
      ...(userId ? { id: userId } : {}),
      accounts: { some: { provider: 'google', scope: { contains: 'calendar' } } },
    },
    include: {
      availability: true,
      dateOverrides: true,
    },
  }));

  // Fetch busy times for the entire range in ONE API call per user (using per-user timezone).
  // If a host's calendar access is dead, drop them from consideration entirely.
  const userBusyMap: Record<string, Record<string, { start: string; end: string }[]>> = {};
  const bookableUsers: typeof adminUsers = [];
  for (const user of adminUsers) {
    const userTimezone = (user as any).timezone || 'America/New_York';
    try {
      userBusyMap[user.id] = await getBusyTimesRange(user.id, from, to, userTimezone);
      bookableUsers.push(user);
    } catch (e: any) {
      if (e?.message === 'NO_CALENDAR_ACCESS') {
        console.warn(`Skipping host ${user.email}: no calendar access`);
        continue;
      }
      console.error(`Error fetching busy range for ${user.email}:`, e);
      // Transient error — keep the host but treat as having no known busy times.
      userBusyMap[user.id] = {};
      bookableUsers.push(user);
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

    for (const user of bookableUsers) {
      const userTimezone = (user as any).timezone || 'America/New_York';
      const minBufferHours = (user as any).minBufferHours ?? 2;
      const maxDays = (user as any).maxAdvanceDays ?? 30;

      // Check maxAdvanceDays — skip if date is too far in the future for this user
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

      // Calculate buffer cutoff
      const now = new Date();
      const bufferCutoff = new Date(now.getTime() + minBufferHours * 60 * 60 * 1000);

      // Check if at least one slot is NOT busy and passes buffer check
      const hasOpenSlot = timeSlots.some((slot) => {
        // Buffer check
        if (minBufferHours > 0) {
          const slotStartUTC = localToUTC(`${dateStr}T${slot.start}:00`, userTimezone);
          if (slotStartUTC < bufferCutoff) return false;
        }
        return !isSlotBusy(slot.start, slot.end, dateStr, busyTimes, userTimezone);
      });

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
