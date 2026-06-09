'use client';

import { useSession } from 'next-auth/react';
import { useEffect, useState } from 'react';
import { redirect } from 'next/navigation';
import AdminHeader from '../AdminHeader';

interface Member {
  id: string;
  name: string | null;
  email: string | null;
  role: 'super_admin' | 'user';
  active: boolean;
  timezone: string;
  connected: boolean;
}

export default function TeamPage() {
  const { data: session, status } = useSession();
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  const patchMember = async (id: string, changes: { role?: string; active?: boolean }) => {
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

        <MemberSection title="Super Admin" members={superAdmins} onPatch={patchMember} currentUserId={(session.user as any).id} />
        <MemberSection title="Users" members={regularUsers} onPatch={patchMember} currentUserId={(session.user as any).id} />

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
    </div>
  );
}

function MemberSection({
  title,
  members,
  onPatch,
  currentUserId,
}: {
  title: string;
  members: Member[];
  onPatch: (id: string, changes: { role?: string; active?: boolean }) => void;
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
              <div className="min-w-0">
                <p className="text-sm font-medium truncate" style={{ color: '#181915' }}>
                  {m.name || m.email}
                  {m.id === currentUserId && <span className="ml-2 text-xs" style={{ color: '#9CA3AF' }}>(you)</span>}
                </p>
                <p className="text-xs truncate" style={{ color: '#6B7280' }}>{m.email}</p>
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
                <select
                  value={m.role}
                  onChange={(e) => onPatch(m.id, { role: e.target.value })}
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
