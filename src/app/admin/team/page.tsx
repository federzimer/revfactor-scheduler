'use client';

import { useSession } from 'next-auth/react';
import { useEffect, useState } from 'react';
import { redirect } from 'next/navigation';
import AdminHeader from '../AdminHeader';
import AvatarCropper from '../AvatarCropper';

interface Member {
  id: string;
  name: string | null;
  email: string | null;
  role: 'super_admin' | 'user';
  active: boolean;
  bookable: boolean;
  timezone: string;
  connected: boolean;
  image: string | null;
  bio: string | null;
  hometown: string | null;
  basedIn: string | null;
  strExperience: string | null;
}

type MemberChanges = Partial<Pick<Member, 'role' | 'active' | 'bookable' | 'name' | 'image' | 'bio' | 'hometown' | 'basedIn' | 'strExperience'>>;

export default function TeamPage() {
  const { data: session, status } = useSession();
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Member | null>(null); // member whose profile is open in the editor

  // Add-user form
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newRole, setNewRole] = useState<'super_admin' | 'user'>('user');
  const [adding, setAdding] = useState(false);

  const role = (session?.user as any)?.role || 'user';

  useEffect(() => {
    if (status === 'unauthenticated') redirect('/admin/login');
    if (status === 'authenticated' && role !== 'super_admin') redirect('/admin');
  }, [status, role]);

  useEffect(() => {
    if (status === 'authenticated' && role === 'super_admin') loadMembers();
  }, [status, role]);

  const loadMembers = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/team');
      const data = await res.json();
      setMembers(data.members || []);
    } catch {
      setError('Failed to load team');
    }
    setLoading(false);
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdding(true);
    setError(null);
    try {
      const res = await fetch('/api/team', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName, email: newEmail, role: newRole }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to add user');
      setMembers((prev) => [...prev, data.member]);
      setNewName('');
      setNewEmail('');
      setNewRole('user');
    } catch (err: any) {
      setError(err.message);
    }
    setAdding(false);
  };

  const patchMember = async (id: string, changes: MemberChanges) => {
    setError(null);
    try {
      const res = await fetch('/api/team', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, ...changes }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Update failed');
      setMembers((prev) => prev.map((m) => (m.id === id ? { ...m, ...data.member } : m)));
    } catch (err: any) {
      setError(err.message);
      throw err; // let the profile modal know the save failed
    }
  };

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#E0DAD1' }}>
        <div className="animate-spin rounded-full h-8 w-8 border-b-2" style={{ borderColor: '#13352F' }}></div>
      </div>
    );
  }
  if (!session || role !== 'super_admin') return null;

  const superAdmins = members.filter((m) => m.role === 'super_admin');
  const regularUsers = members.filter((m) => m.role !== 'super_admin');

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#E0DAD1' }}>
      <AdminHeader />

      <main className="max-w-5xl mx-auto px-4 py-8 space-y-6">
        {error && (
          <div className="rounded-lg px-4 py-3 text-sm" style={{ backgroundColor: '#fef2f2', color: '#b91c1c', border: '1px solid #fca5a5' }}>
            {error}
          </div>
        )}

        <MemberSection title="Super Admin" members={superAdmins} onPatch={patchMember} onEdit={setEditing} currentUserId={(session.user as any).id} />
        <MemberSection title="Users" members={regularUsers} onPatch={patchMember} onEdit={setEditing} currentUserId={(session.user as any).id} />

        {/* Add user */}
        <div className="rounded-xl shadow-sm p-6" style={{ backgroundColor: '#F5F4F2', border: '1px solid #E5E4E0' }}>
          <h2 className="text-[10px] font-semibold uppercase tracking-widest mb-2" style={{ color: '#9CA3AF' }}>Invite</h2>
          <h3 className="text-xl font-semibold mb-1" style={{ color: '#181915', fontFamily: 'Georgia, "Times New Roman", serif' }}>
            Add <span style={{ fontStyle: 'italic', color: '#13352F' }}>User</span>
          </h3>
          <p className="text-sm mb-5" style={{ color: '#6B7280' }}>
            Add a teammate by email. They&apos;ll get access once they sign in with that Google account and connect their calendar.
          </p>
          <form onSubmit={handleAdd} className="flex flex-wrap items-end gap-3">
            <div className="flex-1 min-w-[160px]">
              <label className="block text-xs font-medium mb-1" style={{ color: '#4B5563' }}>Name</label>
              <input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="w-full rounded-md px-3 py-2 text-sm outline-none"
                style={{ backgroundColor: 'white', border: '1px solid #E5E4E0', color: '#181915' }}
                placeholder="Jane Doe"
              />
            </div>
            <div className="flex-1 min-w-[200px]">
              <label className="block text-xs font-medium mb-1" style={{ color: '#4B5563' }}>Email *</label>
              <input
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                type="email"
                required
                className="w-full rounded-md px-3 py-2 text-sm outline-none"
                style={{ backgroundColor: 'white', border: '1px solid #E5E4E0', color: '#181915' }}
                placeholder="jane@blackbirdhm.com"
              />
            </div>
            <div className="min-w-[140px]">
              <label className="block text-xs font-medium mb-1" style={{ color: '#4B5563' }}>Role</label>
              <select
                value={newRole}
                onChange={(e) => setNewRole(e.target.value as 'super_admin' | 'user')}
                className="w-full rounded-md px-3 py-2 text-sm"
                style={{ backgroundColor: 'white', border: '1px solid #E5E4E0', color: '#181915' }}
              >
                <option value="user">User</option>
                <option value="super_admin">Super Admin</option>
              </select>
            </div>
            <button
              type="submit"
              disabled={adding}
              className="text-white px-5 py-2 rounded-md text-sm font-medium disabled:opacity-50 transition-all"
              style={{ backgroundColor: '#13352F' }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#1a453d')}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#13352F')}
            >
              {adding ? 'Adding...' : 'Add User'}
            </button>
          </form>
        </div>
      </main>

      {editing && (
        <ProfileEditModal
          member={editing}
          onClose={() => setEditing(null)}
          onSave={async (changes) => { await patchMember(editing.id, changes); setEditing(null); }}
        />
      )}
    </div>
  );
}

