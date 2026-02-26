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
    maxAdvanceDays: (user as any).maxAdvanceDays ?? 30,
    timezone: (user as any).timezone ?? 'America/New_York',
    minBufferHours: (user as any).minBufferHours ?? 2,
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
  const { maxAdvanceDays, timezone, minBufferHours } = body as {
    maxAdvanceDays?: number;
    timezone?: string;
    minBufferHours?: number;
  };

  const updateData: any = {};

  if (maxAdvanceDays !== undefined) {
    updateData.maxAdvanceDays = Math.max(1, Math.min(365, maxAdvanceDays));
  }

  if (timezone !== undefined) {
    // Validate it's a real IANA timezone
    const validTimezones = [
      'America/New_York', 'America/Chicago', 'America/Denver',
      'America/Los_Angeles', 'America/Phoenix', 'America/Anchorage',
      'Pacific/Honolulu', 'America/Puerto_Rico',
    ];
    if (validTimezones.includes(timezone)) {
      updateData.timezone = timezone;
    }
  }

  if (minBufferHours !== undefined) {
    updateData.minBufferHours = Math.max(0, Math.min(48, minBufferHours));
  }

  if (Object.keys(updateData).length > 0) {
    await prisma.user.update({
      where: { id: user.id },
      data: updateData,
    });
  }

  return NextResponse.json({
    success: true,
    maxAdvanceDays: updateData.maxAdvanceDays ?? (user as any).maxAdvanceDays,
    timezone: updateData.timezone ?? (user as any).timezone,
    minBufferHours: updateData.minBufferHours ?? (user as any).minBufferHours,
  });
}
