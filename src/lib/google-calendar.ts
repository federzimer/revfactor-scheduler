import { google } from 'googleapis';
import { getGoogleAccessToken } from './auth';

export interface BusySlot {
  start: string;
  end: string;
}

export interface CalendarEvent {
  id: string;
  summary: string;
  start: string;
  end: string;
  meetLink?: string;
}

/**
 * Get the UTC offset string for a timezone on a given date (e.g. "-05:00" for EST)
 */
function getTimezoneOffsetString(timezone: string, date: Date): string {
  // Use Intl to find the UTC offset for the given timezone
  const utcDate = new Date(date.toLocaleString('en-US', { timeZone: 'UTC' }));
  const tzDate = new Date(date.toLocaleString('en-US', { timeZone: timezone }));
  const offsetMinutes = (utcDate.getTime() - tzDate.getTime()) / 60000;
  const sign = offsetMinutes <= 0 ? '+' : '-';
  const absOffset = Math.abs(offsetMinutes);
  const hours = String(Math.floor(absOffset / 60)).padStart(2, '0');
  const minutes = String(absOffset % 60).padStart(2, '0');
  return `${sign}${hours}:${minutes}`;
}

/**
 * Get start of day as RFC3339 timestamp in the given timezone
 */
function getStartOfDayISO(date: string, timezone: string): string {
  const d = new Date(`${date}T12:00:00Z`); // use noon to avoid DST edge cases
  const offset = getTimezoneOffsetString(timezone, d);
  return `${date}T00:00:00${offset}`;
}

/**
 * Get end of day as RFC3339 timestamp in the given timezone
 */
function getEndOfDayISO(date: string, timezone: string): string {
  const d = new Date(`${date}T12:00:00Z`);
  const offset = getTimezoneOffsetString(timezone, d);
  return `${date}T23:59:59${offset}`;
}

function getCalendarClient(accessToken: string) {
  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: accessToken });
  return google.calendar({ version: 'v3', auth });
}

/**
 * Get busy times from Google Calendar for a user on a specific date
 */
export async function getBusyTimes(
  userId: string,
  date: string, // "2025-03-15"
  timezone: string
): Promise<BusySlot[]> {
  const accessToken = await getGoogleAccessToken(userId);
  if (!accessToken) {
    // No usable token (never connected, or refresh failed/revoked). Signal the caller
    // to SKIP this host rather than returning an empty busy list — an empty list reads
    // as "fully free" and would let visitors book a host whose calendar we can't touch.
    throw new Error('NO_CALENDAR_ACCESS');
  }

  const calendar = getCalendarClient(accessToken);

  // Google freebusy API requires full RFC3339 timestamps with timezone offset
  // We use the timezone to construct proper ISO strings
  try {
    // Build proper Date objects for the start/end of the day in the given timezone
    const timeMin = getStartOfDayISO(date, timezone);
    const timeMax = getEndOfDayISO(date, timezone);
    console.log(`Freebusy query for ${date}: timeMin=${timeMin}, timeMax=${timeMax}`);

    const response = await calendar.freebusy.query({
      requestBody: {
        timeMin,
        timeMax,
        timeZone: timezone,
        items: [{ id: 'primary' }],
      },
    });

    const busySlots = response.data.calendars?.primary?.busy || [];
    console.log(`Freebusy for user ${userId} on ${date}: ${busySlots.length} busy slots`);
    return busySlots.map((slot) => ({
      start: slot.start || '',
      end: slot.end || '',
    }));
  } catch (error: any) {
    console.error(`Error fetching busy times for user ${userId}:`, error?.message || error);
    return [];
  }
}

/**
 * Get busy times from Google Calendar for a user over a date range (single API call).
 * Returns a map of date string -> BusySlot[].
 */
