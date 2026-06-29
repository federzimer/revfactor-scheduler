import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser, requireSuperAdmin } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// Normalize a user-entered link so bare "drive.google.com/..." still works as an href.
function normalizeUrl(raw: string): string {
  const url = raw.trim();
  if (!url) return '';
  if (/^https?:\/\//i.test(url)) return url;
  return `https://${url}`;
}

// GET - list shareable resources. Any active signed-in teammate (reps included) can read.
export async function GET() {
  const me = await getSessionUser();
  if (!me || !me.active) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const resources = await prisma.resource.findMany({
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
  });
  return NextResponse.json({ resources, canEdit: me.role === 'super_admin' });
}

// POST - create a resource (super admin only). Body: { title, description?, url, sortOrder? }
export async function POST(req: NextRequest) {
  const admin = await requireSuperAdmin();
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body = await req.json();
  const title = (body.title || '').trim();
  const description = (body.description || '').trim() || null;
  const url = normalizeUrl(body.url || '');
  if (!title || !url) {
    return NextResponse.json({ error: 'Title and link are required' }, { status: 400 });
  }

  const resource = await prisma.resource.create({
    data: { title, description, url, sortOrder: Number.isFinite(body.sortOrder) ? body.sortOrder : 0 },
  });
  return NextResponse.json({ resource });
}

// PATCH - update a resource (super admin only). Body: { id, title?, description?, url?, sortOrder? }
export async function PATCH(req: NextRequest) {
  const admin = await requireSuperAdmin();
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body = await req.json();
  const { id } = body as { id?: string };
  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });

  const data: { title?: string; description?: string | null; url?: string; sortOrder?: number } = {};
  if (typeof body.title === 'string') data.title = body.title.trim();
  if (typeof body.description === 'string') data.description = body.description.trim() || null;
  if (typeof body.url === 'string') data.url = normalizeUrl(body.url);
  if (Number.isFinite(body.sortOrder)) data.sortOrder = body.sortOrder;

  const resource = await prisma.resource.update({ where: { id }, data });
  return NextResponse.json({ resource });
}

// DELETE - remove a resource (super admin only). Body: { id }
export async function DELETE(req: NextRequest) {
  const admin = await requireSuperAdmin();
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const { id } = body as { id?: string };
  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });

  await prisma.resource.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
