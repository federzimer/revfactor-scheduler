import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// GET - fetch date overrides for the logged-in user
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const user = await prisma.user.findUnique({ where: { email: session.user.email } });
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

  const overrides = await prisma.dateOverride.findMany({
    where: { userId: user.id },
    orderBy: { date: 'asc' },
  });

  return NextResponse.json({ overrides });
}

// POST - add or update a date override
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const user = await prisma.user.findUnique({ where: { email: session.user.email } });
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

  const body = await req.json();
  const { date, isBlocked, startTime, endTime } = body as {
    date: string;
    isBlocked: boolean;
    startTime?: string;
    endTime?: string;
  };

  if (!date) {
    return NextResponse.json({ error: 'Date is required' }, { status: 400 });
  }

  const override = await prisma.dateOverride.upsert({
    where: { userId_date: { userId: user.id, date } },
    update: { isBlocked, startTime: startTime || null, endTime: endTime || null },
    create: {
      userId: user.id,
      date,
      isBlocked,
      startTime: startTime || null,
      endTime: endTime || null,
    },
  });

  return NextResponse.json({ override });
}

// DELETE - remove a date override
export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const user = await prisma.user.findUnique({ where: { email: session.user.email } });
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');

  if (!id) {
    return NextResponse.json({ error: 'Override ID required' }, { status: 400 });
  }

  await prisma.dateOverride.deleteMany({
    where: { id, userId: user.id },
  });

  return NextResponse.json({ success: true });
}
