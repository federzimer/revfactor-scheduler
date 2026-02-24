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
 * Check if a time slot overlaps with any busy slot
 */
export function isSlotBusy(
  slotStart: string, // "10:00"
  slotEnd: string,   // "10:15"
  date: string,      // "2025-03-15"
  busySlots: { start: string; end: string }[],
  timezone: string
): boolean {
  const slotStartDate = new Date(`${date}T${slotStart}:00`);
  const slotEndDate = new Date(`${date}T${slotEnd}:00`);

  return busySlots.some((busy) => {
    const busyStart = new Date(busy.start);
    const busyEnd = new Date(busy.end);
    return slotStartDate < busyEnd && slotEndDate > busyStart;
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
