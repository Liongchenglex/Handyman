/**
 * Visit time slots — single source of truth for every time picker in
 * the app (customer booking form, handyman ASAP-accept and propose-time
 * modals, the customer /pick-time deep-link page).
 *
 * Slot strings are stored verbatim as the job's preferredTime, so they
 * must stay ≤ 20 characters (the schedule proposal endpoints reject
 * longer time strings).
 */

export const TIME_SLOTS = [
  '09:00 AM - 11:00 AM',
  '11:00 AM - 01:00 PM',
  '01:00 PM - 03:00 PM',
  '03:00 PM - 05:00 PM',
];

/** Minutes-since-midnight of a slot's START, e.g. "01:00 PM - …" → 780. */
export const parseSlotStartMinutes = (slot) => {
  const m = /^(\d{1,2}):(\d{2})\s*(AM|PM)/i.exec(slot || '');
  if (!m) return 0;
  let hour = parseInt(m[1], 10) % 12;
  if (m[3].toUpperCase() === 'PM') hour += 12;
  return hour * 60 + parseInt(m[2], 10);
};

const isSameCalendarDay = (a, b) =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();

/**
 * True when `slot`'s start has already passed for the given visit date.
 * Only today can have passed slots; any other (or missing) date is
 * always selectable. Accepts the date as a Date or a 'YYYY-MM-DD'
 * string (what <input type="date"> produces — parsed as a LOCAL day,
 * not UTC, so an SGT evening correctly disables today's slots).
 */
export const isSlotInPastForDate = (slot, visitDate, now = new Date()) => {
  if (!visitDate) return false;
  let d;
  if (visitDate instanceof Date) {
    d = visitDate;
  } else {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(visitDate));
    if (!m) return false;
    d = new Date(parseInt(m[1], 10), parseInt(m[2], 10) - 1, parseInt(m[3], 10));
  }
  if (!isSameCalendarDay(d, now)) return false;
  return parseSlotStartMinutes(slot) <= now.getHours() * 60 + now.getMinutes();
};

/** First slot still selectable for the date, or '' when the day is spent. */
export const firstAvailableSlot = (visitDate, now = new Date()) =>
  TIME_SLOTS.find((slot) => !isSlotInPastForDate(slot, visitDate, now)) || '';
