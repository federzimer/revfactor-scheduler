'use client';

import { useState, useEffect } from 'react';

interface AvailableUser {
  id: string;
  name: string;
  image?: string;
  bio?: string;
  hometown?: string;
  basedIn?: string;
  strExperience?: string;
  hostStart: string;
  hostEnd: string;
  hostTimezone: string;
}

interface Slot {
  start: string;
  end: string;
  availableUsers: AvailableUser[];
}

interface BookingResult {
  booking: {
    id: string;
    date: string;
    startTime: string;
    endTime: string;
    meetLink: string | null;
    hostName: string;
    hostImage?: string;
  };
}

// Format host first names into a natural subject phrase with correct verb agreement:
// ["Fede"] -> "Fede is"; ["Fede","Emily"] -> "Fede & Emily are";
// ["Fede","Emily","Ethan"] -> "Fede, Emily & Ethan are". Empty -> "We're".
function formatHostNames(names: string[]): string {
  if (names.length === 0) return "We're";
  if (names.length === 1) return `${names[0]} is`;
  const last = names[names.length - 1];
  const rest = names.slice(0, -1).join(', ');
  return `${rest} & ${last} are`;
}

export default function BookingPage() {
  return (
    <div className="min-h-screen flex items-start justify-center py-12 px-4" style={{ backgroundColor: '#E0DAD1' }}>
      <BookingWidget />
    </div>
  );
}

