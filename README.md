# RevFactor Scheduler

A round-robin scheduling app for RevFactor sales calls. Team members set their weekly availability, visitors book 15-minute calls, and the system creates Google Calendar events with Google Meet links automatically.

## Features

- **Round-robin booking** — Multiple team members can be available at the same time. Visitors choose who to meet with, or get auto-assigned if only one person is free.
- **Weekly availability** — Each team member sets their recurring weekly hours via a simple toggle UI.
- **Google Calendar sync** — Checks real-time calendar availability so double-bookings don't happen.
- **Google Meet** — Every booking automatically creates a calendar event with a Meet link.
- **Embeddable** — Drop an `<iframe>` onto any existing page.

---

## Setup

### 1. Google Cloud Console

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project (or use an existing one)
3. Enable the **Google Calendar API**
4. Go to **Credentials** → **Create Credentials** → **OAuth 2.0 Client ID**
5. Application type: **Web application**
6. Add authorized redirect URIs:
   - `http://localhost:3000/api/auth/callback/google` (development)
   - `https://your-domain.vercel.app/api/auth/callback/google` (production)
7. Copy the **Client ID** and **Client Secret**

### 2. Clone and Install

```bash
git clone https://github.com/YOUR_USERNAME/revfactor-scheduler.git
cd revfactor-scheduler
npm install
```

### 3. Configure Environment

```bash
cp .env.example .env
```

Edit `.env` with your values:

```
GOOGLE_CLIENT_ID=your-client-id-here
GOOGLE_CLIENT_SECRET=your-client-secret-here
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=run-openssl-rand-base64-32
DATABASE_URL="file:./dev.db"
ADMIN_EMAILS=federico@blackbirdhm.com,emily@example.com
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_COMPANY_NAME=RevFactor
NEXT_PUBLIC_BOOKING_DURATION=15
NEXT_PUBLIC_TIMEZONE=America/New_York
```

Generate `NEXTAUTH_SECRET`:
```bash
openssl rand -base64 32
```

### 4. Initialize Database

```bash
npx prisma db push
```

### 5. Run Locally

```bash
npm run dev
```

- **Booking page:** http://localhost:3000
- **Admin dashboard:** http://localhost:3000/admin

---

## Deploy to Vercel

### 1. Push to GitHub

```bash
git init
git add .
git commit -m "Initial commit"
gh repo create revfactor-scheduler --public --push
```

### 2. Deploy on Vercel

1. Go to [vercel.com/new](https://vercel.com/new)
2. Import your GitHub repo
3. Add all environment variables from `.env` (use your production values)
4. For production, switch to a hosted database:
   - **Option A:** Add Vercel Postgres from the Vercel dashboard, then update the Prisma schema's `provider` from `"sqlite"` to `"postgresql"` and update `DATABASE_URL`
   - **Option B:** Use any PostgreSQL provider (Supabase, Neon, Railway, etc.)
5. Update `NEXTAUTH_URL` and `NEXT_PUBLIC_APP_URL` to your Vercel domain
6. Update the Google OAuth redirect URI to include your Vercel domain
7. Deploy!

### Switching to PostgreSQL (production)

In `prisma/schema.prisma`, change:
```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```

Then run `npx prisma db push` against your production database.

---

## Embed on Your Website

Add this iframe wherever you want the booking widget:

```html
<iframe
  src="https://your-domain.vercel.app/embed"
  width="100%"
  height="700"
  frameborder="0"
  style="border: none; max-width: 520px;"
></iframe>
```

---

## How It Works

1. **Admin (you + Emily)** sign in at `/admin` with Google
2. Set weekly availability (toggle days, set start/end times)
3. **Visitors** go to the booking page, pick a date
4. The system shows available 15-min slots based on:
   - Your set weekly availability
   - Real-time Google Calendar free/busy data
   - Existing bookings
5. If both team members are free at a time, the visitor chooses who to meet
6. If only one is free, they're auto-assigned
7. On booking, a Google Calendar event with Google Meet is created for both the host and visitor

---

## Tech Stack

- **Next.js 14** (App Router)
- **NextAuth.js** (Google OAuth)
- **Prisma** (SQLite dev / PostgreSQL production)
- **Google Calendar API** (free/busy + event creation)
- **Tailwind CSS**
