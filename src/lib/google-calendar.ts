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
    console.warn(`No access token for user ${userId} — skipping freebusy check`);
    return [];
  }

  const calendar = getCalendarClient(accessToken);

  // Use timezone-aware date construction to avoid UTC offset issues on Vercel
  // The Google Calendar API freebusy endpoint accepts ISO strings and a timeZone param
  try {
    const response = await calendar.freebusy.query({
      requestBody: {
        timeMin: `${date}T00:00:00`,
        timeMax: `${date}T23:59:59`,
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
 * Create a Google Calendar event with Google Meet
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
      sendUpdates: 'all', // Send email notifications to all attendees
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
        attendees: [
          { email: params.attendeeEmail },            // visitor gets invite
          { email: params.hostEmail, organizer: true }, // host gets notification
        ],
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
