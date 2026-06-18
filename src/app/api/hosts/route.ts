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
      bookable: true,
      accounts: { some: { provider: 'google', scope: { contains: 'calendar' } } },
    },
    orderBy: [{ role: 'asc' }, { name: 'asc' }],
    select: {
      id: true, name: true, email: true, image: true,
      bio: true, hometown: true, basedIn: true, strExperience: true,
    },
  });

  const hosts = users.map((u) => {
    const email = u.email?.toLowerCase() || '';
    const name = (u.name || u.email || 'Team Member').trim();
    const firstName = name.split(/\s+/)[0];
    return {
      id: u.id,
      name,
      firstName,
      // May be a data-URL avatar (uploaded on /admin/profile). Served here once per page
      // load — deliberately NOT inlined per-slot in /api/slots, which would bloat that response.
      image: u.image || PHOTO_FALLBACK[email] || '/default-avatar.png',
      bio: u.bio || null,
      hometown: u.hometown || null,
      basedIn: u.basedIn || null,
      strExperience: u.strExperience || null,
    };
  });

  return NextResponse.json({ hosts });
}
