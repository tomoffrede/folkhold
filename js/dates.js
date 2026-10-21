// Dates for events. A person types a date freely ("14.3.2024", "mid March 2024", "summer 2023", "2019-2021", "~2015")
// and parseDate() works out what is meant.
//
// A saved date looks like { from, to, text, src, yearly?, month?, day? }:
//   from, to  the first and last day it can mean, as "YYYY-MM-DD" (the same day for an exact date)
//   text      how it is shown, e.g. "Mid Mar 2024"
//   src       what the person typed (shown again when editing)
//   yearly    true for a day and month without a year ("14 Mar"); it has month and day instead of from and to
// Events saved earlier with { precision, day, month, year } are still understood (see modernize).

const LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const SHORT = LONG.map((name) => name.slice(0, 3));
const MONTH_LOOKUP = {};
LONG.forEach((name, i) => {
  MONTH_LOOKUP[name.toLowerCase()] = i + 1;
  MONTH_LOOKUP[name.slice(0, 3).toLowerCase()] = i + 1;
});
MONTH_LOOKUP.sept = 9;
const SEASONS = { spring: 'Spring', summer: 'Summer', autumn: 'Autumn', fall: 'Autumn', winter: 'Winter' };
const PARTS = ['early', 'mid', 'late'];
const cap = (word) => word.charAt(0).toUpperCase() + word.slice(1);

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

function validYear(year) {
  return year >= 1900 && year <= 2100;
}

// Turns pieces ({ kind, ... }) into a description with span and labels. Returns { error } for impossible dates.
function describe(p) {
  const month = (long) => (long ? LONG : SHORT)[p.m - 1];
  if (p.y && !validYear(p.y)) return { error: 'invalid' };
  if (p.m && (p.m < 1 || p.m > 12)) return { error: 'invalid' };
  if (p.d && (p.d < 1 || p.d > daysInMonth(p.m, p.y))) return { error: 'invalid' };

  if (p.kind === 'exact') return { ...p, from: iso(p.y, p.m, p.d), to: iso(p.y, p.m, p.d), label: (l) => `${p.d} ${month(l)} ${p.y}` };
  if (p.kind === 'yearly') return { ...p, label: (l) => `${p.d} ${month(l)}` };
  if (p.kind === 'month') {
    const last = daysInMonth(p.m, p.y);
    const [a, b] = p.part === 'early' ? [1, 10] : p.part === 'mid' ? [11, 20] : p.part === 'late' ? [21, last] : [1, last];
    return { ...p, vague: Boolean(p.part), from: iso(p.y, p.m, a), to: iso(p.y, p.m, Math.min(b, last)), label: (l) => `${p.part ? `${cap(p.part)} ` : ''}${month(l)} ${p.y}` };
  }
  if (p.kind === 'year') {
    const [a, b] = p.part === 'early' ? [1, 4] : p.part === 'mid' ? [5, 8] : p.part === 'late' ? [9, 12] : [1, 12];
    return { ...p, vague: Boolean(p.part), from: firstOf(p.y, a), to: lastOf(p.y, b), label: () => `${p.part ? `${cap(p.part)} ` : ''}${p.y}` };
  }
  // season
  const ranges = { Spring: [3, 5], Summer: [6, 8], Autumn: [9, 11], Winter: [12, 14] };
  const [a, b] = ranges[p.season];
  return { ...p, vague: true, from: firstOf(p.y, a), to: lastOf(p.y, b), label: () => `${p.season} ${p.y}` };
}

// One date without a range. "ctx" can hold a year to use when the text has none (for the first half of a range).
function parseSingle(raw) {
  const s = raw.trim();
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (m) return describe({ kind: 'exact', y: +m[1], m: +m[2], d: +m[3] });
  m = s.match(/^(\d{4})-(\d{1,2})$/);
  if (m && +m[2] >= 1 && +m[2] <= 12) return describe({ kind: 'month', y: +m[1], m: +m[2] });
  m = s.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4}|\d{2})$/);
  if (m) {
    let y = +m[3];
    if (m[3].length === 2) y += y <= (new Date().getFullYear() % 100) ? 2000 : 1900;
    return describe({ kind: 'exact', y, m: +m[2], d: +m[1] });
  }
  m = s.match(/^(\d{1,2})[./](\d{4})$/);
  if (m) return describe({ kind: 'month', y: +m[2], m: +m[1] });
  m = s.match(/^(\d{1,2})[./](\d{1,2})\.?$/);
  if (m) return describe({ kind: 'yearly', m: +m[2], d: +m[1] });
  if (/^\d{4}$/.test(s)) return describe({ kind: 'year', y: +s });

  // Words: early/mid/late, a month or season name, a day and a year, in the usual orders.
  const words = s
    .replace(/\b(\d{1,2})(st|nd|rd|th)\b/g, '$1')
    .replace(/\b(beginning|start)\b/g, 'early')
    .replace(/\bmiddle\b/g, 'mid')
    .replace(/\bend\b/g, 'late')
    .replace(/\bof\b/g, ' ')
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
  for (const word of words) {
    if (MONTH_LOOKUP[word] && !month && !season) month = MONTH_LOOKUP[word];
    else if (SEASONS[word] && !month && !season) season = SEASONS[word];
    else if (/^\d{4}$/.test(word) && year === null) year = +word;
    else if (/^\d{1,2}$/.test(word) && day === null) day = +word;
    else return { error: 'unknown' };
  }
  if (!words.length) return { error: 'unknown' };
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
  const m = text.trim().match(/^(?:~|≈|c\.|ca\.|circa\b|around\b|about\b|approx\.?|approximately\b)\s*(.*)$/i);
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
  if (fy === ty && fm === tm) return fd === td ? `${fd} ${LONG[fm - 1]}` : `${fd}–${td} ${LONG[fm - 1]}`;
  if (fy === ty) return `${SHORT[fm - 1]}–${SHORT[tm - 1]}`;
  if (fm === 1 && fd === 1 && tm === 12 && td === 31) return `${fy}–${ty}`;
  return `${SHORT[fm - 1]} ${fy}–${SHORT[tm - 1]} ${ty}`;
}

