import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// GET - fetch availability for the logged-in user
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const user = await prisma.user.findUnique({ where: { email: session.user.email } });
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

  const availability = await prisma.availability.findMany({
    where: { userId: user.id },
    orderBy: { dayOfWeek: 'asc' },
  });

  return NextResponse.json({ availability });
}

// POST - save availability for the logged-in user
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const user = await prisma.user.findUnique({ where: { email: session.user.email } });
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

  const body = await req.json();
  const { availability } = body as {
    availability: { dayOfWeek: number; startTime: string; endTime: string }[];
  };

  // Delete existing availability for this user
  await prisma.availability.deleteMany({ where: { userId: user.id } });

  // Create new availability entries
  if (availability && availability.length > 0) {
    await prisma.availability.createMany({
      data: availability.map((a) => ({
        userId: user.id,
        dayOfWeek: a.dayOfWeek,
        startTime: a.startTime,
        endTime: a.endTime,
      })),
    });
  }

  const updated = await prisma.availability.findMany({
    where: { userId: user.id },
    orderBy: { dayOfWeek: 'asc' },
  });

  return NextResponse.json({ availability: updated });
}
