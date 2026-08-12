'use client';

import { useSession } from 'next-auth/react';
import { Fragment, useEffect, useMemo, useState } from 'react';
import { redirect } from 'next/navigation';
import AdminHeader from '../AdminHeader';
import { FollowUpTemplateKey, getFollowUpTemplates } from '@/lib/follow-up-templates';

interface BookingFollowUp {
  id: string;
  templateKey: FollowUpTemplateKey;
  subject: string;
  status: string;
  sentByName: string | null;
  sentAt: string | null;
}

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
  followUps: BookingFollowUp[];
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
  const [rangeDays, setRangeDays] = useState<number | null>(90); // default to last 90 days; null = all time
  const [expandedId, setExpandedId] = useState<string | null>(null); // lead whose CRM detail is open
  const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>({}); // unsaved rep-note edits, by booking id
  const [savingNote, setSavingNote] = useState<string | null>(null);
  const [emailBooking, setEmailBooking] = useState<Booking | null>(null);

  useEffect(() => {
    if (status === 'unauthenticated') redirect('/admin/login');
  }, [status]);

  useEffect(() => {
    if (status === 'authenticated') loadBookings();
  }, [status, rangeDays]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadBookings = async () => {
    setLoading(true);
    try {
      let url = '/api/bookings';
      if (rangeDays) {
        const from = new Date(Date.now() - rangeDays * 86_400_000).toISOString().split('T')[0];
        url += `?from=${from}`;
      }
      const res = await fetch(url);
      const data = await res.json();
      setBookings(data.bookings || []);
    } catch {
      /* ignore */
    }
    setLoading(false);
  };

  const updateOutcome = async (id: string, outcome: string) => {
    const previous = bookings.find((b) => b.id === id)?.outcome || 'scheduled';
    setBookings((prev) => prev.map((b) => (b.id === id ? { ...b, outcome } : b)));
    try {
      const res = await fetch(`/api/bookings/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ outcome }),
      });
      if (!res.ok) throw new Error();
      if (outcome === 'completed') {
        const booking = bookings.find((b) => b.id === id);
        if (booking) {
          setExpandedId(id);
          setNoteDrafts((drafts) => (drafts[id] === undefined ? { ...drafts, [id]: booking.outcomeNote || '' } : drafts));
        }
      }
    } catch {
      setBookings((prev) => prev.map((b) => (b.id === id ? { ...b, outcome: previous } : b)));
      alert('Could not update the call outcome. Please try again.');
    }
  };

  const recordFollowUp = (bookingId: string, followUp: BookingFollowUp) => {
    setBookings((prev) => prev.map((booking) => (
      booking.id === bookingId
        ? { ...booking, followUps: [followUp, ...(booking.followUps || [])].slice(0, 5) }
        : booking
    )));
    setEmailBooking(null);
  };

  const toggleExpand = (b: Booking) => {
    setExpandedId((cur) => (cur === b.id ? null : b.id));
    setNoteDrafts((d) => (d[b.id] === undefined ? { ...d, [b.id]: b.outcomeNote || '' } : d));
  };

  const saveNote = async (id: string) => {
    const note = noteDrafts[id] ?? '';
    const prevNote = bookings.find((b) => b.id === id)?.outcomeNote ?? null;
    setSavingNote(id);
    setBookings((prev) => prev.map((b) => (b.id === id ? { ...b, outcomeNote: note || null } : b)));
    try {
      const res = await fetch(`/api/bookings/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ outcomeNote: note }),
      });
      if (!res.ok) throw new Error();
    } catch {
      // Roll back the optimistic update so the UI doesn't show an unsaved note as saved.
      setBookings((prev) => prev.map((b) => (b.id === id ? { ...b, outcomeNote: prevNote } : b)));
      setNoteDrafts((d) => ({ ...d, [id]: prevNote || '' }));
      alert('Could not save the note. Please try again.');
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
              <select
                value={rangeDays === null ? 'all' : String(rangeDays)}
                onChange={(e) => setRangeDays(e.target.value === 'all' ? null : Number(e.target.value))}
                className="text-xs rounded-md px-3 py-1.5"
                style={{ backgroundColor: 'white', border: '1px solid #E5E4E0', color: '#181915' }}
                title="Date range (also scopes the conversion stats above)"
              >
                <option value="90">Last 90 days</option>
                <option value="180">Last 6 months</option>
                <option value="365">Last 12 months</option>
                <option value="all">All time</option>
              </select>
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
                        <tr style={{ backgroundColor: '#FBFAF8', borderBottom: '1px solid #EBEAE6' }}>
                          <td colSpan={isSuperAdmin ? 8 : 7} className="p-0">
                            {/* 2pt ink ruler ties the panel to its row; flush-left grid, hairline-ruled data, white space carries hierarchy. */}
                            <div className="sticky left-0 w-[calc(100vw-5rem)] px-5 py-6 md:static md:w-auto" style={{ borderTop: '2px solid #13352F' }}>
                              <div className="grid gap-x-14 gap-y-8 md:grid-cols-[1.05fr_0.95fr]">
                                {/* Lead detail — data hangs from hairline rulers */}
                                <div>
                                  <h5 className="text-[10px] font-semibold uppercase tracking-[0.18em] mb-2" style={{ color: '#13352F' }}>Lead detail</h5>
                                  <dl>
                                    <Field label="Email"><DetailLink href={`mailto:${b.visitorEmail}`}>{b.visitorEmail}</DetailLink></Field>
                                    <Field label="Phone">{b.visitorPhone ? <DetailLink href={`tel:${b.visitorPhone}`}>{b.visitorPhone}</DetailLink> : <Muted>—</Muted>}</Field>
                                    <Field label="Property">
                                      {b.visitorAirbnbLink
                                        ? <DetailLink href={b.visitorAirbnbLink} external className="break-all">{b.visitorAirbnbLink}</DetailLink>
                                        : (b.visitorAddress || <Muted>—</Muted>)}
                                    </Field>
                                    <Field label="Source">{b.heardAbout === 'Referral' && b.referralName ? `Referral: ${b.referralName}` : (b.heardAbout || <Muted>—</Muted>)}</Field>
                                    <Field label="Their note">{b.visitorNotes || <Muted>None left at booking</Muted>}</Field>
                                  </dl>
                                </div>

                                {/* Rep notes */}
                                <div>
                                  <h5 className="text-[10px] font-semibold uppercase tracking-[0.18em] mb-2" style={{ color: '#13352F' }}>Rep notes</h5>
                                  <div className="pt-2.5" style={{ borderTop: '1px solid #EAE8E3' }}>
                                    <textarea
                                      value={noteDrafts[b.id] ?? ''}
                                      onChange={(e) => setNoteDrafts((d) => ({ ...d, [b.id]: e.target.value }))}
                                      rows={5}
                                      placeholder="Follow-ups, what they need, next steps…"
                                      className="w-full rounded-lg px-3.5 py-2.5 text-[13px] leading-relaxed outline-none resize-y"
                                      style={{ backgroundColor: 'white', border: '1px solid #E5E4E0', color: '#181915' }}
                                    />
                                    <div className="flex items-center gap-3 mt-2.5">
                                      <button
                                        onClick={() => saveNote(b.id)}
                                        disabled={savingNote === b.id || (noteDrafts[b.id] ?? '') === (b.outcomeNote || '')}
                                        className="px-4 py-1.5 rounded-md text-xs font-medium transition-opacity disabled:opacity-40"
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
                              </div>

                              {b.outcome === 'completed' && (
                                <div className="mt-7 pt-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between" style={{ borderTop: '1px solid #D8D4CC' }}>
                                  <div>
                                    <h5 className="text-[10px] font-semibold uppercase tracking-[0.18em]" style={{ color: '#13352F' }}>Post-call follow-up</h5>
                                    {b.followUps?.length ? (
                                      <p className="text-xs mt-1" style={{ color: '#6B7280' }}>
                                        Last sent {formatSentAt(b.followUps[0].sentAt)}{b.followUps[0].sentByName ? ` by ${b.followUps[0].sentByName}` : ''}
                                        {' · '}{b.followUps[0].subject}
                                      </p>
                                    ) : (
                                      <p className="text-xs mt-1" style={{ color: '#6B7280' }}>No follow-up email has been sent for this call.</p>
                                    )}
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => setEmailBooking(b)}
                                    className="px-4 py-2 rounded-md text-sm font-medium flex items-center justify-center gap-2 flex-shrink-0"
                                    style={{ backgroundColor: '#A33A3A', color: 'white' }}
                                  >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8m-18 8V6a2 2 0 012-2h14a2 2 0 012 2v10a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
                                    </svg>
                                    {b.followUps?.length ? 'Send another email' : 'Send follow-up email'}
                                  </button>
                                </div>
                              )}
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

      {emailBooking && (
        <FollowUpComposer
          key={emailBooking.id}
          booking={emailBooking}
          agentName={session.user?.name || 'RevFactor'}
          onClose={() => setEmailBooking(null)}
          onSent={(followUp) => recordFollowUp(emailBooking.id, followUp)}
        />
      )}
    </div>
  );
}

