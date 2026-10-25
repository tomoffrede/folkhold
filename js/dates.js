// Dates for events. A person types a date freely ("14.3.2024", "mid March 2024", "summer 2023", "2019-2021", "~2015")
// and parseDate() works out what is meant.
//
// A saved date looks like { from, to, text, src, yearly?, month?, day? }:
//   from, to  the first and last day it can mean, as "YYYY-MM-DD" (the same day for an exact date)
//   text      how it is shown, e.g. "Mid Mar 2024"
//   src       what the person typed (shown again when editing)
//   yearly    true for a day and month without a year ("14 Mar"); it has month and day instead of from and to
// Events saved earlier with { precision, day, month, year } are still understood (see modernize).

import { strings, t } from './strings.js';
import { fold, MONTH_LOOKUP, SEASONS, monthName, relativeDay as relativeDayOf, normalizeWords, APPROX, TO_WORDS } from './datewords.js';

// Month names and labels come from the language in use (see datewords.js and the "dates." texts in strings.js).
const dayMonth = (d, m, long = false) => t(long ? 'dates.dayMonthLong' : 'dates.dayMonth', { d, m: monthName(m, long) });
// "14–16 March": the first day is replaced by the range (German keeps its dots: "14.–16. März").
const dayRange = (a, b, m, long) => dayMonth(a, m, long).replace(new RegExp(`\\b${a}(\\.?)`), `${a}$1–${b}$1`);
const yearJoin = (long) => (long ? strings['dates.yearJoinLong'] : ' '); // Portuguese and Spanish write "14 de março de 2024" in full
const PARTS = ['early', 'mid', 'late'];
const partLabel = (part, x) => (part ? t(`dates.${part}`, { x }) : x);

export function daysInMonth(month, year) {
  return new Date(year || 2000, month, 0).getDate(); // without a year, 29 February is allowed
}

const pad = (n) => String(n).padStart(2, '0');
const iso = (y, m, d) => `${y}-${pad(m)}-${pad(d)}`;
const toTs = (text) => {
  const [y, m, d] = text.split('-').map(Number);
  return new Date(y, m - 1, d).getTime();
};
const fromTs = (ts) => {
  const d = new Date(ts);
  return iso(d.getFullYear(), d.getMonth() + 1, d.getDate());
};
const addDays = (text, n) => {
  const [y, m, d] = text.split('-').map(Number);
  return fromTs(new Date(y, m - 1, d + n).getTime());
};
const firstOf = (y, m) => iso(y, m, 1); // m may be 0 or 13: the date rolls over
const lastOf = (y, m) => fromTs(new Date(y, m, 0).getTime());
const monthShift = (y, m, step) => {
  const d = new Date(y, m - 1 + step, 1);
  return [d.getFullYear(), d.getMonth() + 1];
};

// ---------- reading what was typed ----------

// A two-digit year: 00-49 means 20xx ("27" is 2027), 50-99 means 19xx ("50" is 1950, "95" is 1995).
function expandYear(n) {
  return n + (n < 50 ? 2000 : 1900);
}

function validYear(year) {
  return year >= 1900 && year <= 2100;
}

// Turns pieces ({ kind, ... }) into a description with span and labels. Returns { error } for impossible dates.
function describe(p) {
  const month = (long) => monthName(p.m, long);
  if (p.y && !validYear(p.y)) return { error: 'invalid' };
  if (p.m && (p.m < 1 || p.m > 12)) return { error: 'invalid' };
  if (p.d && (p.d < 1 || p.d > daysInMonth(p.m, p.y))) return { error: 'invalid' };

  if (p.kind === 'exact') return { ...p, from: iso(p.y, p.m, p.d), to: iso(p.y, p.m, p.d), label: (l) => `${dayMonth(p.d, p.m, l)}${yearJoin(l)}${p.y}` };
  if (p.kind === 'yearly') return { ...p, label: (l) => dayMonth(p.d, p.m, l) };
  if (p.kind === 'month') {
    const last = daysInMonth(p.m, p.y);
    const [a, b] = p.part === 'early' ? [1, 10] : p.part === 'mid' ? [11, 20] : p.part === 'late' ? [21, last] : [1, last];
    return { ...p, vague: Boolean(p.part), from: iso(p.y, p.m, a), to: iso(p.y, p.m, Math.min(b, last)), label: (l) => partLabel(p.part, `${month(l)}${yearJoin(l)}${p.y}`) };
  }
  if (p.kind === 'year') {
    const [a, b] = p.part === 'early' ? [1, 4] : p.part === 'mid' ? [5, 8] : p.part === 'late' ? [9, 12] : [1, 12];
    return { ...p, vague: Boolean(p.part), from: firstOf(p.y, a), to: lastOf(p.y, b), label: () => partLabel(p.part, String(p.y)) };
  }
  // season
  const ranges = { Spring: [3, 5], Summer: [6, 8], Autumn: [9, 11], Winter: [12, 14] };
  const [a, b] = ranges[p.season];
  return { ...p, vague: true, from: firstOf(p.y, a), to: lastOf(p.y, b), label: () => `${strings[`dates.${p.season.toLowerCase()}`]} ${p.y}` };
}

