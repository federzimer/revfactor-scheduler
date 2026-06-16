import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// Always query the live DB — never prerender/cache this at build time, since the bookable
// host list changes as teammates connect/disconnect or are activated.
export const dynamic = 'force-dynamic';

// Local photo fallbacks for hosts whose Google profile image we don't store.
const PHOTO_FALLBACK: Record<string, string> = {
  'federico@blackbirdhm.com': '/federico.jpg',
  'emily@blackbirdhm.com': '/emily.png',
};

// GET /api/hosts — public list of bookable hosts for the booking widget header.
// "Bookable" mirrors /api/slots: active AND has granted Google Calendar access. This is
// what makes the "X & Y are ready to chat" strip reflect reality instead of a hardcoded list.
export async function GET() {
  const users = await prisma.user.findMany({
    where: {
      active: true,
      accounts: { some: { provider: 'google', scope: { contains: 'calendar' } } },
    },
    orderBy: [{ role: 'asc' }, { name: 'asc' }],
    select: { name: true, email: true, image: true },
  });

  const hosts = users.map((u) => {
    const email = u.email?.toLowerCase() || '';
    const firstName = (u.name || u.email || 'Team Member').trim().split(/\s+/)[0];
    return {
      firstName,
      image: u.image || PHOTO_FALLBACK[email] || '/default-avatar.png',
    };
  });

  return NextResponse.json({ hosts });
}