function rangeLabel(left, right, long) {
  const plain = (d) => !d.part && d.kind;
  if (left.kind === 'month' && right.kind === 'month' && plain(left) && plain(right) && left.y === right.y) {
    return `${(long ? LONG : SHORT)[left.m - 1]}–${(long ? LONG : SHORT)[right.m - 1]} ${left.y}`;
  }
  if (left.kind === 'exact' && right.kind === 'exact' && left.y === right.y && left.m === right.m) {
    return `${left.d}–${right.d} ${(long ? LONG : SHORT)[left.m - 1]} ${left.y}`;
  }
  return `${left.label(long)}–${right.label(long)}`;
}

// Reads typed text. Returns { error: 'empty' | 'unknown' | 'invalid' | 'needYear' }
// or { date, reading, exact, yearly }, where "reading" is how the app understood it, e.g. "Mid March 2024 (~11–20 March)".
export function parseDate(input) {
  const typed = String(input || '').trim();
  if (!typed) return { error: 'empty' };
  const { approx, rest } = stripApprox(typed);
  const text = rest.toLowerCase().replace(/[–—]/g, '-');
  if (!text) return { error: 'unknown' };

  let single = parseSingle(text);
  let range = null;
  if (single.error && /-|\bto\b|\buntil\b/.test(text)) {
    const cut = text.split(/\s*(?:-|\bto\b|\buntil\b)\s*/);
    if (cut.length === 2 && cut[0] && cut[1]) {
      const right = parseSingle(cut[1]);
      let left = parseSingle(cut[0]);
      if (left.error === 'needYear' && right.y) left = parseSingle(`${cut[0]} ${right.y}`);
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
    short = `c. ${short}`;
    long = `c. ${long}`;
  }

  const date = yearly ? { yearly: true, month: single.m, day: single.d } : { from, to };
  date.text = short;
  date.src = typed;
  const exact = !yearly && from === to;
  let reading = long;
  if (!yearly && (vague || approx)) reading += ` (~${spanNote(from, to)})`;
  if (yearly) reading += ' (every year)';
  return { date, reading, exact, yearly };
}

// ---------- using saved dates ----------

// Older events saved { precision, day, month, year }; turn them into the current form.
export function modernize(date) {
  if (!date || date.from || date.yearly) return date || null;
  const { precision, day, month, year } = date;
  if (precision === 'monthDay') return { yearly: true, month, day, text: `${day} ${SHORT[month - 1]}` };
  if (precision === 'day') return { from: iso(year, month, day), to: iso(year, month, day), text: `${day} ${SHORT[month - 1]} ${year}` };
  if (precision === 'month') return { from: firstOf(year, month), to: lastOf(year, month), text: `${SHORT[month - 1]} ${year}` };
  return { from: firstOf(year, 1), to: lastOf(year, 12), text: String(year) };
}

export function formatDate(date) {
  const d = modernize(date);
  return d ? d.text || '' : '';
}

// The text of a date in two short lines for a narrow column: ["14 Mar", "2024"].
export function dateLines(date) {
  const text = formatDate(date);
  const m = text.match(/^(.*[A-Za-z])\s+(\d{4})$/);
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

// The next day (today or later) the event happens or comes round again, or null when it is in the past for good.
export function nextOccurrence(event, today = startOfToday()) {
  const d = modernize(event.date);
  if (!d) return null;
  const range = span(d);
  const yearly = d.yearly || (event.repeat && range && range.earliest === range.latest);
  if (yearly) {
    const [month, day] = d.yearly ? [d.month, d.day] : [+d.from.slice(5, 7), +d.from.slice(8, 10)];
    const first = Math.max(new Date(today).getFullYear(), d.yearly ? 0 : +d.from.slice(0, 4));
    for (let year = first; year <= first + 1; year += 1) {
      const candidate = new Date(year, month - 1, Math.min(day, daysInMonth(month, year))).getTime();
      if (candidate >= today) return candidate;
    }
  }
  return range && range.latest >= today ? Math.max(range.earliest, today) : null;
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
  if (days === 0) return 'today';
  if (days === 1) return 'tomorrow';
  if (days === -1) return 'yesterday';
  const n = Math.abs(days);
  let text;
  if (n < 14) text = `${n} days`;
  else if (n < 60) text = `${Math.round(n / 7)} weeks`;
  else if (n < 730) text = `${Math.round(n / 30.44)} months`;
  else text = `${Math.round(n / 365.25)} years`;
  return days > 0 ? `in ${text}` : `${text} ago`;
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