function BookingWidget() {
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);
  const [selectedUser, setSelectedUser] = useState<AvailableUser | null>(null);
  const [step, setStep] = useState<'date' | 'time' | 'form' | 'confirmed'>('date');
  const [booking, setBooking] = useState<BookingResult['booking'] | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [availableDates, setAvailableDates] = useState<Set<string>>(new Set());
  const [loadingDates, setLoadingDates] = useState(true);
  const [displayTimezone, setDisplayTimezone] = useState<string>('');
  const [noListing, setNoListing] = useState(false); // "I don't have a listing yet" → collect address instead
  const [heardAbout, setHeardAbout] = useState(''); // "How did you hear about us?" selection
  const [hosts, setHosts] = useState<{ firstName: string; image: string }[]>([]); // bookable hosts for the header strip
  const [viewMonth, setViewMonth] = useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  });

  // Fetch the bookable hosts for the "ready to chat" header strip
  useEffect(() => {
    fetch('/api/hosts')
      .then((res) => res.json())
      .then((data) => setHosts(data.hosts || []))
      .catch(() => setHosts([]));
  }, []);

  // Fetch available dates from the server
  useEffect(() => {
    const fetchAvailableDates = async () => {
      setLoadingDates(true);
      const today = new Date();
      const from = today.toISOString().split('T')[0];
      const toDate = new Date(today);
      toDate.setDate(toDate.getDate() + 90); // look ahead up to 90 days (actual limit enforced per-user)
      const to = toDate.toISOString().split('T')[0];

      try {
        const res = await fetch(`/api/available-dates?from=${from}&to=${to}`);
        const data = await res.json();
        setAvailableDates(new Set(data.availableDates || []));
      } catch {
        setAvailableDates(new Set());
      }
      setLoadingDates(false);
    };
    fetchAvailableDates();
  }, []);

  // Detect visitor timezone
  const visitorTz = typeof window !== 'undefined'
    ? Intl.DateTimeFormat().resolvedOptions().timeZone
    : 'America/New_York';

  const fetchSlots = async (date: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/slots?date=${date}&tz=${encodeURIComponent(visitorTz)}`);
      const data = await res.json();
      setSlots(data.slots || []);
      if (data.displayTimezone) setDisplayTimezone(data.displayTimezone);
    } catch {
      setError('Failed to load available times. Please try again.');
      setSlots([]);
    }
    setLoading(false);
  };

  const handleDateSelect = (dateStr: string) => {
    setSelectedDate(dateStr);
    setSelectedSlot(null);
    setSelectedUser(null);
    fetchSlots(dateStr);
    setStep('time');
  };

  const handleSlotSelect = (slot: Slot) => {
    setSelectedSlot(slot);
    if (slot.availableUsers.length === 1) {
      setSelectedUser(slot.availableUsers[0]);
      setStep('form');
    } else {
      setSelectedUser(null);
    }
  };

  const handleUserSelect = (user: AvailableUser) => {
    setSelectedUser(user);
    setStep('form');
  };

  const handleBook = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selectedSlot || !selectedUser || !selectedDate) return;

    setSubmitting(true);
    setError(null);

    const formData = new FormData(e.currentTarget);

    // Use the host-timezone times for booking (not the display times)
    const hostStart = selectedUser.hostStart || selectedSlot.start;
    const hostEnd = selectedUser.hostEnd || selectedSlot.end;

    try {
      const res = await fetch('/api/book', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: selectedDate,
          startTime: hostStart,
          endTime: hostEnd,
          userId: selectedUser.id,
          visitorName: formData.get('name'),
          visitorEmail: formData.get('email'),
          visitorPhone: formData.get('phone'),
          visitorAirbnbLink: noListing ? null : formData.get('airbnbLink'),
          visitorAddress: noListing ? formData.get('address') : null,
          visitorHeardAbout: formData.get('heardAbout'),
          visitorReferralName: heardAbout === 'Referral' ? formData.get('referralName') : null,
          visitorNotes: formData.get('notes'),
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Booking failed');
      }

      const data: BookingResult = await res.json();
      setBooking(data.booking);
      setStep('confirmed');

      if (typeof window !== 'undefined' && window.parent !== window) {
        window.parent.postMessage({
          type: 'scheduler_booking_confirmed',
          booked: true,
          value: 250,
          currency: 'USD',
        }, '*');
      }

      if (typeof window !== 'undefined' && typeof (window as any).gtag === 'function') {
        (window as any).gtag('event', 'book_strategy_call', {
          send_to: ['G-1CTGBJ9RLK', 'AW-18106897053/WkHxCOKD46McEJ2lhbpD'],
          value: 1000,
          currency: 'USD',
          transaction_id: data.booking.id,
        });
      }
    } catch (err: any) {
      setError(err.message || 'Something went wrong. Please try again.');
    }
    setSubmitting(false);
  };

  const navigateMonth = (dir: -1 | 1) => {
    setViewMonth((prev) => {
      let m = prev.month + dir;
      let y = prev.year;
      if (m < 0) { m = 11; y--; }
      if (m > 11) { m = 0; y++; }
      return { year: y, month: m };
    });
  };

  return (
    <div className="w-full max-w-lg">
      {/* Card */}
      <div className="rounded-xl overflow-hidden shadow-lg" style={{ backgroundColor: '#F5F4F2' }}>
        {/* Header */}
        <div className="px-6 py-6" style={{ backgroundColor: '#13352F' }}>
          <div className="flex items-center gap-3 mb-4">
            <h1 className="text-2xl font-normal text-white" style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}>
              rf.
            </h1>
            <span
              className="px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-widest"
              style={{ backgroundColor: 'rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.6)' }}
            >
              Scheduler
            </span>
          </div>
          <p
            className="text-lg leading-snug"
            style={{ fontFamily: 'Georgia, "Times New Roman", serif', color: 'rgba(255,255,255,0.85)', fontStyle: 'italic' }}
          >
            Book a 15-minute <span className="text-white not-italic font-semibold">discovery call</span> with our team.
          </p>
        </div>

        {/* Team photos strip — reflects who is actually bookable (active + calendar-connected) */}
        {step === 'date' && hosts.length > 0 && (
          <div className="px-6 py-3 flex items-center gap-3" style={{ backgroundColor: '#1a453d', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
            <div className="flex -space-x-2">
              {hosts.map((h, i) => (
                <img key={i} src={h.image} alt={h.firstName} className="w-8 h-8 rounded-full border-2 object-cover" style={{ borderColor: '#1a453d' }} />
              ))}
            </div>
            <span className="text-xs" style={{ color: 'rgba(255,255,255,0.45)' }}>{formatHostNames(hosts.map((h) => h.firstName))} ready to chat</span>
          </div>
        )}

        <div className="p-6">
          {error && (
            <div className="mb-4 p-3 rounded-md text-sm" style={{ backgroundColor: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c' }}>
              {error}
            </div>
          )}

          {/* Step: Select Date — Calendar Grid */}
          {step === 'date' && (
            <div>
              <h2 className="text-[10px] font-semibold uppercase tracking-widest mb-4" style={{ color: '#9CA3AF' }}>Select a date</h2>
              {loadingDates ? (
                <div className="flex justify-center py-8">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2" style={{ borderColor: '#13352F' }}></div>
                </div>
              ) : (
                <CalendarGrid
                  viewMonth={viewMonth}
                  availableDates={availableDates}
                  selectedDate={selectedDate}
                  onSelect={handleDateSelect}
                  onNavigate={navigateMonth}
                />
              )}
            </div>
          )}

          {/* Step: Select Time */}
          {step === 'time' && (
            <div>
              <button
                onClick={() => { setStep('date'); setSelectedDate(null); }}
                className="text-xs font-medium mb-3 flex items-center gap-1 transition-opacity"
                style={{ color: '#13352F' }}
                onMouseEnter={(e) => e.currentTarget.style.opacity = '0.6'}
                onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                Back
              </button>
              <h2 className="text-base font-semibold mb-0.5" style={{ color: '#181915', fontFamily: 'Georgia, "Times New Roman", serif' }}>
                {selectedDate && new Date(selectedDate + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
              </h2>
              <p className="text-xs mb-4" style={{ color: '#9CA3AF' }}>
                Choose an available time slot
                {displayTimezone && (
                  <span className="ml-1">
                    · Times shown in {formatTimezoneName(displayTimezone)}
                  </span>
                )}
              </p>

              {loading ? (
                <div className="flex justify-center py-8">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2" style={{ borderColor: '#13352F' }}></div>
                </div>
              ) : slots.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-sm" style={{ color: '#9CA3AF' }}>No available times on this date.</p>
                  <button
                    onClick={() => { setStep('date'); setSelectedDate(null); }}
                    className="text-sm mt-2 hover:underline"
                    style={{ color: '#13352F' }}
                  >
                    Try another date
                  </button>
                </div>
              ) : (
                <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                  {slots.map((slot) => (
                    <div key={slot.start}>
                      <button
                        onClick={() => handleSlotSelect(slot)}
                        className="w-full text-left px-4 py-3 rounded-lg transition-all"
                        style={{
                          backgroundColor: selectedSlot?.start === slot.start ? '#eef5f0' : 'white',
                          border: selectedSlot?.start === slot.start ? '1.5px solid #13352F' : '1px solid #E5E4E0',
                        }}
                        onMouseEnter={(e) => { if (selectedSlot?.start !== slot.start) { e.currentTarget.style.borderColor = '#13352F'; e.currentTarget.style.backgroundColor = '#f9f8f6'; } }}
                        onMouseLeave={(e) => { if (selectedSlot?.start !== slot.start) { e.currentTarget.style.borderColor = '#E5E4E0'; e.currentTarget.style.backgroundColor = 'white'; } }}
                      >
                        <div className="flex justify-between items-center">
                          <span className="font-semibold text-sm" style={{ color: '#181915' }}>{formatTimeDisplay(slot.start)}</span>
                          <div className="flex items-center gap-2">
                            <div className="flex -space-x-1.5">
                              {slot.availableUsers.map((u) => (
                                <img key={u.id} src={u.image || '/default-avatar.png'} alt={u.name} className="w-6 h-6 rounded-full border-2 border-white object-cover" />
                              ))}
                            </div>
                            <span className="text-xs" style={{ color: '#9CA3AF' }}>
                              {slot.availableUsers.length === 1
                                ? slot.availableUsers[0].name.split(' ')[0]
                                : `${slot.availableUsers.length} available`}
                            </span>
                          </div>
                        </div>
                      </button>

                      {/* User picker for multiple available */}
                      {selectedSlot?.start === slot.start && slot.availableUsers.length > 1 && !selectedUser && (
                        <div className="mt-2 ml-2 space-y-1.5">
                          <p className="text-xs font-medium mb-2" style={{ color: '#9CA3AF' }}>Who would you like to meet with?</p>
                          {slot.availableUsers.map((user) => (
                            <button
                              key={user.id}
                              onClick={() => handleUserSelect(user)}
                              className="w-full text-left px-3 py-2.5 rounded-lg text-sm flex items-center gap-3 transition-all"
                              style={{ backgroundColor: 'white', border: '1px solid #E5E4E0' }}
                              onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#13352F'; e.currentTarget.style.backgroundColor = '#f9f8f6'; }}
                              onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#E5E4E0'; e.currentTarget.style.backgroundColor = 'white'; }}
                            >
                              <img src={user.image || '/default-avatar.png'} alt={user.name} className="w-8 h-8 rounded-full object-cover" />
                              <span className="font-medium" style={{ color: '#181915' }}>{user.name}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Step: Booking Form */}
          {step === 'form' && selectedSlot && selectedUser && (
            <div>
              <button
                onClick={() => { setStep('time'); setSelectedUser(null); }}
                className="text-xs font-medium mb-3 flex items-center gap-1"
                style={{ color: '#13352F' }}
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                Back
              </button>

              <div className="rounded-lg p-4 mb-5" style={{ backgroundColor: '#EBEAE6', border: '1px solid #E5E4E0' }}>
                <div className="flex items-center gap-3">
                  <img src={selectedUser.image || '/default-avatar.png'} alt={selectedUser.name} className="w-10 h-10 rounded-full object-cover" />
                  <div>
                    <p className="text-sm font-semibold" style={{ color: '#181915', fontFamily: 'Georgia, "Times New Roman", serif' }}>
                      {formatTimeDisplay(selectedSlot.start)} – {formatTimeDisplay(selectedSlot.end)}
                    </p>
                    <p className="text-xs" style={{ color: '#6B7280' }}>
                      {selectedDate && new Date(selectedDate + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                      {' '}with {selectedUser.name}
                    </p>
                  </div>
                </div>

                {(selectedUser.bio || selectedUser.hometown || selectedUser.basedIn || selectedUser.strExperience) && (
                  <div className="mt-3 pt-3" style={{ borderTop: '1px solid #E5E4E0' }}>
                    {selectedUser.bio && (
                      <p className="text-xs leading-relaxed mb-2" style={{ color: '#4B5563' }}>{selectedUser.bio}</p>
                    )}
                    <div className="flex flex-wrap gap-x-3 gap-y-1">
                      {selectedUser.hometown && (
                        <span className="text-[11px]" style={{ color: '#6B7280' }}>
                          <span style={{ color: '#9CA3AF' }}>From</span> {selectedUser.hometown}
                        </span>
                      )}
                      {selectedUser.basedIn && (
                        <span className="text-[11px]" style={{ color: '#6B7280' }}>
                          <span style={{ color: '#9CA3AF' }}>Based in</span> {selectedUser.basedIn}
                        </span>
                      )}
                      {selectedUser.strExperience && (
                        <span className="text-[11px]" style={{ color: '#6B7280' }}>
                          <span style={{ color: '#9CA3AF' }}>STR</span> {selectedUser.strExperience}
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>

              <h3 className="text-[10px] font-semibold uppercase tracking-widest mb-3" style={{ color: '#9CA3AF' }}>Your details</h3>
              <form onSubmit={handleBook} className="space-y-3">
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: '#4B5563' }}>Name *</label>
                  <input
                    name="name"
                    required
                    className="w-full rounded-md px-4 py-2.5 text-sm outline-none transition-all"
                    style={{ backgroundColor: 'white', border: '1px solid #E5E4E0', color: '#181915' }}
                    onFocus={(e) => { e.currentTarget.style.borderColor = '#13352F'; e.currentTarget.style.boxShadow = '0 0 0 2px rgba(19,53,47,0.1)'; }}
                    onBlur={(e) => { e.currentTarget.style.borderColor = '#E5E4E0'; e.currentTarget.style.boxShadow = 'none'; }}
                    placeholder="John Smith"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: '#4B5563' }}>Email *</label>
                  <input
                    name="email"
                    type="email"
                    required
                    className="w-full rounded-md px-4 py-2.5 text-sm outline-none transition-all"
                    style={{ backgroundColor: 'white', border: '1px solid #E5E4E0', color: '#181915' }}
                    onFocus={(e) => { e.currentTarget.style.borderColor = '#13352F'; e.currentTarget.style.boxShadow = '0 0 0 2px rgba(19,53,47,0.1)'; }}
                    onBlur={(e) => { e.currentTarget.style.borderColor = '#E5E4E0'; e.currentTarget.style.boxShadow = 'none'; }}
                    placeholder="john@example.com"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: '#4B5563' }}>Phone</label>
                  <input
                    name="phone"
                    type="tel"
                    className="w-full rounded-md px-4 py-2.5 text-sm outline-none transition-all"
                    style={{ backgroundColor: 'white', border: '1px solid #E5E4E0', color: '#181915' }}
                    onFocus={(e) => { e.currentTarget.style.borderColor = '#13352F'; e.currentTarget.style.boxShadow = '0 0 0 2px rgba(19,53,47,0.1)'; }}
                    onBlur={(e) => { e.currentTarget.style.borderColor = '#E5E4E0'; e.currentTarget.style.boxShadow = 'none'; }}
                    placeholder="+1 (555) 000-0000"
                  />
                </div>
                <div>
                  {!noListing ? (
                    <>
                      <label className="block text-xs font-medium mb-1" style={{ color: '#4B5563' }}>Airbnb Listing Link *</label>
                      <input
                        name="airbnbLink"
                        type="url"
                        required
                        className="w-full rounded-md px-4 py-2.5 text-sm outline-none transition-all"
                        style={{ backgroundColor: 'white', border: '1px solid #E5E4E0', color: '#181915' }}
                        onFocus={(e) => { e.currentTarget.style.borderColor = '#13352F'; e.currentTarget.style.boxShadow = '0 0 0 2px rgba(19,53,47,0.1)'; }}
                        onBlur={(e) => { e.currentTarget.style.borderColor = '#E5E4E0'; e.currentTarget.style.boxShadow = 'none'; }}
                        placeholder="https://www.airbnb.com/rooms/..."
                      />
                    </>
                  ) : (
                    <>
                      <label className="block text-xs font-medium mb-1" style={{ color: '#4B5563' }}>Property Address *</label>
                      <input
                        name="address"
                        type="text"
                        required
                        className="w-full rounded-md px-4 py-2.5 text-sm outline-none transition-all"
                        style={{ backgroundColor: 'white', border: '1px solid #E5E4E0', color: '#181915' }}
                        onFocus={(e) => { e.currentTarget.style.borderColor = '#13352F'; e.currentTarget.style.boxShadow = '0 0 0 2px rgba(19,53,47,0.1)'; }}
                        onBlur={(e) => { e.currentTarget.style.borderColor = '#E5E4E0'; e.currentTarget.style.boxShadow = 'none'; }}
                        placeholder="123 Main St, City, State, ZIP"
                      />
                    </>
                  )}
                  <label className="flex items-center gap-2 mt-2 cursor-pointer text-xs" style={{ color: '#4B5563' }}>
                    <input
                      type="checkbox"
                      checked={noListing}
                      onChange={(e) => setNoListing(e.target.checked)}
                      style={{ accentColor: '#13352F' }}
                    />
                    I don&apos;t have a listing yet
                  </label>
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: '#4B5563' }}>How did you hear about us? *</label>
                  <select
                    name="heardAbout"
                    required
                    value={heardAbout}
                    onChange={(e) => setHeardAbout(e.target.value)}
                    className="w-full rounded-md px-4 py-2.5 text-sm outline-none transition-all"
                    style={{ backgroundColor: 'white', border: '1px solid #E5E4E0', color: heardAbout ? '#181915' : '#9CA3AF' }}
                    onFocus={(e) => { e.currentTarget.style.borderColor = '#13352F'; e.currentTarget.style.boxShadow = '0 0 0 2px rgba(19,53,47,0.1)'; }}
                    onBlur={(e) => { e.currentTarget.style.borderColor = '#E5E4E0'; e.currentTarget.style.boxShadow = 'none'; }}
                  >
                    <option value="" disabled>Select one…</option>
                    <option value="Social Media">Social Media</option>
                    <option value="Google">Google</option>
                    <option value="AI search (ChatGPT, Claude, etc.)">AI search (ChatGPT, Claude, etc.)</option>
                    <option value="Referral">Referral</option>
                  </select>
                </div>
                {heardAbout === 'Referral' && (
                  <div>
                    <label className="block text-xs font-medium mb-1" style={{ color: '#4B5563' }}>Who referred you? *</label>
                    <input
                      name="referralName"
                      type="text"
                      required
                      className="w-full rounded-md px-4 py-2.5 text-sm outline-none transition-all"
                      style={{ backgroundColor: 'white', border: '1px solid #E5E4E0', color: '#181915' }}
                      onFocus={(e) => { e.currentTarget.style.borderColor = '#13352F'; e.currentTarget.style.boxShadow = '0 0 0 2px rgba(19,53,47,0.1)'; }}
                      onBlur={(e) => { e.currentTarget.style.borderColor = '#E5E4E0'; e.currentTarget.style.boxShadow = 'none'; }}
                      placeholder="Name of the person who referred you"
                    />
                  </div>
                )}
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: '#4B5563' }}>Notes to prepare for the call</label>
                  <textarea
                    name="notes"
                    rows={3}
                    className="w-full rounded-md px-4 py-2.5 text-sm outline-none transition-all resize-none"
                    style={{ backgroundColor: 'white', border: '1px solid #E5E4E0', color: '#181915' }}
                    onFocus={(e) => { e.currentTarget.style.borderColor = '#13352F'; e.currentTarget.style.boxShadow = '0 0 0 2px rgba(19,53,47,0.1)'; }}
                    onBlur={(e) => { e.currentTarget.style.borderColor = '#E5E4E0'; e.currentTarget.style.boxShadow = 'none'; }}
                    placeholder="Anything you'd like us to know before the call..."
                  />
                </div>
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full text-white rounded-md py-3 text-sm font-semibold uppercase tracking-wider disabled:opacity-50 transition-all mt-2"
                  style={{ backgroundColor: '#13352F' }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#1a453d'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#13352F'}
                >
                  {submitting ? 'Booking...' : 'Confirm Booking'}
                </button>
              </form>
            </div>
          )}

          {/* Step: Confirmed */}
          {step === 'confirmed' && booking && (
            <div className="text-center py-4">
              <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4" style={{ backgroundColor: '#d1ddd6' }}>
                <svg className="w-8 h-8" style={{ color: '#13352F' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2 className="text-xl font-semibold mb-2" style={{ color: '#181915', fontFamily: 'Georgia, "Times New Roman", serif' }}>You&apos;re booked!</h2>
              <p className="text-sm mb-1" style={{ color: '#4B5563' }}>
                {new Date(booking.date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
              </p>
              <p className="text-sm mb-1" style={{ color: '#4B5563' }}>
                {formatTimeDisplay(booking.startTime)} – {formatTimeDisplay(booking.endTime)}
              </p>
              <p className="text-sm mb-5" style={{ color: '#9CA3AF', fontStyle: 'italic' }}>with {booking.hostName}</p>
              {booking.meetLink && (
                <a
                  href={booking.meetLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-white px-6 py-2.5 rounded-md text-sm font-semibold uppercase tracking-wider transition-all"
                  style={{ backgroundColor: '#13352F' }}
                  onMouseEnter={(e) => (e.currentTarget as HTMLElement).style.backgroundColor = '#1a453d'}
                  onMouseLeave={(e) => (e.currentTarget as HTMLElement).style.backgroundColor = '#13352F'}
                >
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z"/>
                  </svg>
                  Join Google Meet
                </a>
              )}
              <p className="text-xs mt-4" style={{ color: '#C4BFB6' }}>A calendar invitation has been sent to your email.</p>
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <p className="text-center text-xs mt-4" style={{ color: '#8C857B' }}>
        Powered by <span style={{ fontFamily: 'Georgia, "Times New Roman", serif', fontWeight: 400 }}>rf.</span>
      </p>
    </div>
  );
}

/* ─── Calendar Grid Component ─── */

function CalendarGrid({
  viewMonth,
  availableDates,
  selectedDate,
  onSelect,
  onNavigate,
}: {
  viewMonth: { year: number; month: number };
  availableDates: Set<string>;
  selectedDate: string | null;
  onSelect: (dateStr: string) => void;
  onNavigate: (dir: -1 | 1) => void;
}) {
  const { year, month } = viewMonth;
  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];

  const monthName = new Date(year, month).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  // First day of month (0=Sun) and total days
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  // Can we go back? Only if prev month has available dates
  const now = new Date();
  const canGoBack = year > now.getFullYear() || (year === now.getFullYear() && month > now.getMonth());

  // Build grid cells
  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDay; i++) cells.push(null); // leading blanks
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  return (
    <div>
      {/* Month navigation */}
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={() => onNavigate(-1)}
          disabled={!canGoBack}
          className="w-8 h-8 flex items-center justify-center rounded-full transition-colors"
          style={{ color: canGoBack ? '#13352F' : '#D1D5DB' }}
          onMouseEnter={(e) => { if (canGoBack) e.currentTarget.style.backgroundColor = '#EBEAE6'; }}
          onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <span className="text-sm font-semibold" style={{ color: '#181915' }}>{monthName}</span>
        <button
          onClick={() => onNavigate(1)}
          className="w-8 h-8 flex items-center justify-center rounded-full transition-colors"
          style={{ color: '#13352F' }}
          onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#EBEAE6'; }}
          onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      {/* Weekday headers */}
      <div className="grid grid-cols-7 mb-1">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
          <div key={d} className="text-center text-[10px] font-semibold uppercase tracking-wider py-1" style={{ color: '#9CA3AF' }}>
            {d}
          </div>
        ))}
      </div>

      {/* Day cells */}
      <div className="grid grid-cols-7 gap-y-1">
        {cells.map((day, i) => {
          if (day === null) {
            return <div key={`blank-${i}`} />;
          }

          const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
          const isAvailable = availableDates.has(dateStr);
          const isSelected = dateStr === selectedDate;
          const isToday = dateStr === todayStr;
          const isPast = dateStr <= todayStr;

          return (
            <div key={dateStr} className="flex items-center justify-center py-0.5">
              {isAvailable ? (
                <button
                  onClick={() => onSelect(dateStr)}
                  className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium transition-all"
                  style={{
                    backgroundColor: isSelected ? '#13352F' : '#e8f0ec',
                    color: isSelected ? 'white' : '#13352F',
                    border: isSelected ? '2px solid #13352F' : '2px solid transparent',
                  }}
                  onMouseEnter={(e) => {
                    if (!isSelected) {
                      e.currentTarget.style.backgroundColor = '#c9ddd1';
                      e.currentTarget.style.border = '2px solid #13352F';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isSelected) {
                      e.currentTarget.style.backgroundColor = '#e8f0ec';
                      e.currentTarget.style.border = '2px solid transparent';
                    }
                  }}
                >
                  {day}
                </button>
              ) : (
                <span
                  className="w-10 h-10 flex items-center justify-center text-sm rounded-full"
                  style={{
                    color: isPast ? '#D1D5DB' : '#9CA3AF',
                    fontWeight: isToday ? 600 : 400,
                    border: isToday ? '2px solid #D1D5DB' : '2px solid transparent',
                  }}
                >
                  {day}
                </span>
              )}
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 mt-4 pt-3" style={{ borderTop: '1px solid #E5E4E0' }}>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: '#e8f0ec' }} />
          <span className="text-[10px]" style={{ color: '#9CA3AF' }}>Available</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: '#13352F' }} />
          <span className="text-[10px]" style={{ color: '#9CA3AF' }}>Selected</span>
        </div>
      </div>
    </div>
  );
}

function formatTimeDisplay(time: string): string {
  const [h, m] = time.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  const displayH = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${displayH}:${String(m).padStart(2, '0')} ${period}`;
}

function formatTimezoneName(tz: string): string {
  const names: Record<string, string> = {
    'America/New_York': 'Eastern Time',
    'America/Chicago': 'Central Time',
    'America/Denver': 'Mountain Time',
    'America/Los_Angeles': 'Pacific Time',
    'America/Phoenix': 'Arizona Time',
    'America/Anchorage': 'Alaska Time',
    'Pacific/Honolulu': 'Hawaii Time',
    'America/Puerto_Rico': 'Atlantic Time',
  };
  if (names[tz]) return names[tz];
  // Fallback: extract the city name from IANA timezone
  const city = tz.split('/').pop()?.replace(/_/g, ' ') || tz;
  return `${city} Time`;
}
