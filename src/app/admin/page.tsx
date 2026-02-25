'use client';

import { useSession, signOut } from 'next-auth/react';
import { useEffect, useState } from 'react';
import { redirect } from 'next/navigation';

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const TIME_OPTIONS = Array.from({ length: 48 }, (_, i) => {
  const h = Math.floor(i / 2);
  const m = i % 2 === 0 ? '00' : '30';
  return `${String(h).padStart(2, '0')}:${m}`;
});

interface TimeRange {
  start: string;
  end: string;
}

type DayAvailability = Record<number, TimeRange[]>;

interface DateOverride {
  id: string;
  date: string;
  isBlocked: boolean;
  startTime: string | null;
  endTime: string | null;
}

export default function AdminPage() {
  const { data: session, status } = useSession();
  const [availability, setAvailability] = useState<DayAvailability>({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);

  // Date overrides state
  const [dateOverrides, setDateOverrides] = useState<DateOverride[]>([]);
  const [newOverrideDate, setNewOverrideDate] = useState('');
  const [newOverrideMode, setNewOverrideMode] = useState<'block' | 'custom'>('block');
  const [newOverrideStart, setNewOverrideStart] = useState('09:00');
  const [newOverrideEnd, setNewOverrideEnd] = useState('17:00');
  const [savingOverride, setSavingOverride] = useState(false);

  useEffect(() => {
    if (status === 'unauthenticated') redirect('/admin/login');
  }, [status]);

  useEffect(() => {
    if (status === 'authenticated') {
      // Fetch weekly availability
      fetch('/api/availability')
        .then((r) => r.json())
        .then((data) => {
          const map: DayAvailability = {};
          for (const entry of data.availability || []) {
            if (!map[entry.dayOfWeek]) map[entry.dayOfWeek] = [];
            map[entry.dayOfWeek].push({ start: entry.startTime, end: entry.endTime });
          }
          setAvailability(map);
          setLoading(false);
        })
        .catch(() => setLoading(false));

      // Fetch date overrides
      fetch('/api/date-overrides')
        .then((r) => r.json())
        .then((data) => setDateOverrides(data.overrides || []))
        .catch(() => {});
    }
  }, [status]);

  const toggleDay = (day: number) => {
    setAvailability((prev) => {
      if (prev[day] && prev[day].length > 0) {
        const next = { ...prev };
        delete next[day];
        return next;
      }
      return { ...prev, [day]: [{ start: '09:00', end: '17:00' }] };
    });
    setSaved(false);
  };

  const addRange = (day: number) => {
    setAvailability((prev) => ({
      ...prev,
      [day]: [...(prev[day] || []), { start: '13:00', end: '17:00' }],
    }));
    setSaved(false);
  };

  const removeRange = (day: number, index: number) => {
    setAvailability((prev) => {
      const ranges = [...(prev[day] || [])];
      ranges.splice(index, 1);
      if (ranges.length === 0) {
        const next = { ...prev };
        delete next[day];
        return next;
      }
      return { ...prev, [day]: ranges };
    });
    setSaved(false);
  };

  const updateTime = (day: number, index: number, field: 'start' | 'end', value: string) => {
    setAvailability((prev) => {
      const ranges = [...(prev[day] || [])];
      ranges[index] = { ...ranges[index], [field]: value };
      return { ...prev, [day]: ranges };
    });
    setSaved(false);
  };

  const handleSave = async () => {
    setSaving(true);
    const entries: { dayOfWeek: number; startTime: string; endTime: string }[] = [];
    for (const [day, ranges] of Object.entries(availability)) {
      for (const range of ranges) {
        entries.push({
          dayOfWeek: parseInt(day),
          startTime: range.start,
          endTime: range.end,
        });
      }
    }

    await fetch('/api/availability', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ availability: entries }),
    });

    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const handleAddOverride = async () => {
    if (!newOverrideDate) return;
    setSavingOverride(true);

    const body: any = {
      date: newOverrideDate,
      isBlocked: newOverrideMode === 'block',
    };
    if (newOverrideMode === 'custom') {
      body.startTime = newOverrideStart;
      body.endTime = newOverrideEnd;
    }

    const res = await fetch('/api/date-overrides', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (res.ok) {
      const data = await res.json();
      setDateOverrides((prev) => {
        const existing = prev.findIndex((o) => o.date === data.override.date);
        if (existing >= 0) {
          const next = [...prev];
          next[existing] = data.override;
          return next;
        }
        return [...prev, data.override].sort((a, b) => a.date.localeCompare(b.date));
      });
      setNewOverrideDate('');
    }
    setSavingOverride(false);
  };

  const handleRemoveOverride = async (id: string) => {
    await fetch(`/api/date-overrides?id=${id}`, { method: 'DELETE' });
    setDateOverrides((prev) => prev.filter((o) => o.id !== id));
  };

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#E0DAD1' }}>
        <div className="animate-spin rounded-full h-8 w-8 border-b-2" style={{ borderColor: '#13352F' }}></div>
      </div>
    );
  }

  if (!session) return null;

  const isDayActive = (day: number) => availability[day] && availability[day].length > 0;

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#E0DAD1' }}>
      <header style={{ backgroundColor: '#F5F4F2', borderBottom: '1px solid #E5E4E0' }}>
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold" style={{ color: '#13352F', fontFamily: 'Georgia, "Times New Roman", serif' }}>
              rf.
            </h1>
            <span
              className="px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-widest"
              style={{ backgroundColor: '#13352F', color: 'rgba(255,255,255,0.8)' }}
            >
              Scheduler
            </span>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-sm font-medium" style={{ color: '#181915' }}>{session.user?.name}</p>
              <p className="text-xs" style={{ color: '#6B7280' }}>{session.user?.email}</p>
            </div>
            {session.user?.image && (
              <img src={session.user.image} alt="" className="w-9 h-9 rounded-full" />
            )}
            <button
              onClick={() => signOut({ callbackUrl: '/admin/login' })}
              className="text-sm ml-2 transition-colors"
              style={{ color: '#6B7280' }}
              onMouseEnter={(e) => e.currentTarget.style.color = '#181915'}
              onMouseLeave={(e) => e.currentTarget.style.color = '#6B7280'}
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8">
        {/* Weekly Schedule */}
        <div className="rounded-xl shadow-sm p-6" style={{ backgroundColor: '#F5F4F2', border: '1px solid #E5E4E0' }}>
          <h2 className="text-[10px] font-semibold uppercase tracking-widest mb-2" style={{ color: '#9CA3AF' }}>Manage Availability</h2>
          <h3 className="text-xl font-semibold mb-1" style={{ color: '#181915', fontFamily: 'Georgia, "Times New Roman", serif' }}>
            Weekly <span style={{ fontStyle: 'italic', color: '#13352F' }}>Schedule</span>
          </h3>
          <p className="text-sm mb-6" style={{ color: '#6B7280' }}>
            Toggle days on/off and set your available hours. Add multiple time ranges per day.
          </p>

          <div className="space-y-4">
            {DAYS.map((name, i) => (
              <div key={i} className="py-3" style={{ borderBottom: '1px solid #EBEAE6' }}>
                <div className="flex items-center gap-4">
                  <button
                    onClick={() => toggleDay(i)}
                    className="w-10 h-6 rounded-full relative transition-colors flex-shrink-0"
                    style={{ backgroundColor: isDayActive(i) ? '#13352F' : '#C4BFB6' }}
                  >
                    <span
                      className="absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform"
                      style={{ left: isDayActive(i) ? '18px' : '2px' }}
                    />
                  </button>
                  <span className="w-28 text-sm font-medium" style={{ color: isDayActive(i) ? '#181915' : '#9CA3AF' }}>
                    {name}
                  </span>
                  {!isDayActive(i) && <span className="text-sm" style={{ color: '#9CA3AF' }}>Unavailable</span>}
                </div>

                {isDayActive(i) && (
                  <div className="ml-14 mt-2 space-y-2">
                    {availability[i].map((range, idx) => (
                      <div key={idx} className="flex items-center gap-2">
                        <select
                          value={range.start}
                          onChange={(e) => updateTime(i, idx, 'start', e.target.value)}
                          className="text-sm rounded-md px-3 py-1.5"
                          style={{ backgroundColor: 'white', border: '1px solid #E5E4E0', color: '#181915' }}
                        >
                          {TIME_OPTIONS.map((t) => (
                            <option key={t} value={t}>{formatTimeLabel(t)}</option>
                          ))}
                        </select>
                        <span className="text-sm" style={{ color: '#9CA3AF' }}>to</span>
                        <select
                          value={range.end}
                          onChange={(e) => updateTime(i, idx, 'end', e.target.value)}
                          className="text-sm rounded-md px-3 py-1.5"
                          style={{ backgroundColor: 'white', border: '1px solid #E5E4E0', color: '#181915' }}
                        >
                          {TIME_OPTIONS.map((t) => (
                            <option key={t} value={t}>{formatTimeLabel(t)}</option>
                          ))}
                        </select>
                        {availability[i].length > 1 && (
                          <button
                            onClick={() => removeRange(i, idx)}
                            className="text-sm ml-1 transition-colors"
                            style={{ color: '#C4BFB6' }}
                            onMouseEnter={(e) => e.currentTarget.style.color = '#b91c1c'}
                            onMouseLeave={(e) => e.currentTarget.style.color = '#C4BFB6'}
                            title="Remove this range"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        )}
                      </div>
                    ))}
                    <button
                      onClick={() => addRange(i)}
                      className="text-sm flex items-center gap-1 mt-1 transition-colors"
                      style={{ color: '#13352F' }}
                      onMouseEnter={(e) => e.currentTarget.style.opacity = '0.7'}
                      onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                      Add another range
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="mt-6 flex items-center gap-3">
            <button
              onClick={handleSave}
              disabled={saving}
              className="text-white px-6 py-2 rounded-md text-sm font-medium disabled:opacity-50 transition-all"
              style={{ backgroundColor: '#13352F' }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#1a453d'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#13352F'}
            >
              {saving ? 'Saving...' : 'Save Availability'}
            </button>
            {saved && <span className="text-sm" style={{ color: '#13352F' }}>Saved successfully!</span>}
          </div>
        </div>

        {/* Date Overrides */}
        <div className="mt-6 rounded-xl shadow-sm p-6" style={{ backgroundColor: '#F5F4F2', border: '1px solid #E5E4E0' }}>
          <h2 className="text-[10px] font-semibold uppercase tracking-widest mb-2" style={{ color: '#9CA3AF' }}>Date-Specific</h2>
          <h3 className="text-xl font-semibold mb-1" style={{ color: '#181915', fontFamily: 'Georgia, "Times New Roman", serif' }}>
            Date <span style={{ fontStyle: 'italic', color: '#13352F' }}>Overrides</span>
          </h3>
          <p className="text-sm mb-6" style={{ color: '#6B7280' }}>
            Block off specific dates or set custom hours that override your weekly schedule.
          </p>

          {/* Add new override */}
          <div className="p-4 rounded-lg mb-4" style={{ backgroundColor: '#EBEAE6', border: '1px solid #E5E4E0' }}>
            <div className="flex flex-wrap items-end gap-3">
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: '#4B5563' }}>Date</label>
                <input
                  type="date"
                  value={newOverrideDate}
                  onChange={(e) => setNewOverrideDate(e.target.value)}
                  min={new Date().toISOString().split('T')[0]}
                  className="text-sm rounded-md px-3 py-1.5"
                  style={{ backgroundColor: 'white', border: '1px solid #E5E4E0', color: '#181915' }}
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: '#4B5563' }}>Type</label>
                <select
                  value={newOverrideMode}
                  onChange={(e) => setNewOverrideMode(e.target.value as 'block' | 'custom')}
                  className="text-sm rounded-md px-3 py-1.5"
                  style={{ backgroundColor: 'white', border: '1px solid #E5E4E0', color: '#181915' }}
                >
                  <option value="block">Block off (unavailable)</option>
                  <option value="custom">Custom hours</option>
                </select>
              </div>
              {newOverrideMode === 'custom' && (
                <>
                  <div>
                    <label className="block text-xs font-medium mb-1" style={{ color: '#4B5563' }}>From</label>
                    <select
                      value={newOverrideStart}
                      onChange={(e) => setNewOverrideStart(e.target.value)}
                      className="text-sm rounded-md px-3 py-1.5"
                      style={{ backgroundColor: 'white', border: '1px solid #E5E4E0', color: '#181915' }}
                    >
                      {TIME_OPTIONS.map((t) => (
                        <option key={t} value={t}>{formatTimeLabel(t)}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1" style={{ color: '#4B5563' }}>To</label>
                    <select
                      value={newOverrideEnd}
                      onChange={(e) => setNewOverrideEnd(e.target.value)}
                      className="text-sm rounded-md px-3 py-1.5"
                      style={{ backgroundColor: 'white', border: '1px solid #E5E4E0', color: '#181915' }}
                    >
                      {TIME_OPTIONS.map((t) => (
                        <option key={t} value={t}>{formatTimeLabel(t)}</option>
                      ))}
                    </select>
                  </div>
                </>
              )}
              <button
                onClick={handleAddOverride}
                disabled={!newOverrideDate || savingOverride}
                className="text-white px-4 py-1.5 rounded-md text-sm font-medium disabled:opacity-50 transition-all"
                style={{ backgroundColor: '#13352F' }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#1a453d'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#13352F'}
              >
                {savingOverride ? 'Adding...' : 'Add Override'}
              </button>
            </div>
          </div>

          {/* List of overrides */}
          {dateOverrides.length === 0 ? (
            <p className="text-sm" style={{ color: '#9CA3AF' }}>No date overrides set. Your weekly schedule will be used for all dates.</p>
          ) : (
            <div className="space-y-2">
              {dateOverrides.map((override) => (
                <div
                  key={override.id}
                  className="flex items-center justify-between px-4 py-3 rounded-lg"
                  style={{ backgroundColor: 'white', border: '1px solid #E5E4E0' }}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-medium" style={{ color: '#181915' }}>
                      {new Date(override.date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
                    </span>
                    {override.isBlocked ? (
                      <span className="text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: '#fef2f2', color: '#b91c1c' }}>
                        Blocked
                      </span>
                    ) : (
                      <span className="text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: '#ecfdf5', color: '#065f46' }}>
                        {formatTimeLabel(override.startTime || '')} – {formatTimeLabel(override.endTime || '')}
                      </span>
                    )}
                  </div>
                  <button
                    onClick={() => handleRemoveOverride(override.id)}
                    className="text-sm transition-colors"
                    style={{ color: '#C4BFB6' }}
                    onMouseEnter={(e) => e.currentTarget.style.color = '#b91c1c'}
                    onMouseLeave={(e) => e.currentTarget.style.color = '#C4BFB6'}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Share / Embed */}
        <div className="mt-6 rounded-xl shadow-sm p-6" style={{ backgroundColor: '#F5F4F2', border: '1px solid #E5E4E0' }}>
          <h2 className="text-[10px] font-semibold uppercase tracking-widest mb-1" style={{ color: '#9CA3AF' }}>Share</h2>
          <h3 className="text-lg font-semibold mb-2" style={{ color: '#181915', fontFamily: 'Georgia, "Times New Roman", serif' }}>Booking Page</h3>
          <p className="text-sm mb-3" style={{ color: '#6B7280' }}>Share this link or embed it on your website:</p>
          <code className="block p-3 rounded-md text-sm break-all" style={{ backgroundColor: '#EBEAE6', color: '#4B5563' }}>
            {typeof window !== 'undefined' ? window.location.origin : process.env.NEXT_PUBLIC_APP_URL}/
          </code>
          <p className="text-sm mt-3" style={{ color: '#6B7280' }}>Embed code:</p>
          <code className="block p-3 rounded-md text-sm break-all" style={{ backgroundColor: '#EBEAE6', color: '#4B5563' }}>
            {`<iframe src="${typeof window !== 'undefined' ? window.location.origin : process.env.NEXT_PUBLIC_APP_URL}/embed" width="100%" height="700" frameborder="0"></iframe>`}
          </code>
        </div>
      </main>
    </div>
  );
}

function formatTimeLabel(time: string): string {
  if (!time) return '';
  const [h, m] = time.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  const displayH = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${displayH}:${String(m).padStart(2, '0')} ${period}`;
}
