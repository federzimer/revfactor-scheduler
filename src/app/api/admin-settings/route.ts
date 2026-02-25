import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// GET - fetch settings for the logged-in user
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const user = await prisma.user.findUnique({ where: { email: session.user.email } });
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

  return NextResponse.json({
    maxAdvanceDays: (user as any).maxAdvanceDays ?? 60,
  });
}

// POST - update settings for the logged-in user
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const user = await prisma.user.findUnique({ where: { email: session.user.email } });
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

  const body = await req.json();
  const { maxAdvanceDays } = body as { maxAdvanceDays: number };

  if (maxAdvanceDays !== undefined) {
    await prisma.user.update({
      where: { id: user.id },
      data: { maxAdvanceDays: Math.max(1, Math.min(365, maxAdvanceDays)) } as any,
    });
  }

  return NextResponse.json({ success: true, maxAdvanceDays });
}
