# RevFactor Scheduler

Part of Fede's private multi-business stack; internal context lives in a private vault — ask Fede.

## What this is
A round-robin scheduling app for RevFactor sales calls (deployed at schedule.revfactor.io). Team members set weekly availability, visitors book 15-minute calls, and the system creates Google Calendar events with Google Meet links automatically. Booking is embeddable via `<iframe>`; visitors either choose who to meet with or get auto-assigned when only one team member is free. Real-time Google Calendar free/busy checks prevent double-booking.

## Stack
- **Framework**: Next.js 14 (App Router), React 18, TypeScript
- **Auth**: NextAuth 4 (Google OAuth) + `@next-auth/prisma-adapter`
- **Database**: Prisma 5 — SQLite locally (`file:./dev.db`), PostgreSQL in production
- **Integrations**: Google Calendar + Google Meet via `googleapis`
- **UI**: Tailwind CSS 3
- **Dates**: `date-fns` + `date-fns-tz`

## How to run
- Install: `npm install` (runs `prisma generate` via postinstall)
- Env: copy `.env.example` to `.env`, fill Google OAuth creds, `NEXTAUTH_SECRET` (`openssl rand -base64 32`), `DATABASE_URL`, and the `NEXT_PUBLIC_*` app settings
- DB: `npx prisma db push` (or `npm run db:push`); seed with `npm run db:seed`
- Dev: `npm run dev` — booking page at `/`, admin dashboard at `/admin`
- Build: `npm run build` (runs `prisma generate` then `next build`)
- For production, switch the Prisma `datasource` provider from `sqlite` to `postgresql`

## Conventions
- Admin access is gated by the `ADMIN_EMAILS` env var (comma-separated)
- App config is driven by `NEXT_PUBLIC_*` env vars (company name, booking duration, timezone)
- Prisma models: `User`, `Account`, `Session`, `Availability`, `DateOverride`, `Booking`, `Faq`, `Resource`
- Pages live under `src/app/` (App Router); API routes under `src/app/api/*`; shared helpers in `src/lib/*`
- The `embed/` route serves the iframe-embeddable booking widget