function MemberSection({
  title,
  members,
  onPatch,
  onEdit,
  currentUserId,
}: {
  title: string;
  members: Member[];
  onPatch: (id: string, changes: MemberChanges) => void;
  onEdit: (m: Member) => void;
  currentUserId: string;
}) {
  return (
    <div className="rounded-xl shadow-sm p-6" style={{ backgroundColor: '#F5F4F2', border: '1px solid #E5E4E0' }}>
      <h3 className="text-xl font-semibold mb-4" style={{ color: '#181915', fontFamily: 'Georgia, "Times New Roman", serif' }}>
        {title === 'Super Admin' ? (
          <>Super <span style={{ fontStyle: 'italic', color: '#13352F' }}>Admin</span></>
        ) : (
          <>{title}</>
        )}
      </h3>
      {members.length === 0 ? (
        <p className="text-sm" style={{ color: '#9CA3AF' }}>No {title.toLowerCase()} yet.</p>
      ) : (
        <div className="space-y-2">
          {members.map((m) => (
            <div
              key={m.id}
              className="flex items-center justify-between px-4 py-3 rounded-lg gap-4"
              style={{ backgroundColor: 'white', border: '1px solid #E5E4E0', opacity: m.active ? 1 : 0.6 }}
            >
              <div className="flex items-center gap-3 min-w-0">
                <img src={m.image || '/default-avatar.png'} alt="" className="w-9 h-9 rounded-full object-cover flex-shrink-0" style={{ border: '1px solid #E5E4E0' }} />
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate" style={{ color: '#181915' }}>
                    {m.name || m.email}
                    {m.id === currentUserId && <span className="ml-2 text-xs" style={{ color: '#9CA3AF' }}>(you)</span>}
                  </p>
                  <p className="text-xs truncate" style={{ color: '#6B7280' }}>{m.email}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <span
                  className="text-[10px] px-2 py-0.5 rounded-full font-medium"
                  style={m.connected
                    ? { backgroundColor: '#ecfdf5', color: '#065f46' }
                    : { backgroundColor: '#FEF3C7', color: '#92400E' }}
                  title={m.connected ? 'Has connected Google Calendar' : 'Has not signed in / connected calendar yet'}
                >
                  {m.connected ? 'Connected' : 'Pending sign-in'}
                </span>
                {/* Show in the lead-facing scheduler (independent of admin access) */}
                <button
                  onClick={() => onPatch(m.id, { bookable: !m.bookable })}
                  className="text-xs px-3 py-1 rounded-md font-medium transition-colors"
                  style={m.bookable
                    ? { backgroundColor: '#ecfdf5', border: '1px solid #a7f3d0', color: '#065f46' }
                    : { backgroundColor: 'white', border: '1px solid #E5E4E0', color: '#9CA3AF' }}
                  title={m.bookable ? 'Visible in the scheduler — click to hide' : 'Hidden from the scheduler — click to show'}
                >
                  {m.bookable ? 'In scheduler' : 'Hidden'}
                </button>
                <button
                  onClick={() => onEdit(m)}
                  className="text-xs px-3 py-1 rounded-md font-medium transition-colors"
                  style={{ backgroundColor: 'white', border: '1px solid #E5E4E0', color: '#13352F' }}
                >
                  Edit profile
                </button>
                <select
                  value={m.role}
                  onChange={(e) => onPatch(m.id, { role: e.target.value as 'super_admin' | 'user' })}
                  className="text-xs rounded-md px-2 py-1"
                  style={{ backgroundColor: 'white', border: '1px solid #E5E4E0', color: '#181915' }}
                >
                  <option value="user">User</option>
                  <option value="super_admin">Super Admin</option>
                </select>
                <button
                  onClick={() => onPatch(m.id, { active: !m.active })}
                  className="text-xs px-3 py-1 rounded-md font-medium transition-colors"
                  style={m.active
                    ? { backgroundColor: 'white', border: '1px solid #E5E4E0', color: '#b91c1c' }
                    : { backgroundColor: '#13352F', color: 'white' }}
                >
                  {m.active ? 'Deactivate' : 'Activate'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/** Super-admin editor for another teammate's lead-facing profile (name, photo, bio, location, STR experience). */
function ProfileEditModal({ member, onClose, onSave }: { member: Member; onClose: () => void; onSave: (c: MemberChanges) => Promise<void> }) {
  const [name, setName] = useState(member.name ?? '');
  const [image, setImage] = useState(member.image ?? '');
  const [bio, setBio] = useState(member.bio ?? '');
  const [hometown, setHometown] = useState(member.hometown ?? '');
  const [basedIn, setBasedIn] = useState(member.basedIn ?? '');
  const [strExperience, setStrExperience] = useState(member.strExperience ?? '');
  const [cropFile, setCropFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const onPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    if (!f.type.startsWith('image/')) { setErr('Please choose an image file.'); return; }
    if (f.size > 15 * 1024 * 1024) { setErr('That image is too large (max 15MB).'); return; }
    setErr(null);
    setCropFile(f);
  };

  const save = async () => {
    setSaving(true);
    setErr(null);
    try {
      await onSave({ name, image, bio, hometown, basedIn, strExperience });
    } catch {
      setErr('Could not save. Please try again.');
      setSaving(false);
    }
  };

  const inputStyle = { backgroundColor: 'white', border: '1px solid #E5E4E0', color: '#181915' } as const;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(24,25,21,0.5)' }}>
      <div className="rounded-xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto space-y-4" style={{ backgroundColor: '#F5F4F2', border: '1px solid #E5E4E0' }}>
        <div>
          <h2 className="text-[10px] font-semibold uppercase tracking-widest mb-1" style={{ color: '#9CA3AF' }}>Edit profile</h2>
          <h3 className="text-lg font-semibold" style={{ color: '#181915', fontFamily: 'Georgia, "Times New Roman", serif' }}>
            {member.name || member.email}
          </h3>
          <p className="text-xs" style={{ color: '#6B7280' }}>{member.email}</p>
        </div>

        {err && (
          <div className="rounded-lg px-3 py-2 text-sm" style={{ backgroundColor: '#fef2f2', color: '#b91c1c', border: '1px solid #fca5a5' }}>{err}</div>
        )}

        <div>
          <label className="block text-xs font-medium mb-1" style={{ color: '#4B5563' }}>Photo</label>
          <div className="flex items-center gap-3">
            <img src={image || '/default-avatar.png'} alt="" className="w-16 h-16 rounded-full object-cover" style={{ border: '1px solid #E5E4E0' }} />
            <div className="flex flex-col items-start gap-1.5">
              <label className="cursor-pointer px-3 py-1.5 rounded-md text-sm font-medium" style={{ backgroundColor: 'white', border: '1px solid #E5E4E0', color: '#13352F' }}>
                {image ? 'Change photo' : 'Upload photo'}
                <input type="file" accept="image/*" className="hidden" onChange={onPick} />
              </label>
              {image && (
                <button type="button" onClick={() => setImage('')} className="text-[11px]" style={{ color: '#b91c1c' }}>Remove photo</button>
              )}
            </div>
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium mb-1" style={{ color: '#4B5563' }}>Display name</label>
          <input value={name} onChange={(e) => setName(e.target.value)} className="w-full rounded-md px-3 py-2 text-sm outline-none" style={inputStyle} placeholder="Jane Doe" />
        </div>

        <div>
          <label className="block text-xs font-medium mb-1" style={{ color: '#4B5563' }}>Bio</label>
          <textarea value={bio} onChange={(e) => setBio(e.target.value)} rows={3} className="w-full rounded-md px-3 py-2 text-sm outline-none resize-none" style={inputStyle} placeholder="A sentence or two about them." />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: '#4B5563' }}>From</label>
            <input value={hometown} onChange={(e) => setHometown(e.target.value)} className="w-full rounded-md px-3 py-2 text-sm outline-none" style={inputStyle} placeholder="Buenos Aires" />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: '#4B5563' }}>Based in</label>
            <input value={basedIn} onChange={(e) => setBasedIn(e.target.value)} className="w-full rounded-md px-3 py-2 text-sm outline-none" style={inputStyle} placeholder="Austin, TX" />
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium mb-1" style={{ color: '#4B5563' }}>STR experience</label>
          <input value={strExperience} onChange={(e) => setStrExperience(e.target.value)} className="w-full rounded-md px-3 py-2 text-sm outline-none" style={inputStyle} placeholder="5 yrs · 40 listings managed" />
        </div>

        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onClose} disabled={saving} className="px-4 py-2 rounded-md text-sm" style={{ color: '#6B7280', border: '1px solid #E5E4E0', backgroundColor: 'white' }}>Cancel</button>
          <button type="button" onClick={save} disabled={saving} className="px-4 py-2 rounded-md text-sm font-medium" style={{ backgroundColor: '#13352F', color: 'white', opacity: saving ? 0.6 : 1 }}>
            {saving ? 'Saving…' : 'Save profile'}
          </button>
        </div>
      </div>

      {cropFile && (
        <AvatarCropper
          file={cropFile}
          onCancel={() => setCropFile(null)}
          onApply={(dataUrl) => { setImage(dataUrl); setCropFile(null); }}
        />
      )}
    </div>
  );
}
