import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getBusyTimes } from '@/lib/google-calendar';
import { generateTimeSlots, isSlotBusy } from '@/lib/utils';

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

  const timezone = process.env.NEXT_PUBLIC_TIMEZONE || 'America/New_York';
  const duration = parseInt(process.env.NEXT_PUBLIC_BOOKING_DURATION || '15', 10);

  // Get the day of week for the requested date
  const dayOfWeek = new Date(date + 'T12:00:00').getDay();

  // Find all admin users who have availability for this day
  const adminEmails = (process.env.ADMIN_EMAILS || '').split(',').map((e) => e.trim().toLowerCase());
  const adminUsers = await prisma.user.findMany({
    where: { email: { in: adminEmails } },
    include: {
      availability: { where: { dayOfWeek } },
    },
  });

  // Get existing bookings for this date
  const existingBookings = await prisma.booking.findMany({
    where: { date, status: 'confirmed' },
  });

  // For each user, generate their available slots
  const slotMap: Record<string, { id: string; name: string; image?: string }[]> = {};

  for (const user of adminUsers) {
    if (user.availability.length === 0) continue;

    // Combine slots from all time ranges for this day
    const timeSlots = user.availability.flatMap((avail) =>
      generateTimeSlots(avail.startTime, avail.endTime, duration)
    );

    // Get Google Calendar busy times
    let busyTimes: { start: string; end: string }[] = [];
    try {
      busyTimes = await getBusyTimes(user.id, date, timezone);
    } catch (e) {
      console.error(`Error getting busy times for ${user.email}:`, e);
    }

    for (const slot of timeSlots) {
      // Check if slot conflicts with Google Calendar
      const isBusy = isSlotBusy(slot.start, slot.end, date, busyTimes, timezone);
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
        image: user.image || undefined,
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

  return NextResponse.json({ date, slots, timezone });
}
