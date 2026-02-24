'use client';

import { useSession, signOut } from 'next-auth/react';
import { useEffect, useState } from 'react';
import { redirect } from 'next/navigation';

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const HOURS = Array.from({ length: 24 }, (_, i) => `${String(i).padStart(2, '0')}:00`);
const TIME_OPTIONS = Array.from({ length: 48 }, (_, i) => {
  const h = Math.floor(i / 2);
  const m = i % 2 === 0 ? '00' : '30';
  return `${String(h).padStart(2, '0')}:${m}`;
});

interface AvailabilityEntry {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
}

export default function AdminPage() {
  const { data: session, status } = useSession();
  const [availability, setAvailability] = useState<Record<number, { start: string; end: string } | null>>({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (status === 'unauthenticated') redirect('/admin/login');
  }, [status]);

  useEffect(() => {
    if (status === 'authenticated') {
      fetch('/api/availability')
        .then((r) => r.json())
        .then((data) => {
          const map: Record<number, { start: string; end: string } | null> = {};
          for (const entry of data.availability || []) {
            map[entry.dayOfWeek] = { start: entry.startTime, end: entry.endTime };
          }
          setAvailability(map);
          setLoading(false);
        })
        .catch(() => setLoading(false));
    }
  }, [status]);

  const toggleDay = (day: number) => {
    setAvailability((prev) => {
      if (prev[day]) {
        const next = { ...prev };
        delete next[day];
        return next;
      }
      return { ...prev, [day]: { start: '09:00', end: '17:00' } };
    });
    setSaved(false);
  };

  const updateTime = (day: number, field: 'start' | 'end', value: string) => {
    setAvailability((prev) => ({
      ...prev,
      [day]: { ...prev[day]!, [field]: value },
    }));
    setSaved(false);
  };

  const handleSave = async () => {
    setSaving(true);
    const entries: AvailabilityEntry[] = Object.entries(availability)
      .filter(([_, val]) => val !== null)
      .map(([day, val]) => ({
        dayOfWeek: parseInt(day),
        startTime: val!.start,
        endTime: val!.end,
      }));

    await fetch('/api/availability', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ availability: entries }),
    });

    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!session) return null;

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900">RevFactor Scheduler</h1>
            <p className="text-sm text-gray-500">Manage your availability</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-sm font-medium text-gray-900">{session.user?.name}</p>
              <p className="text-xs text-gray-500">{session.user?.email}</p>
            </div>
            {session.user?.image && (
              <img src={session.user.image} alt="" className="w-9 h-9 rounded-full" />
            )}
            <button
              onClick={() => signOut({ callbackUrl: '/admin/login' })}
              className="text-sm text-gray-500 hover:text-gray-700 ml-2"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-1">Weekly Availability</h2>
          <p className="text-sm text-gray-500 mb-6">
            Toggle days on/off and set your available hours for each day. Visitors can book 15-minute calls during these windows.
          </p>

          <div className="space-y-3">
            {DAYS.map((name, i) => (
              <div key={i} className="flex items-center gap-4 py-3 border-b border-gray-100 last:border-0">
                <button
                  onClick={() => toggleDay(i)}
                  className={`w-10 h-6 rounded-full relative transition-colors ${
                    availability[i] ? 'bg-blue-600' : 'bg-gray-300'
                  }`}
                >
                  <span
                    className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                      availability[i] ? 'left-[18px]' : 'left-0.5'
                    }`}
                  />
                </button>
                <span className={`w-28 text-sm font-medium ${availability[i] ? 'text-gray-900' : 'text-gray-400'}`}>
                  {name}
                </span>
                {availability[i] ? (
                  <div className="flex items-center gap-2">
                    <select
                      value={availability[i]!.start}
                      onChange={(e) => updateTime(i, 'start', e.target.value)}
                      className="text-sm border border-gray-300 rounded-lg px-3 py-1.5 bg-white"
                    >
                      {TIME_OPTIONS.map((t) => (
                        <option key={t} value={t}>{formatTimeLabel(t)}</option>
                      ))}
                    </select>
                    <span className="text-gray-400">to</span>
                    <select
                      value={availability[i]!.end}
                      onChange={(e) => updateTime(i, 'end', e.target.value)}
                      className="text-sm border border-gray-300 rounded-lg px-3 py-1.5 bg-white"
                    >
                      {TIME_OPTIONS.map((t) => (
                        <option key={t} value={t}>{formatTimeLabel(t)}</option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <span className="text-sm text-gray-400">Unavailable</span>
                )}
              </div>
            ))}
          </div>

          <div className="mt-6 flex items-center gap-3">
            <button
              onClick={handleSave}
              disabled={saving}
              className="bg-blue-600 text-white px-6 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {saving ? 'Saving...' : 'Save Availability'}
            </button>
            {saved && <span className="text-sm text-green-600">Saved successfully!</span>}
          </div>
        </div>

        <div className="mt-6 bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-2">Booking Page</h2>
          <p className="text-sm text-gray-500 mb-3">Share this link or embed it on your website:</p>
          <code className="block bg-gray-100 p-3 rounded-lg text-sm text-gray-700 break-all">
            {typeof window !== 'undefined' ? window.location.origin : process.env.NEXT_PUBLIC_APP_URL}/
          </code>
          <p className="text-sm text-gray-500 mt-3">Embed code:</p>
          <code className="block bg-gray-100 p-3 rounded-lg text-sm text-gray-700 break-all">
            {`<iframe src="${typeof window !== 'undefined' ? window.location.origin : process.env.NEXT_PUBLIC_APP_URL}/embed" width="100%" height="700" frameborder="0"></iframe>`}
          </code>
        </div>
      </main>
    </div>
  );
}

function formatTimeLabel(time: string): string {
  const [h, m] = time.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  const displayH = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${displayH}:${String(m).padStart(2, '0')} ${period}`;
}