function formatSentAt(value: string | null) {
  if (!value) return 'recently';
  return new Date(value).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function FollowUpComposer({
  booking,
  agentName,
  onClose,
  onSent,
}: {
  booking: Booking;
  agentName: string;
  onClose: () => void;
  onSent: (followUp: BookingFollowUp) => void;
}) {
  const templates = getFollowUpTemplates({ leadName: booking.visitorName, agentName });
  const [selectedKey, setSelectedKey] = useState<FollowUpTemplateKey>('subscribe');
  const initial = templates[0];
  const [subject, setSubject] = useState(initial.subject);
  const [message, setMessage] = useState(initial.body);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const chooseTemplate = (key: FollowUpTemplateKey) => {
    const template = templates.find((item) => item.key === key)!;
    setSelectedKey(key);
    setSubject(template.subject);
    setMessage(template.body);
    setError(null);
  };

  const send = async () => {
    if (!subject.trim() || !message.trim()) {
      setError('Add a subject and message before sending.');
      return;
    }
    if (message.includes('[Add ')) {
      setError('Replace the bracketed notes with the answers or questions from the call.');
      return;
    }

    setSending(true);
    setError(null);
    try {
      const res = await fetch(`/api/bookings/${booking.id}/follow-up`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ templateKey: selectedKey, subject, message }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'The email could not be sent.');
      onSent(data.followUp);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The email could not be sent.');
      setSending(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(11, 42, 37, 0.72)' }}
      role="presentation"
      onMouseDown={(event) => { if (event.currentTarget === event.target && !sending) onClose(); }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="follow-up-title"
        className="w-full max-w-3xl max-h-[92vh] flex flex-col overflow-hidden rounded-lg shadow-2xl"
        style={{ backgroundColor: '#F9F8F5', border: '1px solid #D8D4CC' }}
      >
        <header className="px-6 py-5 flex-shrink-0 flex items-start justify-between gap-4" style={{ borderBottom: '1px solid #D8D4CC' }}>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] mb-1" style={{ color: '#A33A3A' }}>Post-call email</p>
            <h3 id="follow-up-title" className="text-2xl font-semibold" style={{ color: '#173A33', fontFamily: 'Georgia, "Times New Roman", serif' }}>
              Follow up with {booking.visitorName}
            </h3>
            <p className="text-sm mt-1" style={{ color: '#6B7280' }}>{booking.visitorEmail}</p>
          </div>
          <button type="button" onClick={onClose} disabled={sending} aria-label="Close email composer" className="p-2 rounded-md" style={{ color: '#6B7280' }}>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </header>

        <div className="p-6 space-y-5 overflow-y-auto">
          <fieldset>
            <legend className="text-xs font-semibold mb-2" style={{ color: '#173A33' }}>Choose a starting template</legend>
            <div className="grid gap-2 sm:grid-cols-3">
              {templates.map((template) => {
                const active = selectedKey === template.key;
                return (
                  <button
                    key={template.key}
                    type="button"
                    onClick={() => chooseTemplate(template.key)}
                    className="text-left p-3 rounded-md min-h-[88px]"
                    style={{
                      backgroundColor: active ? '#E8EEE9' : 'white',
                      border: active ? '1px solid #24584D' : '1px solid #D8D4CC',
                    }}
                  >
                    <span className="block text-sm font-semibold" style={{ color: '#173A33' }}>{template.label}</span>
                    <span className="block text-xs mt-1 leading-relaxed" style={{ color: '#6B7280' }}>{template.description}</span>
                  </button>
                );
              })}
            </div>
          </fieldset>

          <div>
            <label htmlFor="follow-up-subject" className="block text-xs font-semibold mb-1.5" style={{ color: '#173A33' }}>Subject</label>
            <input
              id="follow-up-subject"
              value={subject}
              onChange={(event) => setSubject(event.target.value)}
              maxLength={160}
              className="w-full rounded-md px-3.5 py-2.5 text-sm outline-none"
              style={{ backgroundColor: 'white', border: '1px solid #CFCAC1', color: '#181915' }}
            />
          </div>

          <div>
            <label htmlFor="follow-up-message" className="block text-xs font-semibold mb-1.5" style={{ color: '#173A33' }}>Message</label>
            <textarea
              id="follow-up-message"
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              rows={14}
              maxLength={10_000}
              className="w-full rounded-md px-3.5 py-3 text-sm leading-relaxed outline-none resize-y"
              style={{ backgroundColor: 'white', border: '1px solid #CFCAC1', color: '#181915' }}
            />
          </div>

          {error && (
            <div className="px-3.5 py-2.5 rounded-md text-sm" role="alert" style={{ backgroundColor: '#F8EAEA', border: '1px solid #E7B8B8', color: '#8C2F2F' }}>
              {error}
            </div>
          )}
        </div>

        <footer className="px-6 py-4 flex-shrink-0 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between" style={{ borderTop: '1px solid #D8D4CC', backgroundColor: '#F3F1ED' }}>
          <p className="text-xs" style={{ color: '#6B7280' }}>From no-reply@revfactor.io · replies go to {agentName}</p>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={onClose} disabled={sending} className="px-4 py-2 rounded-md text-sm" style={{ backgroundColor: 'white', border: '1px solid #CFCAC1', color: '#4B5563' }}>Cancel</button>
            <button type="button" onClick={send} disabled={sending} className="px-4 py-2 rounded-md text-sm font-semibold min-w-[112px]" style={{ backgroundColor: '#A33A3A', color: 'white', opacity: sending ? 0.65 : 1 }}>
              {sending ? 'Sending…' : 'Send email'}
            </button>
          </div>
        </footer>
      </section>
    </div>
  );
}

// One field in the expanded lead detail panel: a micro uppercase label and its value,
// hanging from a hairline ruler (Vignelli discipline — aligned label column, two type sizes).
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[84px_1fr] gap-4 py-2.5" style={{ borderTop: '1px solid #EAE8E3' }}>
      <dt className="text-[10px] font-semibold uppercase tracking-[0.14em] pt-0.5" style={{ color: '#9CA3AF' }}>{label}</dt>
      <dd className="text-[13px] leading-relaxed min-w-0" style={{ color: '#181915' }}>{children}</dd>
    </div>
  );
}

// Link in ink, underline on hover only (restraint — not every value shouts).
function DetailLink({ href, external, className = '', children }: { href: string; external?: boolean; className?: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      {...(external ? { target: '_blank', rel: 'noreferrer' } : {})}
      className={`hover:underline ${className}`}
      style={{ color: '#13352F' }}
    >
      {children}
    </a>
  );
}

function Muted({ children }: { children: React.ReactNode }) {
  return <span style={{ color: '#9CA3AF' }}>{children}</span>;
}