// One date without a range. "ctx" can hold a year to use when the text has none (for the first half of a range).
function parseSingle(raw) {
  const s = raw.trim();
  const now = new Date();
  const relativeDay = relativeDayOf(s);
  if (relativeDay !== undefined) {
    const day = new Date(now.getFullYear(), now.getMonth(), now.getDate() + relativeDay);
    return describe({ kind: 'exact', y: day.getFullYear(), m: day.getMonth() + 1, d: day.getDate() });
  }
  let m = s.match(/^(\d{4})[./-](\d{1,2})[./-](\d{1,2})$/);
  if (m) return describe({ kind: 'exact', y: +m[1], m: +m[2], d: +m[3] });
  m = s.match(/^(\d{4})[./-](\d{1,2})$/);
  if (m && +m[2] >= 1 && +m[2] <= 12) return describe({ kind: 'month', y: +m[1], m: +m[2] });
  m = s.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4}|\d{2})$/);
  if (m) return describe({ kind: 'exact', y: m[3].length === 2 ? expandYear(+m[3]) : +m[3], m: +m[2], d: +m[1] });
  m = s.match(/^(\d{1,2})[./](\d{2})$/);
  if (m && +m[2] > 12) return describe({ kind: 'month', y: expandYear(+m[2]), m: +m[1] }); // "3/24" can only be March 2024
  m = s.match(/^(\d{1,2})[./](\d{4})$/);
  if (m) return describe({ kind: 'month', y: +m[2], m: +m[1] });
  m = s.match(/^(\d{1,2})[./](\d{1,2})\.?$/);
  if (m) return describe({ kind: 'yearly', m: +m[2], d: +m[1] });
  if (/^\d{4}$/.test(s)) return describe({ kind: 'year', y: +s });

  // Words: early/mid/late, a month or season name, a day and a year, in the usual orders.
  const words = normalizeWords(s)
    .replace(/(early|mid|late)[-\s]*/g, '$1 ')
    .replace(/[,.]/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  let part = null;
  if (PARTS.includes(words[0])) part = words.shift();
  let month = null;
  let season = null;
  let day = null;
  let year = null;
  const shorts = []; // one- or two-digit numbers: a day or a short year, depending on the words around them
  for (const word of words) {
    if (MONTH_LOOKUP[word] && !month && !season) month = MONTH_LOOKUP[word];
    else if (SEASONS[word] && !month && !season) season = SEASONS[word];
    else if (/^\d{4}$/.test(word) && year === null) year = +word;
    else if (/^['’]?\d{1,2}$/.test(word)) shorts.push({ n: +word.replace(/['’]/, ''), apostrophe: /^['’]/.test(word) });
    else return { error: 'unknown' };
  }
  if (!words.length) return { error: 'unknown' };
  // After early/mid/late or a season, or with no month, a short number can only be a year: "mid march 24" is March 2024.
  // Otherwise the first one is the day, unless it has an apostrophe or is above 31 ("march 95"), and a second one is the year.
  let short = null;
  const rest = [...shorts];
  if (rest.length) {
    const dayAllowed = month && !part && !season;
    if (dayAllowed && !rest[0].apostrophe && rest[0].n <= 31) day = rest.shift().n;
    if (rest.length) short = rest.shift();
    if (rest.length || (short && year !== null)) return { error: 'unknown' };
    if (short) year = expandYear(short.n);
  }
  if (!month && !season) {
    if (part && year && day === null) return describe({ kind: 'year', y: year, part });
    return { error: 'unknown' };
  }
  if (season) {
    if (part || day) return { error: 'unknown' };
    return year ? describe({ kind: 'season', season, y: year }) : { error: 'needYear' };
  }
  if (day) {
    if (part) return { error: 'unknown' };
    return year ? describe({ kind: 'exact', y: year, m: month, d: day }) : describe({ kind: 'yearly', m: month, d: day });
  }
  return year ? describe({ kind: 'month', y: year, m: month, part }) : { error: 'needYear' };
}

// "~" or a word like "around" in front makes a date approximate.
function stripApprox(text) {
  const m = text.trim().match(new RegExp(`^${APPROX}\\s*(.*)$`, 'i'));
  return m ? { approx: true, rest: m[1] } : { approx: false, rest: text.trim() };
}

// How much a ~ widens a date.
function widen(d) {
  if (d.kind === 'exact' || (d.kind === 'month' && d.part)) return { from: addDays(d.from, -3), to: addDays(d.to, 3) };
  if (d.kind === 'month') {
    const [fy, fm] = monthShift(d.y, d.m, -1);
    const [ty, tm] = monthShift(d.y, d.m, 1);
    return { from: firstOf(fy, fm), to: lastOf(ty, tm) };
  }
  if (d.kind === 'year' && !d.part) return { from: firstOf(d.y - 1, 1), to: lastOf(d.y + 1, 12) };
  const [fy, fm] = monthShift(+d.from.slice(0, 4), +d.from.slice(5, 7), -1);
  const [ty, tm] = monthShift(+d.to.slice(0, 4), +d.to.slice(5, 7), 1);
  return { from: firstOf(fy, fm), to: lastOf(ty, tm) };
}

// The span of a date as short text, for example "11–20 March", "Jun–Aug" or "2014–2016".
function spanNote(from, to) {
  const [fy, fm, fd] = from.split('-').map(Number);
  const [ty, tm, td] = to.split('-').map(Number);
  if (fy === ty && fm === tm) return fd === td ? dayMonth(fd, fm, true) : dayRange(fd, td, fm, true);
  if (fy === ty) return `${monthName(fm)}–${monthName(tm)}`;
  if (fm === 1 && fd === 1 && tm === 12 && td === 31) return `${fy}–${ty}`;
  return `${monthName(fm)} ${fy}–${monthName(tm)} ${ty}`;
}

function rangeLabel(left, right, long) {
  const plain = (d) => !d.part && d.kind;
  if (left.kind === 'month' && right.kind === 'month' && plain(left) && plain(right) && left.y === right.y) {
    return `${monthName(left.m, long)}–${monthName(right.m, long)}${yearJoin(long)}${left.y}`;
  }
  if (left.kind === 'exact' && right.kind === 'exact' && left.y === right.y && left.m === right.m) {
    return `${dayRange(left.d, right.d, left.m, long)}${yearJoin(long)}${left.y}`;
  }
  return `${left.label(long)}–${right.label(long)}`;
}

// Reads typed text. Returns { error: 'empty' | 'unknown' | 'invalid' | 'needYear' }
// or { date, reading, exact, yearly }, where "reading" is how the app understood it, e.g. "Mid March 2024 (~11–20 March)".
export function parseDate(input) {
  const typed = String(input || '').trim();
  if (!typed) return { error: 'empty' };
  const { approx, rest } = stripApprox(fold(typed));
  const text = rest
    .replace(/[–—]/g, '-')
    .replace(/(\d)\.(?=\s*-)/g, '$1') // "14.–16. März": the dot after a day is dropped
    .replace(/(\d)\.\s+(?=[a-z])/g, '$1 ')
    .replace(/^(?:del|de|du|von|vom|from)\s+(?=\d)/, ''); // "del 14 al 16 de marzo", "du 14 au 16 mars"
  if (!text) return { error: 'unknown' };

  let single = parseSingle(text);
  let range = null;
  let yearless = false; // a month, season or range without a year: it comes round every year
  if (single.error === 'needYear') {
    const dummy = parseSingle(`${text} ${DUMMY_YEAR}`);
    if (!dummy.error) {
      single = dummy;
      yearless = true;
    }
  }
  const toRegex = new RegExp(`-|\\b${TO_WORDS}\\b`);
  if (single.error && toRegex.test(text)) {
    const cut = text.split(new RegExp(`\\s*(?:-|\\b${TO_WORDS}\\b)\\s*`));
    // "14-16 march": the first half is only a day.
    const lead = cut.length === 2 && /^\d{1,2}$/.test(cut[0]) && cut[1].match(/^\d{1,2}\s+(.+)$/);
    if (lead) cut[0] = `${cut[0]} ${lead[1]}`;
    // A short year on the right half: "2019-21" and "june-august 22".
    if (cut.length === 2 && /^\d{2}$/.test(cut[1]) && /^\d{4}$/.test(cut[0])) cut[1] = String(Math.floor(+cut[0] / 100) * 100 + +cut[1]);
    const short = cut.length === 2 && cut[1].match(/^([a-z]+)\s+(\d{2})$/);
    if (short && /^[a-z]+$/.test(cut[0]) && MONTH_LOOKUP[short[1]]) cut[1] = `${short[1]} ${expandYear(+short[2])}`;
    if (cut.length === 2 && cut[0] && cut[1]) {
      let right = parseSingle(cut[1]);
      let left = parseSingle(cut[0]);
      const bare = (d) => d.error === 'needYear' || d.kind === 'yearly';
      if (bare(left) && bare(right)) {
        // No year on either side ("june-august", "14-16 march", "november-february"): every year.
        left = parseSingle(`${cut[0]} ${DUMMY_YEAR}`);
        right = parseSingle(`${cut[1]} ${DUMMY_YEAR}`);
        if (!left.error && !right.error && left.from > right.to) right = parseSingle(`${cut[1]} ${DUMMY_YEAR + 1}`);
        yearless = true;
      } else if (left.error === 'needYear' && right.y) left = parseSingle(`${cut[0]} ${right.y}`);
      if (!left.error && !right.error && left.from && right.from) {
        if (left.from <= right.to) range = { left, right };
        else return { error: 'invalid' };
      }
      else if (left.error === 'invalid' || right.error === 'invalid') return { error: 'invalid' };
    }
  }
  if (single.error && !range) return { error: single.error };

  let from;
  let to;
  let short;
  let long;
  let vague = false;
  if (range) {
    ({ from } = range.left);
    ({ to } = range.right);
    short = rangeLabel(range.left, range.right, false);
    long = rangeLabel(range.left, range.right, true);
  } else {
    ({ from, to, vague } = single);
    short = single.label(false);
    long = single.label(true);
    if (approx && single.kind !== 'yearly') {
      ({ from, to } = widen(single));
      vague = true;
    }
  }
  const yearly = !range && single.kind === 'yearly';
  if (approx && !yearly) {
    short = t('dates.approx', { x: short });
    long = t('dates.approx', { x: long });
  }

  let date;
  if (yearly) date = { yearly: true, month: single.m, day: single.d };
  else if (yearless) {
    const [, fm, fd] = from.split('-').map(Number);
    const [, tm, rawEnd] = to.split('-').map(Number);
    const td = tm === 2 && rawEnd === 28 ? 29 : rawEnd; // the end of February, in leap years too
    date = { yearly: true, month: fm, day: fd };
    if (fm !== tm || fd !== td) Object.assign(date, { endMonth: tm, endDay: td });
    short = noYear(short);
    long = noYear(long);
  } else date = { from, to };
  date.text = short;
  date.src = typed;
  const exact = !yearly && !yearless && from === to;
  let reading = long;
  if (!yearly && (vague || approx)) reading += ` (~${yearless ? noYear(spanNote(from, to)) : spanNote(from, to)})`;
  if (yearly || yearless) reading += ` (${strings['dates.everyYear']})`;
  const days = from ? (toTs(to) - toTs(from)) / 86400000 : 0;
  return { date, reading, exact, yearly: yearly || yearless, repeatable: !yearly && !yearless && days <= REPEAT_MAX_DAYS };
}

const DUMMY_YEAR = 2000; // a leap year, used to read dates that have no year
const REPEAT_MAX_DAYS = 100; // longer dates ("2019", "summer 2023 to 2024") cannot repeat every year
const noYear = (text) => text.replace(/\s*\b(19|20)\d\d\b/g, '');

// ---------- using saved dates ----------

// Older events saved { precision, day, month, year }; turn them into the current form.
export function modernize(date) {
  if (!date || date.from || date.yearly) return date || null;
  const { precision, day, month, year } = date;
  if (precision === 'monthDay') return { yearly: true, month, day, text: dayMonth(day, month) };
  if (precision === 'day') return { from: iso(year, month, day), to: iso(year, month, day), text: `${dayMonth(day, month)} ${year}` };
  if (precision === 'month') return { from: firstOf(year, month), to: lastOf(year, month), text: `${monthName(month)} ${year}` };
  return { from: firstOf(year, 1), to: lastOf(year, 12), text: String(year) };
}

// A date of a day and month without a year, in the saved form (used for birthdays shown as events).
export function yearlyDate(month, day) {
  return { yearly: true, month, day, text: dayMonth(day, month) };
}

// Dates are shown in the language in use: the text is made again from what was typed (or from the day and month),
// so changing the language also changes how saved dates read. Dates typed as "today" and the like keep their saved text.
export function formatDate(date) {
  const d = modernize(date);
  if (!d) return '';
  if (d.src && relativeDayOf(fold(d.src).trim()) === undefined) {
    const parsed = parseDate(d.src);
    if (!parsed.error && parsed.date) return parsed.date.text;
  } else if (d.yearly && !d.endMonth && !d.src) return dayMonth(d.day, d.month);
  return d.text || '';
}

// The text of a date in two short lines for a narrow column: ["14 Mar", "2024"].
export function dateLines(date) {
  const text = formatDate(date);
  const m = text.match(/^(.*[\p{L}.])\s+(\d{4})$/u);
  return m ? [m[1], m[2]] : [text, ''];
}

export function repeats(event) {
  const d = modernize(event.date);
  return Boolean(event.repeat) || Boolean(d && d.yearly);
}

export function startOfToday() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
}

