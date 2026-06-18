'use client';

import { useSession } from 'next-auth/react';
import { useEffect, useRef, useState } from 'react';
import { redirect } from 'next/navigation';
import AdminHeader from '../AdminHeader';

interface Profile {
  name: string | null;
  email: string | null;
  image: string | null;
  bio: string | null;
  hometown: string | null;
  basedIn: string | null;
  strExperience: string | null;
}

const EMPTY: Profile = {
  name: '', email: '', image: '', bio: '', hometown: '', basedIn: '', strExperience: '',
};

export default function ProfilePage() {
  const { status } = useSession();
  const [form, setForm] = useState<Profile>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cropFile, setCropFile] = useState<File | null>(null); // image being cropped, if any

  const onPickPhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = ''; // allow re-picking the same file
    if (!f) return;
    if (!f.type.startsWith('image/')) { setError('Please choose an image file.'); return; }
    if (f.size > 15 * 1024 * 1024) { setError('That image is too large (max 15MB).'); return; }
    setError(null);
    setCropFile(f);
  };

  useEffect(() => {
    if (status === 'unauthenticated') redirect('/admin/login');
  }, [status]);

  useEffect(() => {
    if (status !== 'authenticated') return;
    (async () => {
      try {
        const res = await fetch('/api/profile');
        const data = await res.json();
        const p = data.profile || {};
        setForm({
          name: p.name ?? '', email: p.email ?? '', image: p.image ?? '',
          bio: p.bio ?? '', hometown: p.hometown ?? '', basedIn: p.basedIn ?? '',
          strExperience: p.strExperience ?? '',
        });
      } catch {
        setError('Failed to load your profile');
      }
      setLoading(false);
    })();
  }, [status]);

  const set = (k: keyof Profile) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setForm((f) => ({ ...f, [k]: e.target.value }));
    setSaved(false);
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name, image: form.image, bio: form.bio,
          hometown: form.hometown, basedIn: form.basedIn, strExperience: form.strExperience,
        }),
      });
      if (!res.ok) throw new Error();
      setSaved(true);
    } catch {
      setError('Could not save. Please try again.');
    }
    setSaving(false);
  };

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen" style={{ backgroundColor: '#E0DAD1' }}>
        <AdminHeader />
        <main className="max-w-5xl mx-auto px-4 py-8">
          <p className="text-sm" style={{ color: '#6B7280' }}>Loading…</p>
        </main>
      </div>
    );
  }

  const inputStyle = { backgroundColor: 'white', border: '1px solid #E5E4E0', color: '#181915' } as const;
  const hasPreview = form.bio || form.hometown || form.basedIn || form.strExperience;

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#E0DAD1' }}>
      <AdminHeader />

      <main className="max-w-5xl mx-auto px-4 py-8 grid md:grid-cols-2 gap-6">
        {/* Editor */}
        <form onSubmit={save} className="rounded-xl shadow-sm p-6 space-y-4" style={{ backgroundColor: '#F5F4F2', border: '1px solid #E5E4E0' }}>
          <div>
            <h2 className="text-[10px] font-semibold uppercase tracking-widest mb-2" style={{ color: '#9CA3AF' }}>Profile</h2>
            <h3 className="text-xl font-semibold mb-1" style={{ color: '#181915', fontFamily: 'Georgia, "Times New Roman", serif' }}>
              Your <span style={{ fontStyle: 'italic', color: '#13352F' }}>booking card</span>
            </h3>
            <p className="text-sm" style={{ color: '#6B7280' }}>
              This is what leads see when they pick you and book a call.
            </p>
          </div>

          {error && (
            <div className="rounded-lg px-3 py-2 text-sm" style={{ backgroundColor: '#fef2f2', color: '#b91c1c', border: '1px solid #fca5a5' }}>
              {error}
            </div>
          )}

          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: '#4B5563' }}>Display name</label>
            <input value={form.name ?? ''} onChange={set('name')} className="w-full rounded-md px-3 py-2 text-sm outline-none" style={inputStyle} placeholder="Jane Doe" />
          </div>

          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: '#4B5563' }}>Photo</label>
            <div className="flex items-center gap-3">
              <img src={form.image || '/default-avatar.png'} alt="" className="w-16 h-16 rounded-full object-cover" style={{ border: '1px solid #E5E4E0' }} />
              <div className="flex flex-col items-start gap-1.5">
                <label className="cursor-pointer px-3 py-1.5 rounded-md text-sm font-medium" style={{ backgroundColor: 'white', border: '1px solid #E5E4E0', color: '#13352F' }}>
                  {form.image ? 'Change photo' : 'Upload photo'}
                  <input type="file" accept="image/*" className="hidden" onChange={onPickPhoto} />
                </label>
                {form.image && (
                  <button type="button" onClick={() => { setForm((f) => ({ ...f, image: '' })); setSaved(false); }} className="text-[11px]" style={{ color: '#b91c1c' }}>
                    Remove photo
                  </button>
                )}
              </div>
            </div>
            <p className="text-[11px] mt-1.5" style={{ color: '#9CA3AF' }}>Upload a photo and crop it to a square. Defaults to your Google photo.</p>
          </div>

          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: '#4B5563' }}>Bio</label>
            <textarea value={form.bio ?? ''} onChange={set('bio')} rows={3} className="w-full rounded-md px-3 py-2 text-sm outline-none resize-none" style={inputStyle} placeholder="A sentence or two about you and how you help owners." />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: '#4B5563' }}>From</label>
              <input value={form.hometown ?? ''} onChange={set('hometown')} className="w-full rounded-md px-3 py-2 text-sm outline-none" style={inputStyle} placeholder="Buenos Aires" />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: '#4B5563' }}>Based in</label>
              <input value={form.basedIn ?? ''} onChange={set('basedIn')} className="w-full rounded-md px-3 py-2 text-sm outline-none" style={inputStyle} placeholder="Austin, TX" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: '#4B5563' }}>STR experience</label>
            <input value={form.strExperience ?? ''} onChange={set('strExperience')} className="w-full rounded-md px-3 py-2 text-sm outline-none" style={inputStyle} placeholder="5 yrs · 40 listings managed" />
          </div>

          <div className="flex items-center gap-3 pt-1">
            <button type="submit" disabled={saving} className="px-4 py-2 rounded-md text-sm font-medium transition-opacity" style={{ backgroundColor: '#13352F', color: 'white', opacity: saving ? 0.6 : 1 }}>
              {saving ? 'Saving…' : 'Save profile'}
            </button>
            {saved && <span className="text-sm" style={{ color: '#065f46' }}>Saved ✓</span>}
          </div>
        </form>

        {/* Live preview — mirrors the booking confirmation card */}
        <div>
          <h2 className="text-[10px] font-semibold uppercase tracking-widest mb-3" style={{ color: '#9CA3AF' }}>Preview</h2>
          <div className="rounded-lg p-4" style={{ backgroundColor: '#EBEAE6', border: '1px solid #E5E4E0' }}>
            <div className="flex items-center gap-3">
              <img src={form.image || '/default-avatar.png'} alt={form.name ?? ''} className="w-10 h-10 rounded-full object-cover" />
              <div>
                <p className="text-sm font-semibold" style={{ color: '#181915', fontFamily: 'Georgia, "Times New Roman", serif' }}>
                  10:00 AM – 10:15 AM
                </p>
                <p className="text-xs" style={{ color: '#6B7280' }}>
                  Tuesday, July 1{' '}with {form.name || 'You'}
                </p>
              </div>
            </div>

            {hasPreview && (
              <div className="mt-3 pt-3" style={{ borderTop: '1px solid #E5E4E0' }}>
                {form.bio && <p className="text-xs leading-relaxed mb-2" style={{ color: '#4B5563' }}>{form.bio}</p>}
                <div className="flex flex-wrap gap-x-3 gap-y-1">
                  {form.hometown && <span className="text-[11px]" style={{ color: '#6B7280' }}><span style={{ color: '#9CA3AF' }}>From</span> {form.hometown}</span>}
                  {form.basedIn && <span className="text-[11px]" style={{ color: '#6B7280' }}><span style={{ color: '#9CA3AF' }}>Based in</span> {form.basedIn}</span>}
                  {form.strExperience && <span className="text-[11px]" style={{ color: '#6B7280' }}><span style={{ color: '#9CA3AF' }}>STR</span> {form.strExperience}</span>}
                </div>
              </div>
            )}
          </div>
          <p className="text-[11px] mt-3" style={{ color: '#6B7280' }}>
            Empty fields are hidden from visitors — only what you fill in shows on the card.
          </p>
        </div>
      </main>

      {cropFile && (
        <AvatarCropper
          file={cropFile}
          onCancel={() => setCropFile(null)}
          onApply={(dataUrl) => { setForm((f) => ({ ...f, image: dataUrl })); setSaved(false); setCropFile(null); }}
        />
      )}
    </div>
  );
}

