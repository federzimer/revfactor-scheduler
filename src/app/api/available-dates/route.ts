import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET /api/available-dates?from=2025-03-01&to=2025-03-31
// Returns dates that have at least one admin with availability
export async function GET(req: NextRequest) {
  const from = req.nextUrl.searchParams.get('from');
  const to = req.nextUrl.searchParams.get('to');

  if (!from || !to) {
    return NextResponse.json({ error: 'from and to parameters required' }, { status: 400 });
  }

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
    let hasAvailability = false;

    for (const user of adminUsers) {
      // Check for date-specific override
      const override = user.dateOverrides.find((o) => o.date === dateStr);

      if (override) {
        // If blocked, this user is unavailable on this date
        if (override.isBlocked) continue;
        // If has custom hours, user is available
        if (override.startTime && override.endTime) {
          hasAvailability = true;
          break;
        }
        continue;
      }

      // Check weekly availability for this day of week
      const dayAvail = user.availability.filter((a) => a.dayOfWeek === dayOfWeek);
      if (dayAvail.length > 0) {
        hasAvailability = true;
        break;
      }
    }

    if (hasAvailability) {
      availableDates.push(dateStr);
    }
  }

  return NextResponse.json({ availableDates });
}
