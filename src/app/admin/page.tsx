'use client';

import { useSession } from 'next-auth/react';
import { useEffect, useState, useMemo } from 'react';
import { redirect } from 'next/navigation';
import AdminHeader from './AdminHeader';
import CalendarConnectionCard from './CalendarConnectionCard';

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const SHORT_DAYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
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

  // Calendar navigation
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });

  // Date override modal
  const [modalDate, setModalDate] = useState<string | null>(null);
  const [modalMode, setModalMode] = useState<'block' | 'custom'>('block');
  const [modalStart, setModalStart] = useState('09:00');
  const [modalEnd, setModalEnd] = useState('17:00');
  const [savingOverride, setSavingOverride] = useState(false);

  // Settings
  const [maxAdvanceDays, setMaxAdvanceDays] = useState(30);
  const [timezone, setTimezone] = useState('America/New_York');
  const [minBufferHours, setMinBufferHours] = useState(2);
  const [savingSettings, setSavingSettings] = useState(false);
  const [savedSettings, setSavedSettings] = useState(false);

  // Calendar view toggle
  const [calendarView, setCalendarView] = useState<'list' | 'calendar'>('calendar');

  useEffect(() => {
    if (status === 'unauthenticated') redirect('/admin/login');
  }, [status]);

  useEffect(() => {
    if (status === 'authenticated') {
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

      fetch('/api/date-overrides')
        .then((r) => r.json())
        .then((data) => setDateOverrides(data.overrides || []))
        .catch(() => {});

      fetch('/api/admin-settings')
        .then((r) => r.json())
        .then((data) => {
          setMaxAdvanceDays(data.maxAdvanceDays ?? 30);
          setTimezone(data.timezone ?? 'America/New_York');
          setMinBufferHours(data.minBufferHours ?? 2);
        })
        .catch(() => {});
    }
  }, [status]);

  // Calendar data
  const calendarDays = useMemo(() => {
    const year = calendarMonth.getFullYear();
    const month = calendarMonth.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const days: (number | null)[] = [];
    for (let i = 0; i < firstDay; i++) days.push(null);
    for (let i = 1; i <= daysInMonth; i++) days.push(i);
    // Pad to complete the last week
    while (days.length % 7 !== 0) days.push(null);
    return days;
  }, [calendarMonth]);

  const getDateStr = (day: number) => {
    const y = calendarMonth.getFullYear();
    const m = calendarMonth.getMonth() + 1;
    return `${y}-${String(m).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  };

  const getOverrideForDate = (dateStr: string) => {
    return dateOverrides.find((o) => o.date === dateStr);
  };

  const getDayAvailForDate = (day: number) => {
    const date = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), day);
    const dow = date.getDay();
    return availability[dow] || [];
  };

  const isDatePast = (day: number) => {
    const date = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), day);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return date <= today;
  };

  const isToday = (day: number) => {
    const now = new Date();
    return (
      calendarMonth.getFullYear() === now.getFullYear() &&
      calendarMonth.getMonth() === now.getMonth() &&
      day === now.getDate()
    );
  };

  // Weekly schedule handlers
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

  // Date override handlers
  const openOverrideModal = (dateStr: string) => {
    const existing = getOverrideForDate(dateStr);
    if (existing) {
      setModalMode(existing.isBlocked ? 'block' : 'custom');
      setModalStart(existing.startTime || '09:00');
      setModalEnd(existing.endTime || '17:00');
    } else {
      setModalMode('block');
      setModalStart('09:00');
      setModalEnd('17:00');
    }
    setModalDate(dateStr);
  };

  const handleSaveOverride = async () => {
    if (!modalDate) return;
    setSavingOverride(true);

    const body: any = {
      date: modalDate,
      isBlocked: modalMode === 'block',
    };
    if (modalMode === 'custom') {
      body.startTime = modalStart;
      body.endTime = modalEnd;
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
    }
    setSavingOverride(false);
    setModalDate(null);
  };

  const handleRemoveOverride = async (dateStr: string) => {
    const override = getOverrideForDate(dateStr);
    if (!override) return;
    await fetch(`/api/date-overrides?id=${override.id}`, { method: 'DELETE' });
    setDateOverrides((prev) => prev.filter((o) => o.id !== override.id));
    setModalDate(null);
  };

  const handleSaveSettings = async () => {
    setSavingSettings(true);
    await fetch('/api/admin-settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ maxAdvanceDays, timezone, minBufferHours }),
    });
    setSavingSettings(false);
    setSavedSettings(true);
    setTimeout(() => setSavedSettings(false), 3000);
  };

  const prevMonth = () => {
    setCalendarMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  };
  const nextMonth = () => {
    setCalendarMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  };

  const monthLabel = calendarMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

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
      <AdminHeader />

      <main className="max-w-5xl mx-auto px-4 py-8 space-y-6">
        {/* Google Calendar connection — surfaced first so a disconnected host can't miss it */}
        <CalendarConnectionCard />

        {/* Booking Settings */}
        <div className="rounded-xl shadow-sm p-6" style={{ backgroundColor: '#F5F4F2', border: '1px solid #E5E4E0' }}>
          <h2 className="text-[10px] font-semibold uppercase tracking-widest mb-2" style={{ color: '#9CA3AF' }}>Settings</h2>
          <h3 className="text-xl font-semibold mb-1" style={{ color: '#181915', fontFamily: 'Georgia, "Times New Roman", serif' }}>
            Booking <span style={{ fontStyle: 'italic', color: '#13352F' }}>Settings</span>
          </h3>
          <p className="text-sm mb-5" style={{ color: '#6B7280' }}>
            Configure your timezone, advance booking limits, and minimum buffer time.
          </p>

          <div className="space-y-4">
            {/* Timezone */}
            <div className="flex items-center gap-3">
              <label className="text-sm font-medium w-40" style={{ color: '#181915' }}>Your timezone</label>
              <select
                value={timezone}
                onChange={(e) => { setTimezone(e.target.value); setSavedSettings(false); }}
                className="text-sm rounded-md px-3 py-1.5"
                style={{ backgroundColor: 'white', border: '1px solid #E5E4E0', color: '#181915' }}
              >
                <option value="America/New_York">Eastern (ET)</option>
                <option value="America/Chicago">Central (CT)</option>
                <option value="America/Denver">Mountain (MT)</option>
                <option value="America/Los_Angeles">Pacific (PT)</option>
                <option value="America/Phoenix">Arizona (no DST)</option>
                <option value="America/Anchorage">Alaska (AKT)</option>
                <option value="Pacific/Honolulu">Hawaii (HT)</option>
                <option value="America/Puerto_Rico">Atlantic (AST)</option>
              </select>
            </div>

            {/* Max advance days */}
            <div className="flex items-center gap-3">
              <label className="text-sm font-medium w-40" style={{ color: '#181915' }}>Allow bookings up to</label>
              <select
                value={maxAdvanceDays}
                onChange={(e) => { setMaxAdvanceDays(parseInt(e.target.value)); setSavedSettings(false); }}
                className="text-sm rounded-md px-3 py-1.5"
                style={{ backgroundColor: 'white', border: '1px solid #E5E4E0', color: '#181915' }}
              >
                <option value={7}>1 week</option>
                <option value={14}>2 weeks</option>
                <option value={30}>1 month</option>
                <option value={60}>2 months</option>
                <option value={90}>3 months</option>
                <option value={180}>6 months</option>
                <option value={365}>1 year</option>
              </select>
              <label className="text-sm" style={{ color: '#6B7280' }}>in advance</label>
            </div>

            {/* Minimum buffer */}
            <div className="flex items-center gap-3">
              <label className="text-sm font-medium w-40" style={{ color: '#181915' }}>Minimum buffer</label>
              <select
                value={minBufferHours}
                onChange={(e) => { setMinBufferHours(parseInt(e.target.value)); setSavedSettings(false); }}
                className="text-sm rounded-md px-3 py-1.5"
                style={{ backgroundColor: 'white', border: '1px solid #E5E4E0', color: '#181915' }}
              >
                <option value={0}>No buffer</option>
                <option value={1}>1 hour</option>
                <option value={2}>2 hours</option>
                <option value={4}>4 hours</option>
                <option value={8}>8 hours</option>
                <option value={24}>24 hours</option>
                <option value={48}>48 hours</option>
              </select>
              <label className="text-sm" style={{ color: '#6B7280' }}>before a slot can be booked</label>
            </div>

            <div className="flex items-center gap-3 pt-1">
              <button
                onClick={handleSaveSettings}
                disabled={savingSettings}
                className="text-white px-4 py-1.5 rounded-md text-sm font-medium disabled:opacity-50 transition-all"
                style={{ backgroundColor: '#13352F' }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#1a453d'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#13352F'}
              >
                {savingSettings ? 'Saving...' : 'Save Settings'}
              </button>
              {savedSettings && <span className="text-sm" style={{ color: '#13352F' }}>Saved!</span>}
            </div>
          </div>
        </div>

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

        {/* Date Overrides — Calendly-style Calendar */}
        <div className="rounded-xl shadow-sm p-6" style={{ backgroundColor: '#F5F4F2', border: '1px solid #E5E4E0' }}>
          <div className="flex items-center justify-between mb-1">
            <div>
              <h2 className="text-[10px] font-semibold uppercase tracking-widest mb-2" style={{ color: '#9CA3AF' }}>Date-Specific</h2>
              <h3 className="text-xl font-semibold" style={{ color: '#181915', fontFamily: 'Georgia, "Times New Roman", serif' }}>
                Date <span style={{ fontStyle: 'italic', color: '#13352F' }}>Overrides</span>
              </h3>
            </div>
            <div className="flex items-center rounded-lg overflow-hidden" style={{ border: '1px solid #E5E4E0' }}>
              <button
                onClick={() => setCalendarView('list')}
                className="px-3 py-1.5 text-xs font-medium flex items-center gap-1.5 transition-colors"
                style={{
                  backgroundColor: calendarView === 'list' ? 'white' : 'transparent',
                  color: calendarView === 'list' ? '#181915' : '#9CA3AF',
                }}
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                </svg>
                List
              </button>
              <button
                onClick={() => setCalendarView('calendar')}
                className="px-3 py-1.5 text-xs font-medium flex items-center gap-1.5 transition-colors"
                style={{
                  backgroundColor: calendarView === 'calendar' ? 'white' : 'transparent',
                  color: calendarView === 'calendar' ? '#181915' : '#9CA3AF',
                }}
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                Calendar
              </button>
            </div>
          </div>
          <p className="text-sm mb-6" style={{ color: '#6B7280' }}>
            Click a date to block it off or set custom hours that override your weekly schedule.
          </p>

          {calendarView === 'calendar' ? (
            <>
              {/* Calendar header */}
              <div className="flex items-center justify-between mb-4">
                <button onClick={prevMonth} className="p-1.5 rounded-md hover:bg-white/50 transition-colors">
                  <svg className="w-5 h-5" fill="none" stroke="#4B5563" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                <h4 className="text-base font-semibold" style={{ color: '#181915' }}>{monthLabel}</h4>
                <button onClick={nextMonth} className="p-1.5 rounded-md hover:bg-white/50 transition-colors">
                  <svg className="w-5 h-5" fill="none" stroke="#4B5563" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>

              {/* Day headers */}
              <div className="grid grid-cols-7 mb-1">
                {SHORT_DAYS.map((d) => (
                  <div key={d} className="text-center text-[10px] font-semibold uppercase tracking-widest py-2" style={{ color: '#9CA3AF' }}>
                    {d}
                  </div>
                ))}
              </div>

              {/* Calendar grid */}
              <div className="grid grid-cols-7" style={{ border: '1px solid #E5E4E0', borderRadius: '8px', overflow: 'hidden' }}>
                {calendarDays.map((day, i) => {
                  if (day === null) {
                    return <div key={i} className="min-h-[90px] p-2" style={{ backgroundColor: '#EBEAE6', borderRight: i % 7 !== 6 ? '1px solid #E5E4E0' : 'none', borderBottom: '1px solid #E5E4E0' }} />;
                  }

                  const dateStr = getDateStr(day);
                  const override = getOverrideForDate(dateStr);
                  const dayAvail = getDayAvailForDate(day);
                  const past = isDatePast(day);
                  const today = isToday(day);
                  const hasAvail = dayAvail.length > 0 && !override?.isBlocked;
                  const isBlocked = override?.isBlocked;
                  const hasCustom = override && !override.isBlocked && override.startTime;

                  return (
                    <div
                      key={i}
                      className="min-h-[90px] p-2 relative group transition-colors"
                      style={{
                        backgroundColor: past ? '#EBEAE6' : isBlocked ? '#fef2f2' : 'white',
                        borderRight: i % 7 !== 6 ? '1px solid #E5E4E0' : 'none',
                        borderBottom: '1px solid #E5E4E0',
                        cursor: past ? 'default' : 'pointer',
                        opacity: past ? 0.5 : 1,
                      }}
                      onClick={() => !past && openOverrideModal(dateStr)}
                    >
                      <div className="flex items-start justify-between">
                        <span
                          className="text-sm font-medium"
                          style={{
                            color: today ? '#13352F' : '#181915',
                            fontWeight: today ? 700 : 500,
                          }}
                        >
                          {today ? (
                            <span className="inline-flex items-center justify-center w-6 h-6 rounded-full" style={{ backgroundColor: '#13352F', color: 'white' }}>
                              {day}
                            </span>
                          ) : day}
                        </span>
                        {!past && (override || hasAvail) && (
                          <span
                            className="opacity-0 group-hover:opacity-100 transition-opacity"
                            style={{ color: '#9CA3AF' }}
                          >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
                            </svg>
                          </span>
                        )}
                      </div>

                      {/* Show hours */}
                      {!past && (
                        <div className="mt-1">
                          {isBlocked ? (
                            <span className="text-[10px] font-medium" style={{ color: '#b91c1c' }}>Blocked</span>
                          ) : hasCustom ? (
                            <span className="text-[10px]" style={{ color: '#065f46' }}>
                              {formatTimeLabel(override.startTime!)} – {formatTimeLabel(override.endTime!)}
                            </span>
                          ) : hasAvail ? (
                            <div>
                              {dayAvail.map((r, ri) => (
                                <div key={ri} className="text-[10px]" style={{ color: '#6B7280' }}>
                                  {formatTimeLabel(r.start)} – {formatTimeLabel(r.end)}
                                </div>
                              ))}
                            </div>
                          ) : null}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          ) : (
            /* List view */
            <>
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
                        onClick={() => handleRemoveOverride(override.date)}
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
            </>
          )}
        </div>

        {/* Share / Embed */}
        <div className="rounded-xl shadow-sm p-6" style={{ backgroundColor: '#F5F4F2', border: '1px solid #E5E4E0' }}>
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

      {/* Override Modal */}
      {modalDate && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={() => setModalDate(null)}>
          <div
            className="rounded-xl shadow-xl p-6 w-full max-w-md"
            style={{ backgroundColor: '#F5F4F2' }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold mb-1" style={{ color: '#181915', fontFamily: 'Georgia, "Times New Roman", serif' }}>
              Override for{' '}
              <span style={{ color: '#13352F' }}>
                {new Date(modalDate + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
              </span>
            </h3>
            <p className="text-sm mb-5" style={{ color: '#6B7280' }}>
              Set custom hours or block this date entirely.
            </p>

            <div className="space-y-4">
              <div className="flex gap-3">
                <button
                  onClick={() => setModalMode('block')}
                  className="flex-1 py-2.5 px-4 rounded-lg text-sm font-medium transition-all"
                  style={{
                    backgroundColor: modalMode === 'block' ? '#fef2f2' : 'white',
                    color: modalMode === 'block' ? '#b91c1c' : '#6B7280',
                    border: modalMode === 'block' ? '2px solid #fca5a5' : '1px solid #E5E4E0',
                  }}
                >
                  Block off
                </button>
                <button
                  onClick={() => setModalMode('custom')}
                  className="flex-1 py-2.5 px-4 rounded-lg text-sm font-medium transition-all"
                  style={{
                    backgroundColor: modalMode === 'custom' ? '#ecfdf5' : 'white',
                    color: modalMode === 'custom' ? '#065f46' : '#6B7280',
                    border: modalMode === 'custom' ? '2px solid #6ee7b7' : '1px solid #E5E4E0',
                  }}
                >
                  Custom hours
                </button>
              </div>

              {modalMode === 'custom' && (
                <div className="flex items-center gap-3">
                  <select
                    value={modalStart}
                    onChange={(e) => setModalStart(e.target.value)}
                    className="text-sm rounded-md px-3 py-2 flex-1"
                    style={{ backgroundColor: 'white', border: '1px solid #E5E4E0', color: '#181915' }}
                  >
                    {TIME_OPTIONS.map((t) => (
                      <option key={t} value={t}>{formatTimeLabel(t)}</option>
                    ))}
                  </select>
                  <span className="text-sm" style={{ color: '#9CA3AF' }}>to</span>
                  <select
                    value={modalEnd}
                    onChange={(e) => setModalEnd(e.target.value)}
                    className="text-sm rounded-md px-3 py-2 flex-1"
                    style={{ backgroundColor: 'white', border: '1px solid #E5E4E0', color: '#181915' }}
                  >
                    {TIME_OPTIONS.map((t) => (
                      <option key={t} value={t}>{formatTimeLabel(t)}</option>
                    ))}
                  </select>
                </div>
              )}

              <div className="flex items-center justify-between pt-2">
                <div>
                  {getOverrideForDate(modalDate) && (
                    <button
                      onClick={() => handleRemoveOverride(modalDate)}
                      className="text-sm transition-colors"
                      style={{ color: '#b91c1c' }}
                    >
                      Remove override
                    </button>
                  )}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setModalDate(null)}
                    className="px-4 py-2 rounded-md text-sm font-medium transition-colors"
                    style={{ color: '#6B7280' }}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveOverride}
                    disabled={savingOverride}
                    className="text-white px-5 py-2 rounded-md text-sm font-medium disabled:opacity-50 transition-all"
                    style={{ backgroundColor: '#13352F' }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#1a453d'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#13352F'}
                  >
                    {savingOverride ? 'Saving...' : 'Apply'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
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
