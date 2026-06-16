'use client';

import { useEffect, useState } from 'react';
import { signIn } from 'next-auth/react';

interface CalendarStatus {
  connected: boolean;
  hasCalendar: boolean;
}

function GoogleIcon() {
  return (
    <svg className="w-5 h-5" viewBox="0 0 24 24">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
    </svg>
  );
}

// Card on the "My Availability" page that lets a host connect (or reconnect) their Google
// Calendar. "Connecting" is just re-running Google sign-in WITH the calendar scope granted —
// there's no separate token to paste. The forced-consent OAuth config + the signIn callback
// that persists fresh scopes (see lib/auth.ts) make the reconnect actually stick.
export default function CalendarConnectionCard() {
  const [status, setStatus] = useState<CalendarStatus | null>(null);
  const [connecting, setConnecting] = useState(false);

  useEffect(() => {
    fetch('/api/me/calendar-status')
      .then((r) => r.json())
      .then((data) => setStatus({ connected: !!data.connected, hasCalendar: !!data.hasCalendar }))
      .catch(() => setStatus(null));
  }, []);

  const connect = () => {
    setConnecting(true);
    // Bounce through Google sign-in; the forced consent screen re-grants calendar access.
    signIn('google', { callbackUrl: '/admin' });
  };

  // While loading, render nothing to avoid a flash of the wrong state.
  if (!status) return null;

  // Connected with calendar access — quiet confirmation + a subtle "Reconnect" affordance.
  if (status.hasCalendar) {
    return (
      <div
        className="rounded-xl shadow-sm p-4 flex items-center justify-between"
        style={{ backgroundColor: '#ecfdf5', border: '1px solid #6ee7b7' }}
      >
        <div className="flex items-center gap-3">
          <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="#065f46" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          <span className="text-sm font-medium" style={{ color: '#065f46' }}>
            Google Calendar connected — your booked calls will appear on your calendar with a Meet link.
          </span>
        </div>
        <button
          onClick={connect}
          disabled={connecting}
          className="text-xs font-medium underline disabled:opacity-50 flex-shrink-0 ml-3"
          style={{ color: '#065f46' }}
        >
          {connecting ? 'Reconnecting…' : 'Reconnect'}
        </button>
      </div>
    );
  }

  // Not connected, or connected without the calendar scope — prominent warning + connect CTA.
  return (
    <div
      className="rounded-xl shadow-sm p-6"
      style={{ backgroundColor: '#fffbeb', border: '1px solid #fcd34d' }}
    >
      <div className="flex items-start gap-3">
        <svg className="w-6 h-6 flex-shrink-0 mt-0.5" fill="none" stroke="#b45309" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
        </svg>
        <div className="flex-1">
          <h3 className="text-base font-semibold mb-1" style={{ color: '#92400e' }}>
            Google Calendar not connected
          </h3>
          <p className="text-sm mb-4" style={{ color: '#b45309' }}>
            {status.connected
              ? 'You signed in, but didn’t grant Calendar access. Until you connect it, your booked calls won’t appear on your calendar and guests won’t get a Google Meet link.'
              : 'Connect your Google Calendar so booked calls appear on your calendar with a Google Meet link. Without it, you won’t be offered for new bookings.'}
          </p>
          <button
            onClick={connect}
            disabled={connecting}
            className="inline-flex items-center gap-3 rounded-md px-5 py-2.5 font-medium transition-all disabled:opacity-50"
            style={{ backgroundColor: 'white', border: '1px solid #E5E4E0', color: '#181915' }}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#13352F'; }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#E5E4E0'; }}
          >
            <GoogleIcon />
            {connecting ? 'Connecting…' : 'Connect Google Calendar'}
          </button>
          <p className="text-xs mt-3" style={{ color: '#b45309' }}>
            ⚠️ On the Google screen, leave the <strong>Calendar</strong> permission checkboxes <strong>checked</strong>.
          </p>
        </div>
      </div>
    </div>
  );
}
