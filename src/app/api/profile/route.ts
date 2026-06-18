import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// GET - the signed-in rep's own profile (the fields shown to visitors on the booking page).
export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  return NextResponse.json({
    profile: {
      name: user.name,
      email: user.email,
      image: (user as any).image ?? null,
      bio: (user as any).bio ?? null,
      hometown: (user as any).hometown ?? null,
      basedIn: (user as any).basedIn ?? null,
      strExperience: (user as any).strExperience ?? null,
    },
  });
}

// PATCH - update the signed-in rep's own profile. A rep can only edit themselves.
export async function PATCH(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();

  // Guard the avatar: only a data:image/ or http(s) URL, capped so a huge data URL can't
  // bloat the DB or the public /api/hosts response (the cropper emits a ~256² JPEG ≈ 20-30KB).
  if (typeof body.image === 'string' && body.image.trim()) {
    const img = body.image.trim();
    if (!/^(data:image\/|https?:\/\/)/.test(img) || img.length > 60_000) {
      return NextResponse.json({ error: 'Invalid or oversized image' }, { status: 400 });
    }
  }

  const clean = (v: unknown) => {
    if (typeof v !== 'string') return undefined;
    const trimmed = v.trim();
    return trimmed === '' ? null : trimmed;
  };

  const data: Record<string, string | null> = {};
  for (const field of ['name', 'image', 'bio', 'hometown', 'basedIn', 'strExperience']) {
    if (field in body) {
      const value = clean(body[field]);
      if (value !== undefined) data[field] = value;
    }
  }

  const updated = await prisma.user.update({
    where: { id: user.id },
    data,
    select: {
      name: true, email: true, image: true,
      bio: true, hometown: true, basedIn: true, strExperience: true,
    },
  });

  return NextResponse.json({ profile: updated });
}
