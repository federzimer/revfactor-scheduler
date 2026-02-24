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
  if (!accessToken) return [];

  const calendar = getCalendarClient(accessToken);

  const startOfDay = `${date}T00:00:00`;
  const endOfDay = `${date}T23:59:59`;

  try {
    const response = await calendar.freebusy.query({
      requestBody: {
        timeMin: new Date(`${startOfDay}`).toISOString(),
        timeMax: new Date(`${endOfDay}`).toISOString(),
        timeZone: timezone,
        items: [{ id: 'primary' }],
      },
    });

    const busySlots = response.data.calendars?.primary?.busy || [];
    return busySlots.map((slot) => ({
      start: slot.start || '',
      end: slot.end || '',
    }));
  } catch (error) {
    console.error('Error fetching busy times:', error);
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
