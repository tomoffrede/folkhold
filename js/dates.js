// Dates for events. A date is { precision, day?, month?, year? }, where precision says how exact it is:
//   'day' (day, month, year), 'monthDay' (day and month, every year), 'month' (month, year), 'year' (year only).
// Vague dates cover a whole span: "March 2024" is the span 1 to 31 March 2024.

const MONTHS = Array.from({ length: 12 }, (_, i) => new Date(2000, i, 1).toLocaleString('en-GB', { month: 'short' }));
export const PRECISIONS = ['day', 'monthDay', 'month', 'year'];
const NEEDS = { day: ['day', 'month', 'year'], monthDay: ['day', 'month'], month: ['month', 'year'], year: ['year'] };

export function monthNames() {
  return MONTHS;
}

export function needs(precision) {
  return NEEDS[precision];
}

export function daysInMonth(month, year) {
  return new Date(year || 2000, month, 0).getDate(); // without a year, 29 February is allowed
}

// Builds a date from typed parts. Returns { date } or { error: 'incomplete' | 'invalid' }.
export function buildDate(precision, parts) {
  const date = { precision };
  for (const key of NEEDS[precision]) {
    if (!parts[key]) return { error: 'incomplete' };
    date[key] = parts[key];
  }
  if (date.year && (date.year < 1900 || date.year > 2100)) return { error: 'invalid' };
  if (date.month && (date.month < 1 || date.month > 12)) return { error: 'invalid' };
  if (date.day && (date.day < 1 || date.day > daysInMonth(date.month, date.year))) return { error: 'invalid' };
  return { date };
}

export function formatDate(date) {
  if (!date) return '';
  const month = MONTHS[(date.month || 1) - 1];
  if (date.precision === 'day') return `${date.day} ${month} ${date.year}`;
  if (date.precision === 'monthDay') return `${date.day} ${month}`;
  if (date.precision === 'month') return `${month} ${date.year}`;
  return String(date.year);
}

export function repeats(event) {
  return Boolean(event.repeat) || (event.date && event.date.precision === 'monthDay');
}

const dayStart = (year, month, day) => new Date(year, month - 1, day).getTime();

export function startOfToday() {
  const now = new Date();
  return dayStart(now.getFullYear(), now.getMonth() + 1, now.getDate());
}

// The first and last moment a date can mean, or null for a day and month without a year.
export function span(date) {
  if (!date || date.precision === 'monthDay') return null;
  if (date.precision === 'day') return { earliest: dayStart(date.year, date.month, date.day), latest: dayStart(date.year, date.month, date.day) };
  if (date.precision === 'month') return { earliest: dayStart(date.year, date.month, 1), latest: dayStart(date.year, date.month, daysInMonth(date.month, date.year)) };
  return { earliest: dayStart(date.year, 1, 1), latest: dayStart(date.year, 12, 31) };
}

// The next day (today or later) the event happens or comes round again, or null when it is in the past for good.
export function nextOccurrence(event, today = startOfToday()) {
  const date = event.date;
  if (!date) return null;
  if (repeats(event) && date.day) {
    const first = Math.max(new Date(today).getFullYear(), date.year || 0);
    for (let year = first; year <= first + 1; year += 1) {
      const candidate = dayStart(year, date.month, Math.min(date.day, daysInMonth(date.month, year)));
      if (candidate >= today) return candidate;
    }
  }
  const range = span(date);
  return range && range.latest >= today ? range.earliest : null;
}

// Coming events first (soonest first), then past ones (most recent first).
export function sortEvents(list, today = startOfToday()) {
  const keyed = list.map((event) => ({ event, next: nextOccurrence(event, today), past: (span(event.date) || { latest: 0 }).latest }));
  const coming = keyed.filter((item) => item.next !== null).sort((a, b) => a.next - b.next);
  const past = keyed.filter((item) => item.next === null).sort((a, b) => b.past - a.past);
  return [...coming, ...past].map((item) => item.event);
}
