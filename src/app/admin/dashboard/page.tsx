'use client';

import { useSession } from 'next-auth/react';
import { Fragment, useEffect, useMemo, useState } from 'react';
import { redirect } from 'next/navigation';
import AdminHeader from '../AdminHeader';

interface Booking {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  hostId: string;
  hostName: string;
  hostTimezone: string; // tz the stored startTime/endTime are expressed in
  visitorName: string;
  visitorEmail: string;
  visitorPhone: string | null;
  visitorAirbnbLink: string | null;
  visitorAddress: string | null;
  visitorNotes: string | null; // the lead's own note from the booking form
  heardAbout: string | null;
  referralName: string | null;
  outcome: string;
  outcomeNote: string | null; // the rep's CRM note
}

const OUTCOMES = [
  { value: 'scheduled', label: 'Scheduled', color: '#6B7280', bg: '#EBEAE6' },
  { value: 'completed', label: 'Completed', color: '#1d4ed8', bg: '#dbeafe' },
  { value: 'no_show', label: 'No-show', color: '#b91c1c', bg: '#fef2f2' },
  { value: 'won', label: 'Won', color: '#065f46', bg: '#ecfdf5' },
  { value: 'lost', label: 'Lost', color: '#92400e', bg: '#fef3c7' },
  { value: 'not_a_fit', label: 'Not a fit', color: '#6b21a8', bg: '#f3e8ff' },
];
const outcomeMeta = (v: string) => OUTCOMES.find((o) => o.value === v) || OUTCOMES[0];

// Booking times are stored in the HOST's timezone. The dashboard normalizes everything to
// Eastern so calls across reps (Central, Mountain, …) are directly comparable.
const EASTERN_TZ = 'America/New_York';

// Offset (minutes, tz − UTC) of a timezone at a given instant. Intl-based so it's correct
// regardless of the browser's own timezone (the server's UTC-only trick breaks in the client).
function tzOffsetMinutes(instant: Date, tz: string): number {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone: tz, hour12: false,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
  const m: Record<string, string> = {};
  for (const p of dtf.formatToParts(instant)) m[p.type] = p.value;
  const asUTC = Date.UTC(+m.year, +m.month - 1, +m.day, +m.hour, +m.minute, +m.second);
  return (asUTC - instant.getTime()) / 60000;
}

// Convert a wall-clock (date + "HH:MM") expressed in `fromTz` into the true UTC instant.
function wallClockToInstant(date: string, time: string, fromTz: string): Date {
  const [Y, Mo, D] = date.split('-').map(Number);
  const [h, mi] = (time || '00:00').split(':').map(Number);
  const guess = Date.UTC(Y, Mo - 1, D, h, mi);
  const offset = tzOffsetMinutes(new Date(guess), fromTz);
  return new Date(guess - offset * 60000);
}

// Render a booking's stored host-tz time as Eastern date + time (both, so a late call that
// crosses midnight into ET shows a consistent date/time pair).
function formatEastern(date: string, time: string, fromTz: string): { date: string; time: string } {
  const instant = wallClockToInstant(date, time, fromTz);
  return {
    date: instant.toLocaleDateString('en-US', { timeZone: EASTERN_TZ, month: 'short', day: 'numeric' }),
    time: instant.toLocaleTimeString('en-US', { timeZone: EASTERN_TZ, hour: 'numeric', minute: '2-digit' }),
  };
}

