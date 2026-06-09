import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

const VALID_OUTCOMES = ['scheduled', 'completed', 'no_show', 'won', 'lost'];

// PATCH - update a booking's outcome / note.
// Super admins can update any booking; regular users only their own.
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const me = await getSessionUser();
  if (!me || !me.active) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const booking = await prisma.booking.findUnique({ where: { id: params.id } });
  if (!booking) return NextResponse.json({ error: 'Booking not found' }, { status: 404 });

  if (me.role !== 'super_admin' && booking.userId !== me.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await req.json();
  const updateData: { outcome?: string; outcomeNote?: string | null; convertedAt?: Date | null } = {};

  if (body.outcome !== undefined) {
    if (!VALID_OUTCOMES.includes(body.outcome)) {
      return NextResponse.json({ error: 'Invalid outcome' }, { status: 400 });
    }
    updateData.outcome = body.outcome;
    // Stamp / clear the conversion timestamp as the outcome moves in/out of "won".
    updateData.convertedAt = body.outcome === 'won' ? new Date() : null;
  }
  if (body.outcomeNote !== undefined) {
    updateData.outcomeNote = body.outcomeNote ? String(body.outcomeNote).slice(0, 2000) : null;
  }

  const updated = await prisma.booking.update({ where: { id: params.id }, data: updateData });

  return NextResponse.json({
    booking: {
      id: updated.id,
      outcome: (updated as any).outcome,
      outcomeNote: (updated as any).outcomeNote,
      convertedAt: (updated as any).convertedAt,
    },
  });
}
