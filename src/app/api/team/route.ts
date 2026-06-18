import { NextRequest, NextResponse } from 'next/server';
import { requireSuperAdmin } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// GET - list all team members (super admin only)
export async function GET() {
  const admin = await requireSuperAdmin();
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const members = await prisma.user.findMany({
    orderBy: [{ role: 'asc' }, { name: 'asc' }],
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      active: true,
      bookable: true,
      timezone: true,
      image: true,
      bio: true,
      hometown: true,
      basedIn: true,
      strExperience: true,
      accounts: { select: { id: true }, take: 1 }, // has the person connected Google yet?
    },
  });

  return NextResponse.json({
    members: members.map((m) => ({
      id: m.id,
      name: m.name,
      email: m.email,
      role: m.role,
      active: m.active,
      bookable: m.bookable,
      timezone: m.timezone,
      image: m.image,
      bio: m.bio,
      hometown: m.hometown,
      basedIn: m.basedIn,
      strExperience: m.strExperience,
      connected: m.accounts.length > 0,
    })),
  });
}

// POST - add a team member (super admin only). Creates a User row that links to
// their Google account on first sign-in (allowDangerousEmailAccountLinking).
export async function POST(req: NextRequest) {
  const admin = await requireSuperAdmin();
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body = await req.json();
  const name = (body.name || '').trim();
  const email = (body.email || '').trim().toLowerCase();
  const role = body.role === 'super_admin' ? 'super_admin' : 'user';

  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return NextResponse.json({ error: 'A valid email is required' }, { status: 400 });
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json({ error: 'A team member with that email already exists' }, { status: 409 });
  }

  const member = await prisma.user.create({
    data: { name: name || null, email, role, active: true },
    select: {
      id: true, name: true, email: true, role: true, active: true, bookable: true, timezone: true,
      image: true, bio: true, hometown: true, basedIn: true, strExperience: true,
    },
  });

  return NextResponse.json({ member: { ...member, connected: false } });
}

// PATCH - change a member's role or active state (super admin only).
export async function PATCH(req: NextRequest) {
  const admin = await requireSuperAdmin();
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body = await req.json();
  const { id } = body as { id?: string };
  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });

  const target = await prisma.user.findUnique({ where: { id } });
  if (!target) return NextResponse.json({ error: 'Member not found' }, { status: 404 });

  const updateData: {
    role?: string; active?: boolean; bookable?: boolean;
    name?: string | null; image?: string | null; bio?: string | null;
    hometown?: string | null; basedIn?: string | null; strExperience?: string | null;
  } = {};
  if (body.role === 'super_admin' || body.role === 'user') updateData.role = body.role;
  if (typeof body.active === 'boolean') updateData.active = body.active;
  if (typeof body.bookable === 'boolean') updateData.bookable = body.bookable;

  // Profile fields a super admin can edit on anyone's behalf. '' clears to null.
  const clean = (v: unknown) => {
    if (typeof v !== 'string') return undefined;
    const t = v.trim();
    return t === '' ? null : t;
  };
  for (const f of ['name', 'image', 'bio', 'hometown', 'basedIn', 'strExperience'] as const) {
    if (f in body) {
      const v = clean(body[f]);
      if (v !== undefined) updateData[f] = v;
    }
  }

  // Guard: never leave the team without an active super admin.
  const wouldLoseSuperAdmin =
    (updateData.role === 'user' && target.role === 'super_admin') ||
    (updateData.active === false && target.role === 'super_admin');
  if (wouldLoseSuperAdmin) {
    const otherActiveSupers = await prisma.user.count({
      where: { role: 'super_admin', active: true, id: { not: id } },
    });
    if (otherActiveSupers === 0) {
      return NextResponse.json(
        { error: 'Cannot demote or deactivate the last active super admin' },
        { status: 400 },
      );
    }
  }

  const member = await prisma.user.update({
    where: { id },
    data: updateData,
    select: {
      id: true, name: true, email: true, role: true, active: true, bookable: true, timezone: true,
      image: true, bio: true, hometown: true, basedIn: true, strExperience: true,
    },
  });

  return NextResponse.json({ member });
}
