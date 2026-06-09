'use client';

import { useSession, signOut } from 'next-auth/react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';

const NAV = [
  { href: '/admin', label: 'My Availability', superAdminOnly: false },
  { href: '/admin/team', label: 'Team', superAdminOnly: true },
];

export default function AdminHeader() {
  const { data: session } = useSession();
  const pathname = usePathname();
  const role = (session?.user as any)?.role || 'user';
  const isSuperAdmin = role === 'super_admin';

  return (
    <header style={{ backgroundColor: '#F5F4F2', borderBottom: '1px solid #E5E4E0' }}>
      <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
        <div className="flex items-center gap-6">
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
          <nav className="flex items-center gap-1">
            {NAV.filter((item) => !item.superAdminOnly || isSuperAdmin).map((item) => {
              const active = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className="px-3 py-1.5 rounded-md text-sm font-medium transition-colors"
                  style={{
                    backgroundColor: active ? '#13352F' : 'transparent',
                    color: active ? 'white' : '#6B7280',
                  }}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <p className="text-sm font-medium" style={{ color: '#181915' }}>{session?.user?.name}</p>
            <p className="text-xs" style={{ color: '#6B7280' }}>{session?.user?.email}</p>
          </div>
          {session?.user?.image && (
            <img src={session.user.image} alt="" className="w-9 h-9 rounded-full" />
          )}
          <button
            onClick={() => signOut({ callbackUrl: '/admin/login' })}
            className="text-sm ml-2 transition-colors"
            style={{ color: '#6B7280' }}
            onMouseEnter={(e) => (e.currentTarget.style.color = '#181915')}
            onMouseLeave={(e) => (e.currentTarget.style.color = '#6B7280')}
          >
            Sign out
          </button>
        </div>
      </div>
    </header>
  );
}
