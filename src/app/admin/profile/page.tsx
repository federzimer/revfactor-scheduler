'use client';

import { useSession } from 'next-auth/react';
import { useEffect, useState } from 'react';
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
            <label className="block text-xs font-medium mb-1" style={{ color: '#4B5563' }}>Photo URL</label>
            <input value={form.image ?? ''} onChange={set('image')} className="w-full rounded-md px-3 py-2 text-sm outline-none" style={inputStyle} placeholder="https://…/photo.jpg" />
            <p className="text-[11px] mt-1" style={{ color: '#9CA3AF' }}>Paste a link to a square headshot. Defaults to your Google photo.</p>
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
    </div>
  );
}
