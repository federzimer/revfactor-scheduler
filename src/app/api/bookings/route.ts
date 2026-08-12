import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// GET - list bookings. Super admins see everyone's; regular users see only their own.
// Optional filters: ?from=YYYY-MM-DD&to=YYYY-MM-DD&userId=...&outcome=...
export async function GET(req: NextRequest) {
  const me = await getSessionUser();
  if (!me || !me.active) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const sp = req.nextUrl.searchParams;
  const from = sp.get('from');
  const to = sp.get('to');
  const filterUserId = sp.get('userId');
  const outcome = sp.get('outcome');

  const where: any = {};
  // Regular users are always scoped to their own bookings.
  if (me.role !== 'super_admin') {
    where.userId = me.id;
  } else if (filterUserId) {
    where.userId = filterUserId;
  }
  if (from || to) {
    where.date = {};
    if (from) where.date.gte = from;
    if (to) where.date.lte = to;
  }
  if (outcome) where.outcome = outcome;

  const bookings = await prisma.booking.findMany({
    where,
    orderBy: [{ date: 'desc' }, { startTime: 'desc' }],
    include: {
      user: { select: { id: true, name: true, email: true, timezone: true } },
      followUps: {
        where: { status: 'sent' },
        orderBy: { sentAt: 'desc' },
        take: 5,
        select: {
          id: true,
          templateKey: true,
          subject: true,
          status: true,
          sentByName: true,
          sentAt: true,
        },
      },
    },
  });

  return NextResponse.json({
    role: me.role,
    bookings: bookings.map((b) => ({
      id: b.id,
      date: b.date,
      startTime: b.startTime,
      endTime: b.endTime,
      hostId: b.userId,
      hostName: b.user?.name || b.user?.email || 'Unknown',
      hostTimezone: b.user?.timezone || 'America/New_York', // startTime is stored in this tz

      visitorName: b.visitorName,
      visitorEmail: b.visitorEmail,
      visitorPhone: b.visitorPhone,
      visitorAirbnbLink: b.visitorAirbnbLink,
      visitorAddress: (b as any).visitorAddress ?? null,
      visitorNotes: (b as any).visitorNotes ?? null, // the lead's own note from the booking form
      heardAbout: (b as any).visitorHeardAbout ?? null,
      referralName: (b as any).visitorReferralName ?? null,
      status: b.status,
      outcome: (b as any).outcome ?? 'scheduled',
      outcomeNote: (b as any).outcomeNote ?? null, // the rep's CRM note
      followUps: b.followUps,
      createdAt: b.createdAt,
    })),
  });
}