export async function getBusyTimesRange(
  userId: string,
  fromDate: string, // "2025-03-01"
  toDate: string,   // "2025-03-31"
  timezone: string
): Promise<Record<string, BusySlot[]>> {
  const accessToken = await getGoogleAccessToken(userId);
  if (!accessToken) {
    // See getBusyTimes: signal the caller to skip this host instead of reporting
    // an empty (== fully free) busy map.
    throw new Error('NO_CALENDAR_ACCESS');
  }

  const calendar = getCalendarClient(accessToken);

  try {
    const timeMin = getStartOfDayISO(fromDate, timezone);
    const timeMax = getEndOfDayISO(toDate, timezone);
    console.log(`Freebusy range query ${fromDate} to ${toDate}: timeMin=${timeMin}, timeMax=${timeMax}`);

    const response = await calendar.freebusy.query({
      requestBody: {
        timeMin,
        timeMax,
        timeZone: timezone,
        items: [{ id: 'primary' }],
      },
    });

    const busySlots = response.data.calendars?.primary?.busy || [];
    console.log(`Freebusy range for user ${userId} (${fromDate} to ${toDate}): ${busySlots.length} busy slots`);

    // Group busy slots by date in the admin's timezone
    const byDate: Record<string, BusySlot[]> = {};
    for (const slot of busySlots) {
      if (!slot.start || !slot.end) continue;

      // Determine which date(s) this busy slot falls on in the admin's timezone
      const startDate = new Date(slot.start);
      const endDate = new Date(slot.end);

      // Get the local date for the start of the busy slot
      const startLocalDate = new Intl.DateTimeFormat('en-CA', {
        timeZone: timezone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).format(startDate);

      const endLocalDate = new Intl.DateTimeFormat('en-CA', {
        timeZone: timezone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).format(endDate);

      // Add to all dates the busy slot spans
      const d = new Date(startLocalDate + 'T12:00:00');
      const end = new Date(endLocalDate + 'T12:00:00');
      while (d <= end) {
        const dateStr = d.toISOString().split('T')[0];
        if (!byDate[dateStr]) byDate[dateStr] = [];
        byDate[dateStr].push({ start: slot.start, end: slot.end });
        d.setDate(d.getDate() + 1);
      }
    }

    return byDate;
  } catch (error: any) {
    console.error(`Error fetching busy times range for user ${userId}:`, error?.message || error);
    return {};
  }
}

/**
 * Delete a Google Calendar event from the host's primary calendar (best-effort).
 * Used when a booking/lead is deleted so no phantom event lingers on the rep's calendar.
 */
export async function deleteCalendarEvent(userId: string, eventId: string): Promise<boolean> {
  const accessToken = await getGoogleAccessToken(userId);
  if (!accessToken) return false;

  const calendar = getCalendarClient(accessToken);
  try {
    await calendar.events.delete({ calendarId: 'primary', eventId, sendUpdates: 'none' });
    return true;
  } catch (error) {
    console.error('Error deleting calendar event:', error);
    return false;
  }
}

/**
 * Create a Google Calendar event with Google Meet.
 *
 * The event is created on the host's (rep's) primary calendar and the LEAD is added as
 * an attendee with `sendUpdates: 'all'`, so Google emails them a real invite and the
 * meeting lands on their own calendar. (An earlier version deliberately left the lead
 * off to keep the rep's email private, but that meant leads never got an invite and
 * routinely missed calls — reversed 2026-07-16.) The n8n confirmation/reminder emails
 * still fire in addition to the Google invite.
 */
export async function createCalendarEvent(
  userId: string,
  params: {
    summary: string;
    description: string;
    startTime: string; // ISO string
    endTime: string;   // ISO string
    attendeeEmail: string;
    hostEmail: string;
    timezone: string;
  }
): Promise<CalendarEvent | null> {
  const accessToken = await getGoogleAccessToken(userId);
  if (!accessToken) return null;

  const calendar = getCalendarClient(accessToken);

  try {
    const response = await calendar.events.insert({
      calendarId: 'primary',
      conferenceDataVersion: 1,
      sendUpdates: 'all', // Google emails the lead the invite so the call is on their calendar
      requestBody: {
        summary: params.summary,
        description: params.description,
        start: {
          dateTime: params.startTime,
          timeZone: params.timezone,
        },
        end: {
          dateTime: params.endTime,
          timeZone: params.timezone,
        },
        attendees: [{ email: params.attendeeEmail }],
        conferenceData: {
          createRequest: {
            requestId: `revfactor-${Date.now()}`,
            conferenceSolutionKey: { type: 'hangoutsMeet' },
          },
        },
        reminders: {
          useDefault: false,
          overrides: [
            { method: 'email', minutes: 15 },
            { method: 'popup', minutes: 5 },
          ],
        },
        guestsCanModify: false,
        guestsCanSeeOtherGuests: false,
      },
    });

    const event = response.data;
    return {
      id: event.id || '',
      summary: event.summary || '',
      start: event.start?.dateTime || '',
      end: event.end?.dateTime || '',
      meetLink: event.hangoutLink || undefined,
    };
  } catch (error) {
    console.error('Error creating calendar event:', error);
    return null;
  }
}