export default function DashboardPage() {
  const { data: session, status } = useSession();
  const role = (session?.user as any)?.role || 'user';
  const isSuperAdmin = role === 'super_admin';

  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [repFilter, setRepFilter] = useState<string>('all');
  const [outcomeFilter, setOutcomeFilter] = useState<string>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null); // lead whose CRM detail is open
  const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>({}); // unsaved rep-note edits, by booking id
  const [savingNote, setSavingNote] = useState<string | null>(null);

  useEffect(() => {
    if (status === 'unauthenticated') redirect('/admin/login');
  }, [status]);

  useEffect(() => {
    if (status === 'authenticated') loadBookings();
  }, [status]);

  const loadBookings = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/bookings');
      const data = await res.json();
      setBookings(data.bookings || []);
    } catch {
      /* ignore */
    }
    setLoading(false);
  };

  const updateOutcome = async (id: string, outcome: string) => {
    setBookings((prev) => prev.map((b) => (b.id === id ? { ...b, outcome } : b)));
    await fetch(`/api/bookings/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ outcome }),
    });
  };

  const toggleExpand = (b: Booking) => {
    setExpandedId((cur) => (cur === b.id ? null : b.id));
    setNoteDrafts((d) => (d[b.id] === undefined ? { ...d, [b.id]: b.outcomeNote || '' } : d));
  };

  const saveNote = async (id: string) => {
    const note = noteDrafts[id] ?? '';
    setSavingNote(id);
    setBookings((prev) => prev.map((b) => (b.id === id ? { ...b, outcomeNote: note || null } : b)));
    try {
      await fetch(`/api/bookings/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ outcomeNote: note }),
      });
    } finally {
      setSavingNote(null);
    }
  };

  const deleteLead = async (b: Booking) => {
    const et = formatEastern(b.date, b.startTime, b.hostTimezone);
    if (!confirm(`Delete the lead "${b.visitorName}" (${et.date} ${et.time} ET)? This removes the booking and its calendar event. This cannot be undone.`)) return;
    setBookings((prev) => prev.filter((x) => x.id !== b.id));
    const res = await fetch(`/api/bookings/${b.id}`, { method: 'DELETE' });
    if (!res.ok) {
      // restore on failure
      setBookings((prev) => [...prev, b]);
      alert('Could not delete that lead. Please try again.');
    }
  };

  // Per-rep conversion stats
  const reps = useMemo(() => {
    const map = new Map<string, { name: string; total: number; completed: number; no_show: number; won: number; lost: number; not_a_fit: number }>();
    for (const b of bookings) {
      if (!map.has(b.hostId)) map.set(b.hostId, { name: b.hostName, total: 0, completed: 0, no_show: 0, won: 0, lost: 0, not_a_fit: 0 });
      const r = map.get(b.hostId)!;
      r.total += 1;
      if (b.outcome === 'completed') r.completed += 1;
      if (b.outcome === 'no_show') r.no_show += 1;
      if (b.outcome === 'won') r.won += 1;
      if (b.outcome === 'lost') r.lost += 1;
      if (b.outcome === 'not_a_fit') r.not_a_fit += 1;
    }
    return Array.from(map.entries()).map(([id, r]) => {
      const shows = r.completed + r.won + r.lost; // calls where the lead showed
      const convRate = shows > 0 ? Math.round((r.won / shows) * 100) : 0;
      return { id, ...r, shows, convRate };
    });
  }, [bookings]);

  const filtered = useMemo(() => {
    return bookings.filter(
      (b) =>
        (repFilter === 'all' || b.hostId === repFilter) &&
        (outcomeFilter === 'all' || b.outcome === outcomeFilter),
    );
  }, [bookings, repFilter, outcomeFilter]);

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#E0DAD1' }}>
        <div className="animate-spin rounded-full h-8 w-8 border-b-2" style={{ borderColor: '#13352F' }}></div>
      </div>
    );
  }
  if (!session) return null;

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#E0DAD1' }}>
      <AdminHeader />

      <main className="max-w-6xl mx-auto px-4 py-8 space-y-6">
        {/* Per-rep conversion stats */}
        <div>
          <h3 className="text-xl font-semibold mb-4" style={{ color: '#181915', fontFamily: 'Georgia, "Times New Roman", serif' }}>
            {isSuperAdmin ? <>Conversion <span style={{ fontStyle: 'italic', color: '#13352F' }}>by Rep</span></> : <>Your <span style={{ fontStyle: 'italic', color: '#13352F' }}>Numbers</span></>}
          </h3>
          <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))' }}>
            {reps.length === 0 && (
              <p className="text-sm" style={{ color: '#9CA3AF' }}>No calls booked yet.</p>
            )}
            {reps.map((r) => (
              <div key={r.id} className="rounded-xl shadow-sm p-5" style={{ backgroundColor: '#F5F4F2', border: '1px solid #E5E4E0' }}>
                <p className="text-sm font-semibold mb-3 truncate" style={{ color: '#181915' }}>{r.name}</p>
                <div className="flex items-baseline gap-2 mb-3">
                  <span className="text-3xl font-semibold" style={{ color: '#13352F' }}>{r.convRate}%</span>
                  <span className="text-xs" style={{ color: '#6B7280' }}>conversion ({r.won}/{r.shows} shows)</span>
                </div>
                <div className="grid grid-cols-2 gap-y-1 text-xs" style={{ color: '#6B7280' }}>
                  <span>Total calls</span><span className="text-right font-medium" style={{ color: '#181915' }}>{r.total}</span>
                  <span>Won</span><span className="text-right font-medium" style={{ color: '#065f46' }}>{r.won}</span>
                  <span>No-shows</span><span className="text-right font-medium" style={{ color: '#b91c1c' }}>{r.no_show}</span>
                  <span>Lost</span><span className="text-right font-medium" style={{ color: '#92400e' }}>{r.lost}</span>
                  <span>Not a fit</span><span className="text-right font-medium" style={{ color: '#6b21a8' }}>{r.not_a_fit}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Calls table */}
        <div className="rounded-xl shadow-sm p-6" style={{ backgroundColor: '#F5F4F2', border: '1px solid #E5E4E0' }}>
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <h3 className="text-xl font-semibold" style={{ color: '#181915', fontFamily: 'Georgia, "Times New Roman", serif' }}>
              All <span style={{ fontStyle: 'italic', color: '#13352F' }}>Calls</span>
            </h3>
            <div className="flex items-center gap-2">
              {isSuperAdmin && (
                <select
                  value={repFilter}
                  onChange={(e) => setRepFilter(e.target.value)}
                  className="text-xs rounded-md px-3 py-1.5"
                  style={{ backgroundColor: 'white', border: '1px solid #E5E4E0', color: '#181915' }}
                >
                  <option value="all">All reps</option>
                  {reps.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                </select>
              )}
              <select
                value={outcomeFilter}
                onChange={(e) => setOutcomeFilter(e.target.value)}
                className="text-xs rounded-md px-3 py-1.5"
                style={{ backgroundColor: 'white', border: '1px solid #E5E4E0', color: '#181915' }}
              >
                <option value="all">All outcomes</option>
                {OUTCOMES.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
          </div>

          {filtered.length === 0 ? (
            <p className="text-sm" style={{ color: '#9CA3AF' }}>No calls match these filters.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm" style={{ borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #E5E4E0' }}>
                    <th className="py-2 px-2 w-6"></th>
                    {['When', 'Rep', 'Lead', 'Property', 'Source', 'Outcome'].map((h) => (
                      <th key={h} className="text-left py-2 px-2 text-[10px] font-semibold uppercase tracking-widest" style={{ color: '#9CA3AF' }}>{h}</th>
                    ))}
                    {isSuperAdmin && <th className="py-2 px-2"></th>}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((b) => {
                    const m = outcomeMeta(b.outcome);
                    const isOpen = expandedId === b.id;
                    const detailCols = 6 + (isSuperAdmin ? 1 : 0);
                    return (
                      <Fragment key={b.id}>
                      <tr style={{ borderBottom: isOpen ? 'none' : '1px solid #EBEAE6' }}>
                        <td className="py-2.5 px-2 align-top">
                          <button
                            onClick={() => toggleExpand(b)}
                            aria-label={isOpen ? 'Hide details' : 'Show details'}
                            className="transition-transform"
                            style={{ color: '#9CA3AF', transform: isOpen ? 'rotate(90deg)' : 'none' }}
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                          </button>
                        </td>
                        <td className="py-2.5 px-2 whitespace-nowrap" style={{ color: '#181915' }}>
                          {(() => {
                            const et = formatEastern(b.date, b.startTime, b.hostTimezone);
                            return (
                              <>
                                {et.date}
                                <span style={{ color: '#9CA3AF' }}> · {et.time} ET</span>
                              </>
                            );
                          })()}
                        </td>
                        <td className="py-2.5 px-2 whitespace-nowrap" style={{ color: '#4B5563' }}>{b.hostName}</td>
                        <td className="py-2.5 px-2">
                          <div style={{ color: '#181915' }}>{b.visitorName}</div>
                          <a href={`mailto:${b.visitorEmail}`} className="text-xs underline" style={{ color: '#13352F' }}>{b.visitorEmail}</a>
                        </td>
                        <td className="py-2.5 px-2 max-w-[200px]">
                          {b.visitorAirbnbLink ? (
                            <a href={b.visitorAirbnbLink} target="_blank" rel="noreferrer" className="text-xs underline truncate block" style={{ color: '#13352F' }}>Airbnb listing</a>
                          ) : (
                            <span className="text-xs" style={{ color: '#6B7280' }}>{b.visitorAddress || '—'}</span>
                          )}
                        </td>
                        <td className="py-2.5 px-2 whitespace-nowrap text-xs" style={{ color: '#6B7280' }}>
                          {b.heardAbout === 'Referral' && b.referralName ? `Referral: ${b.referralName}` : (b.heardAbout || '—')}
                        </td>
                        <td className="py-2.5 px-2">
                          <select
                            value={b.outcome}
                            onChange={(e) => updateOutcome(b.id, e.target.value)}
                            className="text-xs rounded-md px-2 py-1 font-medium"
                            style={{ backgroundColor: m.bg, color: m.color, border: '1px solid #E5E4E0' }}
                          >
                            {OUTCOMES.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                          </select>
                        </td>
                        {isSuperAdmin && (
                          <td className="py-2.5 px-2 text-right">
                            <button
                              onClick={() => deleteLead(b)}
                              title="Delete this lead (removes the booking and its calendar event)"
                              className="transition-colors"
                              style={{ color: '#C4BFB6' }}
                              onMouseEnter={(e) => (e.currentTarget.style.color = '#b91c1c')}
                              onMouseLeave={(e) => (e.currentTarget.style.color = '#C4BFB6')}
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          </td>
                        )}
                      </tr>

                      {isOpen && (
                        <tr style={{ borderBottom: '1px solid #EBEAE6', backgroundColor: '#FBFAF8' }}>
                          <td></td>
                          <td colSpan={detailCols} className="px-2 pb-4 pt-1 align-top">
                            <div className="grid gap-5 md:grid-cols-2">
                              {/* Contact + context */}
                              <div className="space-y-2 text-xs">
                                <Detail label="Email"><a href={`mailto:${b.visitorEmail}`} className="underline" style={{ color: '#13352F' }}>{b.visitorEmail}</a></Detail>
                                <Detail label="Phone">{b.visitorPhone ? <a href={`tel:${b.visitorPhone}`} className="underline" style={{ color: '#13352F' }}>{b.visitorPhone}</a> : <span style={{ color: '#9CA3AF' }}>—</span>}</Detail>
                                <Detail label="Property">
                                  {b.visitorAirbnbLink
                                    ? <a href={b.visitorAirbnbLink} target="_blank" rel="noreferrer" className="underline break-all" style={{ color: '#13352F' }}>{b.visitorAirbnbLink}</a>
                                    : <span style={{ color: b.visitorAddress ? '#181915' : '#9CA3AF' }}>{b.visitorAddress || '—'}</span>}
                                </Detail>
                                <Detail label="Source">{b.heardAbout === 'Referral' && b.referralName ? `Referral: ${b.referralName}` : (b.heardAbout || '—')}</Detail>
                                <Detail label="Lead's note">
                                  {b.visitorNotes ? <span style={{ color: '#181915' }}>{b.visitorNotes}</span> : <span style={{ color: '#9CA3AF' }}>None left at booking</span>}
                                </Detail>
                              </div>

                              {/* Rep CRM note */}
                              <div>
                                <label className="block text-[10px] font-semibold uppercase tracking-widest mb-1.5" style={{ color: '#9CA3AF' }}>Notes</label>
                                <textarea
                                  value={noteDrafts[b.id] ?? ''}
                                  onChange={(e) => setNoteDrafts((d) => ({ ...d, [b.id]: e.target.value }))}
                                  rows={4}
                                  placeholder="Add a note about this lead — follow-ups, what they need, next steps…"
                                  className="w-full rounded-md px-3 py-2 text-sm outline-none resize-y"
                                  style={{ backgroundColor: 'white', border: '1px solid #E5E4E0', color: '#181915' }}
                                />
                                <div className="flex items-center gap-3 mt-2">
                                  <button
                                    onClick={() => saveNote(b.id)}
                                    disabled={savingNote === b.id || (noteDrafts[b.id] ?? '') === (b.outcomeNote || '')}
                                    className="px-3 py-1.5 rounded-md text-xs font-medium transition-opacity disabled:opacity-40"
                                    style={{ backgroundColor: '#13352F', color: 'white' }}
                                  >
                                    {savingNote === b.id ? 'Saving…' : 'Save note'}
                                  </button>
                                  {(noteDrafts[b.id] ?? '') !== (b.outcomeNote || '') && (
                                    <span className="text-[11px]" style={{ color: '#9CA3AF' }}>Unsaved changes</span>
                                  )}
                                </div>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

// One labeled line in the expanded lead detail panel.
function Detail({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-2">
      <span className="flex-shrink-0 w-20" style={{ color: '#9CA3AF' }}>{label}</span>
      <span className="min-w-0" style={{ color: '#4B5563' }}>{children}</span>
    </div>
  );
}
