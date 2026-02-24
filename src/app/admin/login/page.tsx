'use client';

import { signIn } from 'next-auth/react';

export default function LoginPage() {
  return (
    <div className="min-h-screen flex" style={{ backgroundColor: '#E0DAD1' }}>
      {/* Left panel - branding */}
      <div
        className="hidden md:flex md:w-1/2 flex-col justify-between p-12"
        style={{ backgroundColor: '#13352F' }}
      >
        <div>
          <h1 className="text-3xl font-semibold text-white" style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}>
            rf.
          </h1>
          <span
            className="inline-block mt-1 px-2.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-widest"
            style={{ backgroundColor: 'rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.7)' }}
          >
            Scheduler
          </span>
        </div>

        <div>
          <p
            className="text-2xl leading-relaxed"
            style={{ fontFamily: 'Georgia, "Times New Roman", serif', color: 'rgba(255,255,255,0.85)', fontStyle: 'italic' }}
          >
            Book discovery calls with{' '}
            <span className="text-white not-italic font-semibold">the revenue team</span>{' '}
            that pays for itself.
          </p>
          <div className="mt-8 flex items-center gap-3">
            <div className="flex -space-x-2">
              <img src="/federico.jpg" alt="Federico" className="w-9 h-9 rounded-full border-2 object-cover" style={{ borderColor: '#13352F' }} />
              <img src="/emily.png" alt="Emily" className="w-9 h-9 rounded-full border-2 object-cover" style={{ borderColor: '#13352F' }} />
            </div>
            <span className="text-xs" style={{ color: 'rgba(255,255,255,0.45)' }}>Federico & Emily</span>
          </div>
        </div>

        <p className="text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>
          revfactor.io
        </p>
      </div>

      {/* Right panel - sign in form */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="max-w-sm w-full">
          {/* Mobile logo */}
          <div className="md:hidden mb-8">
            <h1 className="text-2xl font-semibold" style={{ color: '#13352F', fontFamily: 'Georgia, "Times New Roman", serif' }}>
              rf.
            </h1>
            <span
              className="inline-block mt-1 px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-widest"
              style={{ backgroundColor: '#13352F', color: 'rgba(255,255,255,0.8)' }}
            >
              Scheduler
            </span>
          </div>

          <h2 className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: '#9CA3AF' }}>
            Admin Dashboard
          </h2>
          <p className="text-2xl font-semibold mb-8" style={{ color: '#181915', fontFamily: 'Georgia, "Times New Roman", serif' }}>
            Sign in to manage{' '}
            <span style={{ fontStyle: 'italic', color: '#13352F' }}>availability</span>
          </p>

          <button
            onClick={() => signIn('google', { callbackUrl: '/admin' })}
            className="w-full flex items-center justify-center gap-3 rounded-md px-6 py-3.5 font-medium transition-all mb-4"
            style={{ backgroundColor: 'white', border: '1px solid #E5E4E0', color: '#181915' }}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#13352F'; e.currentTarget.style.backgroundColor = '#f9f8f6'; }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#E5E4E0'; e.currentTarget.style.backgroundColor = 'white'; }}
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            Continue with Google
          </button>

          <p className="text-xs text-center" style={{ color: '#9CA3AF' }}>
            Only authorized team members can access this dashboard.
          </p>
        </div>
      </div>
    </div>
  );
}
