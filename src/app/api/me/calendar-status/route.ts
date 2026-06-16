import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

// GET /api/me/calendar-status — does the signed-in user's Google connection actually grant
// Calendar access? Used by the "Connect Google Calendar" card so a host can tell at a glance
// whether their booked calls will land on their calendar / generate a Meet link.
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { email: session.user.email.toLowerCase() },
  });
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

  const account = await prisma.account.findFirst({
    where: { userId: user.id, provider: 'google' },
    select: { scope: true },
  });

  return NextResponse.json({
    connected: !!account,
    hasCalendar: !!account?.scope?.includes('calendar'),
  });
}