// The first and last day a date can mean, as timestamps, or null for a day and month without a year.
export function span(date) {
  const d = modernize(date);
  return d && d.from ? { earliest: toTs(d.from), latest: toTs(d.to) } : null;
}

// When a date comes round every year: its first and last day as month and day, and the first year it counts from (0 = any).
// Covers "14 March", "mid December", "June to August" and dated events that are set to repeat.
export function yearlyInfo(event) {
  const d = modernize(event.date);
  if (!d) return null;
  if (d.yearly) return { m: d.month, d: d.day, em: d.endMonth || d.month, ed: d.endDay || d.day, startYear: 0 };
  const range = event.repeat ? span(d) : null;
  if (!range || (range.latest - range.earliest) / 86400000 > REPEAT_MAX_DAYS) return null;
  return { m: +d.from.slice(5, 7), d: +d.from.slice(8, 10), em: +d.to.slice(5, 7), ed: +d.to.slice(8, 10), startYear: +d.from.slice(0, 4) };
}

// The first and last day of one round of a yearly date, as timestamps. A round can run into the next year (December to February).
function round(info, year) {
  const day = (y, m, d) => new Date(y, m - 1, Math.min(d, daysInMonth(m, y))).getTime();
  const wraps = info.em < info.m || (info.em === info.m && info.ed < info.d);
  return { start: day(year, info.m, info.d), end: day(year + (wraps ? 1 : 0), info.em, info.ed) };
}