/**
 * Lightweight square-avatar cropper. Loads the picked file, lets the rep zoom + drag to
 * frame it, and exports a 256×256 JPEG data URL (~15–25KB) — small enough to live on
 * User.image and be served via /api/hosts without a storage bucket or new dependency.
 */
function AvatarCropper({ file, onApply, onCancel }: { file: File; onApply: (dataUrl: string) => void; onCancel: () => void }) {
  const DISPLAY = 240;
  const OUT = 256;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const drag = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);

  const baseScale = img ? Math.max(DISPLAY / img.width, DISPLAY / img.height) : 1;
  const scale = baseScale * zoom;

  // Keep the image covering the square (no empty gutters).
  const clamp = (o: { x: number; y: number }, s: number) => {
    if (!img) return o;
    const w = img.width * s, h = img.height * s;
    return {
      x: Math.min(0, Math.max(DISPLAY - w, o.x)),
      y: Math.min(0, Math.max(DISPLAY - h, o.y)),
    };
  };

  useEffect(() => {
    const url = URL.createObjectURL(file);
    const im = new Image();
    im.onload = () => {
      const bs = Math.max(DISPLAY / im.width, DISPLAY / im.height);
      setImg(im);
      setZoom(1);
      setOffset({ x: (DISPLAY - im.width * bs) / 2, y: (DISPLAY - im.height * bs) / 2 });
    };
    im.src = url;
    return () => URL.revokeObjectURL(url);
  }, [file]);

  useEffect(() => {
    const c = canvasRef.current;
    if (!c || !img) return;
    const ctx = c.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = '#EBEAE6';
    ctx.fillRect(0, 0, DISPLAY, DISPLAY);
    ctx.drawImage(img, offset.x, offset.y, img.width * scale, img.height * scale);
  }, [img, offset, scale]);

  // Re-clamp when zoom changes so we never expose a gutter.
  useEffect(() => { setOffset((o) => clamp(o, scale)); }, [zoom]); // eslint-disable-line react-hooks/exhaustive-deps

  const onDown = (e: React.PointerEvent) => {
    drag.current = { x: e.clientX, y: e.clientY, ox: offset.x, oy: offset.y };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onMove = (e: React.PointerEvent) => {
    if (!drag.current) return;
    setOffset(clamp({ x: drag.current.ox + (e.clientX - drag.current.x), y: drag.current.oy + (e.clientY - drag.current.y) }, scale));
  };
  const onUp = () => { drag.current = null; };

  const apply = () => {
    if (!img) return;
    const out = document.createElement('canvas');
    out.width = OUT; out.height = OUT;
    const ctx = out.getContext('2d');
    if (!ctx) return;
    const f = OUT / DISPLAY;
    ctx.fillStyle = '#EBEAE6';
    ctx.fillRect(0, 0, OUT, OUT);
    ctx.drawImage(img, offset.x * f, offset.y * f, img.width * scale * f, img.height * scale * f);
    onApply(out.toDataURL('image/jpeg', 0.82));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(24,25,21,0.5)' }}>
      <div className="rounded-xl p-5 w-full max-w-xs" style={{ backgroundColor: '#F5F4F2', border: '1px solid #E5E4E0' }}>
        <h3 className="text-sm font-semibold mb-3" style={{ color: '#181915' }}>Crop your photo</h3>
        <div
          className="relative mx-auto rounded-full overflow-hidden touch-none cursor-move"
          style={{ width: DISPLAY, height: DISPLAY, border: '1px solid #E5E4E0' }}
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerLeave={onUp}
        >
          <canvas ref={canvasRef} width={DISPLAY} height={DISPLAY} />
        </div>
        <div className="flex items-center gap-2 mt-4">
          <span className="text-[11px]" style={{ color: '#9CA3AF' }}>Zoom</span>
          <input type="range" min={1} max={3} step={0.01} value={zoom} onChange={(e) => setZoom(parseFloat(e.target.value))} className="flex-1" />
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <button type="button" onClick={onCancel} className="px-3 py-1.5 rounded-md text-sm" style={{ color: '#6B7280', border: '1px solid #E5E4E0', backgroundColor: 'white' }}>Cancel</button>
          <button type="button" onClick={apply} className="px-3 py-1.5 rounded-md text-sm font-medium" style={{ backgroundColor: '#13352F', color: 'white' }}>Apply</button>
        </div>
      </div>
    </div>
  );
}
