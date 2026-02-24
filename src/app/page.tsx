'use client';

import { useState, useEffect } from 'react';

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
  };
}

export default function BookingPage() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-start justify-center py-12 px-4">
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

  // Generate next 7 days
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
    <div className="w-full max-w-lg bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="bg-blue-600 px-6 py-5 text-white">
        <h1 className="text-xl font-bold">RevFactor</h1>
        <p className="text-blue-100 text-sm mt-1">Book a 15-minute sales call</p>
      </div>

      <div className="p-6">
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            {error}
          </div>
        )}

        {/* Step: Select Date */}
        {step === 'date' && (
          <div>
            <h2 className="text-sm font-medium text-gray-500 mb-3">Select a date</h2>
            <div className="space-y-2">
              {dates.map((d) => (
                <button
                  key={d.toISOString()}
                  onClick={() => handleDateSelect(d)}
                  className="w-full text-left px-4 py-3 rounded-lg border border-gray-200 hover:border-blue-400 hover:bg-blue-50 transition-colors flex justify-between items-center"
                >
                  <span className="font-medium text-gray-900">
                    {d.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
                  </span>
                  <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
            <button onClick={() => { setStep('date'); setSelectedDate(null); }} className="text-sm text-blue-600 hover:text-blue-700 mb-3 flex items-center gap-1">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Back
            </button>
            <h2 className="text-sm font-medium text-gray-500 mb-1">
              {selectedDate && new Date(selectedDate + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
            </h2>
            <p className="text-xs text-gray-400 mb-4">Select an available time</p>

            {loading ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
              </div>
            ) : slots.length === 0 ? (
              <p className="text-center py-8 text-gray-500">No available times on this date.</p>
            ) : (
              <div className="space-y-2 max-h-80 overflow-y-auto">
                {slots.map((slot) => (
                  <div key={slot.start}>
                    <button
                      onClick={() => handleSlotSelect(slot)}
                      className={`w-full text-left px-4 py-3 rounded-lg border transition-colors ${
                        selectedSlot?.start === slot.start
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-200 hover:border-blue-400 hover:bg-blue-50'
                      }`}
                    >
                      <div className="flex justify-between items-center">
                        <span className="font-medium text-gray-900">{formatTimeDisplay(slot.start)}</span>
                        <span className="text-xs text-gray-400">
                          {slot.availableUsers.length === 1
                            ? slot.availableUsers[0].name
                            : `${slot.availableUsers.length} available`}
                        </span>
                      </div>
                    </button>
                    {/* Show user picker if multiple available and this slot is selected */}
                    {selectedSlot?.start === slot.start && slot.availableUsers.length > 1 && !selectedUser && (
                      <div className="mt-2 ml-4 space-y-1">
                        <p className="text-xs text-gray-500 mb-2">Choose who to meet with:</p>
                        {slot.availableUsers.map((user) => (
                          <button
                            key={user.id}
                            onClick={() => handleUserSelect(user)}
                            className="w-full text-left px-3 py-2 rounded-lg border border-gray-200 hover:border-blue-400 hover:bg-blue-50 text-sm flex items-center gap-2"
                          >
                            {user.image && <img src={user.image} alt="" className="w-6 h-6 rounded-full" />}
                            <span>{user.name}</span>
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
            <button onClick={() => { setStep('time'); setSelectedUser(null); }} className="text-sm text-blue-600 hover:text-blue-700 mb-3 flex items-center gap-1">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Back
            </button>

            <div className="bg-blue-50 border border-blue-100 rounded-lg p-4 mb-5">
              <p className="text-sm font-medium text-blue-900">
                {selectedDate && new Date(selectedDate + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
              </p>
              <p className="text-sm text-blue-700">{formatTimeDisplay(selectedSlot.start)} - {formatTimeDisplay(selectedSlot.end)}</p>
              <p className="text-sm text-blue-600">with {selectedUser.name}</p>
            </div>

            <form onSubmit={handleBook} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Your Name *</label>
                <input
                  name="name"
                  required
                  className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  placeholder="John Smith"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email Address *</label>
                <input
                  name="email"
                  type="email"
                  required
                  className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  placeholder="john@company.com"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Company</label>
                <input
                  name="company"
                  className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  placeholder="Acme Corp"
                />
              </div>
              <button
                type="submit"
                disabled={submitting}
                className="w-full bg-blue-600 text-white rounded-lg py-3 text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {submitting ? 'Booking...' : 'Confirm Booking'}
              </button>
            </form>
          </div>
        )}

        {/* Step: Confirmed */}
        {step === 'confirmed' && booking && (
          <div className="text-center py-4">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">You're booked!</h2>
            <p className="text-gray-600 mb-4">
              {new Date(booking.date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
              {' '}at {formatTimeDisplay(booking.startTime)}
            </p>
            <p className="text-sm text-gray-500 mb-4">with {booking.hostName}</p>
            {booking.meetLink && (
              <a
                href={booking.meetLink}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 bg-blue-600 text-white px-6 py-2.5 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z"/>
                </svg>
                Join Google Meet
              </a>
            )}
            <p className="text-xs text-gray-400 mt-4">A calendar invitation has been sent to your email.</p>
          </div>
        )}
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
