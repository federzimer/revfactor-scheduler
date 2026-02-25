import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getGoogleAccessToken } from '@/lib/auth';
import { google } from 'googleapis';

// GET /api/debug-freebusy?date=2026-03-03
// Debug endpoint to check why freebusy isn't working
export async function GET(req: NextRequest) {
  const date = req.nextUrl.searchParams.get('date') || '2026-03-03';
  const timezone = process.env.NEXT_PUBLIC_TIMEZONE || 'America/New_York';

  const adminEmails = (process.env.ADMIN_EMAILS || '').split(',').map((e) => e.trim().toLowerCase());

  const debug: any = {
    date,
    timezone,
    adminEmails,
    users: [],
  };

  const adminUsers = await prisma.user.findMany({
    where: { email: { in: adminEmails } },
  });

  for (const user of adminUsers) {
    const userDebug: any = {
      id: user.id,
      email: user.email,
      name: user.name,
    };

    // Check if account exists
    const account = await prisma.account.findFirst({
      where: { userId: user.id, provider: 'google' },
    });

    if (!account) {
      userDebug.error = 'No Google account linked';
      debug.users.push(userDebug);
      continue;
    }

    userDebug.hasRefreshToken = !!account.refresh_token;
    userDebug.hasAccessToken = !!account.access_token;
    userDebug.tokenExpiresAt = account.expires_at
      ? new Date(account.expires_at * 1000).toISOString()
      : 'no expiry set';
    userDebug.tokenExpired = account.expires_at
      ? account.expires_at * 1000 < Date.now()
      : 'unknown';

    // Try to get access token
    const accessToken = await getGoogleAccessToken(user.id);
    userDebug.gotAccessToken = !!accessToken;

    if (!accessToken) {
      userDebug.error = 'Failed to get access token (refresh may have failed)';
      debug.users.push(userDebug);
      continue;
    }

    // Try the freebusy call
    try {
      const auth = new google.auth.OAuth2();
      auth.setCredentials({ access_token: accessToken });
      const calendar = google.calendar({ version: 'v3', auth });

      const response = await calendar.freebusy.query({
        requestBody: {
          timeMin: `${date}T00:00:00`,
          timeMax: `${date}T23:59:59`,
          timeZone: timezone,
          items: [{ id: 'primary' }],
        },
      });

      userDebug.freebusyResponse = {
        calendars: response.data.calendars,
        timeMin: response.data.timeMin,
        timeMax: response.data.timeMax,
      };

      const busySlots = response.data.calendars?.primary?.busy || [];
      userDebug.busySlotCount = busySlots.length;
      userDebug.busySlots = busySlots;

      // Also test with explicit UTC conversion
      const startUTC = new Date(`${date}T00:00:00`);
      // Convert local midnight to UTC
      const tzOffset = getTimezoneOffset(timezone, startUTC);
      userDebug.tzOffsetMinutes = tzOffset;

    } catch (error: any) {
      userDebug.freebusyError = {
        message: error?.message,
        code: error?.code,
        status: error?.response?.status,
        data: error?.response?.data,
      };
    }

    // Also try listing events directly for this date
    try {
      const auth = new google.auth.OAuth2();
      auth.setCredentials({ access_token: accessToken });
      const calendar = google.calendar({ version: 'v3', auth });

      const eventsResponse = await calendar.events.list({
        calendarId: 'primary',
        timeMin: `${date}T00:00:00-05:00`, // EST
        timeMax: `${date}T23:59:59-05:00`,
        singleEvents: true,
        orderBy: 'startTime',
        maxResults: 20,
      });

      userDebug.eventsOnDate = (eventsResponse.data.items || []).map((e) => ({
        summary: e.summary,
        start: e.start?.dateTime || e.start?.date,
        end: e.end?.dateTime || e.end?.date,
        status: e.status,
        transparency: e.transparency, // 'transparent' means "free", undefined/opaque means "busy"
      }));
    } catch (error: any) {
      userDebug.eventsError = error?.message;
    }

    debug.users.push(userDebug);
  }

  return NextResponse.json(debug, { status: 200 });
}

function getTimezoneOffset(timezone: string, date: Date): number {
  const utcStr = date.toLocaleString('en-US', { timeZone: 'UTC' });
  const tzStr = date.toLocaleString('en-US', { timeZone: timezone });
  return (new Date(utcStr).getTime() - new Date(tzStr).getTime()) / 60000;
}
