'use client';

import { useState } from 'react';

interface AvailableUser {
  id: string;
  name: string;
  image?: string;
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

  const dates = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() + i + 1);
    return d;
  });

  const fetchSlots = async (date: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/slots?date=${date}`);
      const data = await res.json();
      setSlots(data.slots || []);
    } catch {
      setError('Failed to load available times. Please try again.');
      setSlots([]);
    }
    setLoading(false);
  };

  const handleDateSelect = (date: Date) => {
    const dateStr = date.toISOString().split('T')[0];
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

    try {
      const res = await fetch('/api/book', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: selectedDate,
          startTime: selectedSlot.start,
          endTime: selectedSlot.end,
          userId: selectedUser.id,
          visitorName: formData.get('name'),
          visitorEmail: formData.get('email'),
          visitorCompany: formData.get('company'),
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Booking failed');
      }

      const data: BookingResult = await res.json();
      setBooking(data.booking);
      setStep('confirmed');
    } catch (err: any) {
      setError(err.message || 'Something went wrong. Please try again.');
    }
    setSubmitting(false);
  };

  return (
    <div className="w-full max-w-lg">
      {/* Card */}
      <div className="rounded-xl overflow-hidden shadow-lg" style={{ backgroundColor: '#F5F4F2' }}>
        {/* Header */}
        <div className="px-6 py-6" style={{ backgroundColor: '#13352F' }}>
          <div className="flex items-center gap-3 mb-4">
            <h1 className="text-2xl font-semibold text-white" style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}>
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

        {/* Team photos strip */}
        {step === 'date' && (
          <div className="px-6 py-3 flex items-center gap-3" style={{ backgroundColor: '#1a453d', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
            <div className="flex -space-x-2">
              <img src="/federico.jpg" alt="Federico" className="w-8 h-8 rounded-full border-2 object-cover" style={{ borderColor: '#1a453d' }} />
              <img src="/emily.png" alt="Emily" className="w-8 h-8 rounded-full border-2 object-cover" style={{ borderColor: '#1a453d' }} />
            </div>
            <span className="text-xs" style={{ color: 'rgba(255,255,255,0.45)' }}>Federico & Emily are ready to chat</span>
          </div>
        )}

        <div className="p-6">
          {error && (
            <div className="mb-4 p-3 rounded-md text-sm" style={{ backgroundColor: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c' }}>
              {error}
            </div>
          )}

          {/* Step: Select Date */}
          {step === 'date' && (
            <div>
              <h2 className="text-[10px] font-semibold uppercase tracking-widest mb-3" style={{ color: '#9CA3AF' }}>Select a date</h2>
              <div className="space-y-2">
                {dates.map((d) => (
                  <button
                    key={d.toISOString()}
                    onClick={() => handleDateSelect(d)}
                    className="w-full text-left px-4 py-3 rounded-lg transition-all flex justify-between items-center group"
                    style={{ backgroundColor: 'white', border: '1px solid #E5E4E0' }}
                    onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#13352F'; e.currentTarget.style.backgroundColor = '#f9f8f6'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#E5E4E0'; e.currentTarget.style.backgroundColor = 'white'; }}
                  >
                    <div>
                      <span className="font-medium text-sm" style={{ color: '#181915' }}>
                        {d.toLocaleDateString('en-US', { weekday: 'long' })}
                      </span>
                      <span className="text-sm ml-2" style={{ color: '#9CA3AF' }}>
                        {d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </span>
                    </div>
                    <svg className="w-4 h-4 transition-colors" style={{ color: '#C4BFB6' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                ))}
              </div>
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
              <p className="text-xs mb-4" style={{ color: '#9CA3AF' }}>Choose an available time slot</p>

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
                                u.image ? (
                                  <img key={u.id} src={u.image} alt={u.name} className="w-6 h-6 rounded-full border-2 border-white" />
                                ) : (
                                  <div key={u.id} className="w-6 h-6 rounded-full border-2 border-white flex items-center justify-center text-[10px] font-semibold" style={{ backgroundColor: '#d1ddd6', color: '#13352F' }}>
                                    {u.name.charAt(0)}
                                  </div>
                                )
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
                              {user.image ? (
                                <img src={user.image} alt={user.name} className="w-8 h-8 rounded-full" />
                              ) : (
                                <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold" style={{ backgroundColor: '#d1ddd6', color: '#13352F' }}>
                                  {user.name.charAt(0)}
                                </div>
                              )}
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
                  {selectedUser.image ? (
                    <img src={selectedUser.image} alt={selectedUser.name} className="w-10 h-10 rounded-full" />
                  ) : (
                    <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold" style={{ backgroundColor: '#13352F' }}>
                      {selectedUser.name.charAt(0)}
                    </div>
                  )}
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
                    placeholder="john@company.com"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: '#4B5563' }}>Company</label>
                  <input
                    name="company"
                    className="w-full rounded-md px-4 py-2.5 text-sm outline-none transition-all"
                    style={{ backgroundColor: 'white', border: '1px solid #E5E4E0', color: '#181915' }}
                    onFocus={(e) => { e.currentTarget.style.borderColor = '#13352F'; e.currentTarget.style.boxShadow = '0 0 0 2px rgba(19,53,47,0.1)'; }}
                    onBlur={(e) => { e.currentTarget.style.borderColor = '#E5E4E0'; e.currentTarget.style.boxShadow = 'none'; }}
                    placeholder="Acme Corp"
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
        Powered by <span style={{ fontFamily: 'Georgia, "Times New Roman", serif', fontWeight: 600 }}>rf.</span>
      </p>
    </div>
  );
}

function formatTimeDisplay(time: string): string {
  const [h, m] = time.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  const displayH = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${displayH}:${String(m).padStart(2, '0')} ${period}`;
}
