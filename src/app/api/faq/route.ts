import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser, requireSuperAdmin } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// GET - list all FAQ entries. Any active signed-in teammate (reps included) can read.
export async function GET() {
  const me = await getSessionUser();
  if (!me || !me.active) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const faqs = await prisma.faq.findMany({
    orderBy: [{ category: 'asc' }, { sortOrder: 'asc' }, { createdAt: 'asc' }],
  });
  return NextResponse.json({ faqs, canEdit: me.role === 'super_admin' });
}

// POST - create an FAQ entry (super admin only).
export async function POST(req: NextRequest) {
  const admin = await requireSuperAdmin();
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body = await req.json();
  const question = (body.question || '').trim();
  const answer = (body.answer || '').trim();
  const category = (body.category || '').trim() || null;
  if (!question || !answer) {
    return NextResponse.json({ error: 'Question and answer are required' }, { status: 400 });
  }

  const faq = await prisma.faq.create({
    data: { question, answer, category, sortOrder: Number.isFinite(body.sortOrder) ? body.sortOrder : 0 },
  });
  return NextResponse.json({ faq });
}

// PATCH - update an FAQ entry (super admin only). Body: { id, question?, answer?, category?, sortOrder? }
export async function PATCH(req: NextRequest) {
  const admin = await requireSuperAdmin();
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body = await req.json();
  const { id } = body as { id?: string };
  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });

  const data: { question?: string; answer?: string; category?: string | null; sortOrder?: number } = {};
  if (typeof body.question === 'string') data.question = body.question.trim();
  if (typeof body.answer === 'string') data.answer = body.answer.trim();
  if (typeof body.category === 'string') data.category = body.category.trim() || null;
  if (Number.isFinite(body.sortOrder)) data.sortOrder = body.sortOrder;

  const faq = await prisma.faq.update({ where: { id }, data });
  return NextResponse.json({ faq });
}

// DELETE - remove an FAQ entry (super admin only). Body: { id }
export async function DELETE(req: NextRequest) {
  const admin = await requireSuperAdmin();
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const { id } = body as { id?: string };
  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });

  await prisma.faq.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
