/**
 * Generate 15-minute time slots between start and end times
 */
export function generateTimeSlots(
  startTime: string, // "09:00"
  endTime: string,   // "17:00"
  durationMinutes: number = 15
): { start: string; end: string }[] {
  const slots: { start: string; end: string }[] = [];
  const [startH, startM] = startTime.split(':').map(Number);
  const [endH, endM] = endTime.split(':').map(Number);

  let currentMinutes = startH * 60 + startM;
  const endMinutes = endH * 60 + endM;

  while (currentMinutes + durationMinutes <= endMinutes) {
    const slotStartH = Math.floor(currentMinutes / 60);
    const slotStartM = currentMinutes % 60;
    const slotEndMinutes = currentMinutes + durationMinutes;
    const slotEndH = Math.floor(slotEndMinutes / 60);
    const slotEndM = slotEndMinutes % 60;

    slots.push({
      start: `${String(slotStartH).padStart(2, '0')}:${String(slotStartM).padStart(2, '0')}`,
      end: `${String(slotEndH).padStart(2, '0')}:${String(slotEndM).padStart(2, '0')}`,
    });

    currentMinutes += durationMinutes;
  }

  return slots;
}

/**
 * Check if a time slot overlaps with any busy slot.
 * Slot times are in the admin's local timezone (e.g. "10:00" in America/New_York).
 * Busy slot times from Google are ISO strings in UTC.
 *
 * Instead of doing manual timezone math, we convert the Google busy times
 * FROM UTC TO the admin's local timezone for comparison, since slot times
 * are already in local timezone.
 */
export function isSlotBusy(
  slotStart: string, // "10:00"
  slotEnd: string,   // "10:15"
  date: string,      // "2025-03-15"
  busySlots: { start: string; end: string }[],
  timezone: string
): boolean {
  // Convert slot times to minutes since midnight (local timezone)
  const [startH, startM] = slotStart.split(':').map(Number);
  const [endH, endM] = slotEnd.split(':').map(Number);
  const slotStartMin = startH * 60 + startM;
  const slotEndMin = endH * 60 + endM;

  return busySlots.some((busy) => {
    // Convert Google's UTC busy times to local timezone using Intl
    const busyStartDate = new Date(busy.start);
    const busyEndDate = new Date(busy.end);

    // Format busy times in the admin's timezone to get local hours/minutes
    const formatOpts: Intl.DateTimeFormatOptions = {
      timeZone: timezone,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    };

    const busyStartLocal = new Intl.DateTimeFormat('en-CA', formatOpts).format(busyStartDate);
    const busyEndLocal = new Intl.DateTimeFormat('en-CA', formatOpts).format(busyEndDate);

    // en-CA format: "2025-03-15, 10:30" — extract date and time
    const [busyStartDateStr, busyStartTimeStr] = busyStartLocal.split(', ');
    const [busyEndDateStr, busyEndTimeStr] = busyEndLocal.split(', ');

    // Only consider busy times that overlap with the requested date
    // A busy block could span midnight, so check both start and end dates
    if (busyStartDateStr !== date && busyEndDateStr !== date) return false;

    // Convert busy times to minutes since midnight
    const [bsH, bsM] = busyStartTimeStr.split(':').map(Number);
    const [beH, beM] = busyEndTimeStr.split(':').map(Number);

    let busyStartMin = bsH * 60 + bsM;
    let busyEndMin = beH * 60 + beM;

    // If the busy block started on a previous day, treat start as midnight
    if (busyStartDateStr < date) busyStartMin = 0;
    // If the busy block ends on a future day, treat end as end of day
    if (busyEndDateStr > date) busyEndMin = 24 * 60;

    // Standard overlap check
    return slotStartMin < busyEndMin && slotEndMin > busyStartMin;
  });
}

/**
 * Format time from "14:00" to "2:00 PM"
 */
export function formatTime(time: string): string {
  const [h, m] = time.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  const displayH = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${displayH}:${String(m).padStart(2, '0')} ${period}`;
}

/**
 * Get day name from day number
 */
export function getDayName(day: number): string {
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  return days[day];
}

/**
 * Get short day name
 */
export function getShortDayName(day: number): string {
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  return days[day];
}