// The next day (today or later) the event happens or comes round again, or null when it is in the past for good.
// An event that is going on right now gives today.
export function nextOccurrence(event, today = startOfToday()) {
  const d = modernize(event.date);
  if (!d) return null;
  const info = yearlyInfo(event);
  if (info) {
    const thisYear = new Date(today).getFullYear();
    for (let year = Math.max(thisYear - 1, info.startYear); year <= thisYear + 1; year += 1) {
      const { start, end } = round(info, year);
      if (end >= today) return Math.max(start, today);
    }
    return null;
  }
  const range = span(d);
  return range && range.latest >= today ? Math.max(range.earliest, today) : null;
}

// True when a coming event is a single day (so "25 Oct" says everything) and false for a stretch of time ("Mid Dec").
export function isSingleDay(event) {
  const info = yearlyInfo(event);
  if (info) return info.m === info.em && info.d === info.ed;
  const range = span(event.date);
  return !range || range.earliest === range.latest;
}

// Coming events first (soonest first), then past ones (most recent first).
export function sortEvents(list, today = startOfToday()) {
  const keyed = list.map((event) => ({ event, next: nextOccurrence(event, today), past: (span(event.date) || { latest: 0 }).latest }));
  const coming = keyed.filter((item) => item.next !== null).sort((a, b) => a.next - b.next);
  const past = keyed.filter((item) => item.next === null).sort((a, b) => b.past - a.past);
  return [...coming, ...past].map((item) => item.event);
}

// "in 4 months", "tomorrow", "3 weeks ago" ...
export function relative(ts, today = startOfToday()) {
  const days = Math.round((ts - today) / 86400000);
  if (days === 0) return strings['rel.today'];
  if (days === 1) return strings['rel.tomorrow'];
  if (days === -1) return strings['rel.yesterday'];
  const n = Math.abs(days);
  let text;
  if (n < 14) text = t('rel.days', { n });
  else if (n < 60) text = t('rel.weeks', { n: Math.round(n / 7) });
  else if (n < 730) text = t('rel.months', { n: Math.round(n / 30.44) });
  else text = t('rel.years', { n: Math.round(n / 365.25) });
  return t(days > 0 ? 'rel.in' : 'rel.ago', { text });
}

// The most recent past event that two people shared ("together"), or null.
export function lastTogether(list, today = startOfToday()) {
  let best = null;
  let bestTime = -Infinity;
  list.forEach((event) => {
    const range = event.kind === 'together' ? span(event.date) : null;
    if (!range || range.earliest > today) return;
    const time = Math.min(range.latest, today);
    if (time > bestTime) {
      best = event;
      bestTime = time;
    }
  });
  return best ? { event: best, time: bestTime } : null;
}
