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
import { fold, MONTH_LOOKUP, SEASONS, monthName, relativeDay as relativeDayOf, normalizeWords, APPROX, APPROX_END, TO_WORDS, WEEKDAYS, NUMBER_WORDS, UNITS, MODIFIERS, usOrder } from './datewords.js';

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
  return year >= 1800 && year <= 2100;
}

// Turns pieces ({ kind, ... }) into a description with span and labels. Returns { error } for impossible dates.
function describe(p) {
  const month = (long) => monthName(p.m, long);
  if (p.y && !validYear(p.y)) return { error: 'invalid' };
  if (p.m != null && (p.m < 1 || p.m > 12)) return { error: 'invalid' }; // 0 is not a month either
  if (p.d != null && (p.d < 1 || p.d > daysInMonth(p.m, p.y))) return { error: 'invalid' };

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
  if (p.kind === 'span') return { ...p, vague: Boolean(p.vague), label: () => p.text }; // a stretch with its own wording: "Q1 2024", "1990s", "3–9 Nov 2026"
  // season (early, mid and late are the first, middle and last month of it)
  const ranges = { Spring: [3, 5], Summer: [6, 8], Autumn: [9, 11], Winter: [12, 14] };
  let [a, b] = ranges[p.season];
  if (p.part) [a, b] = p.part === 'early' ? [a, a] : p.part === 'mid' ? [a + 1, a + 1] : [b, b];
  return { ...p, vague: true, from: firstOf(p.y, a), to: lastOf(p.y, b), label: () => partLabel(p.part, `${strings[`dates.${p.season.toLowerCase()}`]} ${p.y}`) };
}

// Two numbers next to each other, like "5/3": day first or month first, as chosen in Settings. If the chosen order is impossible
// ("14/3" with month first) the other order is used, so a date is never refused for being written the other way.
function dayAndMonth(a, b) {
  let [d, m] = usOrder() ? [b, a] : [a, b];
  if (m > 12 && d <= 12) [d, m] = [m, d];
  return { d, m };
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
  if (m) {
    const { d, m: mo } = dayAndMonth(+m[1], +m[2]);
    return describe({ kind: 'exact', y: m[3].length === 2 ? expandYear(+m[3]) : +m[3], m: mo, d });
  }
  m = s.match(/^(\d{1,2})[./](\d{2})$/);
  // "3/24" is March 2024 (day first); with month first it is 24 March, unless the second number is no day.
  if (m && +m[2] > 12 && !(usOrder() && +m[1] <= 12 && +m[2] <= 31)) return describe({ kind: 'month', y: expandYear(+m[2]), m: +m[1] });
  m = s.match(/^(\d{1,2})[./](\d{4})$/);
  if (m) return describe({ kind: 'month', y: +m[2], m: +m[1] });
  m = s.match(/^(\d{1,2})[./](\d{1,2})\.?$/);
  if (m) {
    const { d, m: mo } = dayAndMonth(+m[1], +m[2]);
    return describe({ kind: 'yearly', m: mo, d });
  }
  if (/^\d{4}$/.test(s)) return describe({ kind: 'year', y: +s });
  m = s.match(/^['’](\d{2})$/);
  if (m) return describe({ kind: 'year', y: expandYear(+m[1]) });

  const family = familyRead(s);
  if (family) return family;

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
    if (day === 0) return { error: 'invalid' };
    if (rest.length) short = rest.shift();
    if (rest.length || (short && year !== null)) return { error: 'unknown' };
    if (short) year = expandYear(short.n);
  }
  if (!month && !season) {
    if (part && year && day === null) return describe({ kind: 'year', y: year, part });
    return { error: 'unknown' };
  }
  if (season) {
    if (day) return { error: 'unknown' };
    return year ? describe({ kind: 'season', season, y: year, part }) : { error: 'needYear' };
  }
  if (day) {
    if (part) return { error: 'unknown' };
    return year ? describe({ kind: 'exact', y: year, m: month, d: day }) : describe({ kind: 'yearly', m: month, d: day });
  }
  return year ? describe({ kind: 'month', y: year, m: month, part }) : { error: 'needYear' };
}

// ---------- quarters, halves, decades ----------

const ORDINAL_WORDS = {
  first: 1, erste: 1, primera: 1, seconde: 2, tercera: 3, erster: 1, erstes: 1, ersten: 1, premier: 1, premiere: 1, primer: 1, primero: 1, primeiro: 1, primeira: 1,
  second: 2, zweite: 2, zweiter: 2, zweites: 2, zweiten: 2, deuxieme: 2, segundo: 2, segunda: 2,
  third: 3, dritte: 3, drittes: 3, dritten: 3, troisieme: 3, tercer: 3, tercero: 3, terceiro: 3, terceira: 3,
  fourth: 4, vierte: 4, viertes: 4, vierten: 4, quatrieme: 4, cuarto: 4, quarto: 4, quarta: 4,
};
const DECADE_WORDS = {
  twenties: 20, thirties: 30, forties: 40, fifties: 50, sixties: 60, seventies: 70, eighties: 80, nineties: 90, noughties: 0,
  zwanziger: 20, dreissiger: 30, vierziger: 40, funfziger: 50, sechziger: 60, siebziger: 70, achtziger: 80, neunziger: 90,
};
const PERIOD_WORD = '(?:quarter|quartal|trimestre|trimester|half|halfte|halbjahr|semestre|semester|quinzaine|quincena|quinzena)';

const spanText = (from, to, long) => {
  const [fy, fm, fd] = from.split('-').map(Number);
  const [ty, tm, td] = to.split('-').map(Number);
  if (fy === ty && fm === tm) return `${dayRange(fd, td, fm, long)}${yearJoin(long)}${fy}`;
  if (fy === ty) return `${dayMonth(fd, fm, long)}–${dayMonth(td, tm, long)}${yearJoin(long)}${fy}`;
  return `${dayMonth(fd, fm, long)}${yearJoin(long)}${fy}–${dayMonth(td, tm, long)}${yearJoin(long)}${ty}`;
};

// Quarters ("Q1 2024", "1. Quartal 2024"), halves of a year ("H2 2024") or of a month ("first half of March"), and decades ("the 90s").
function familyRead(raw) {
  let s = raw.replace(/,/g, ' ').replace(/\s+/g, ' ').trim();
  // "first quarter", "erste Märzhälfte": the number word becomes a digit
  s = s.replace(new RegExp(`\\b([a-z]+)\\b(?=\\s+(?:[a-z]+halfte\\b|${PERIOD_WORD}\\b))`, 'g'), (all, word) => (ORDINAL_WORDS[word] ? ORDINAL_WORDS[word] : all));
  s = s.replace(/\b(\d)\s+([a-z]+?)halfte\b/, '$1 half $2');
  let m;
  const year = (text) => (text ? (text.length === 2 ? expandYear(+text) : +text) : null);

  m = s.match(/^(?:(\d)\s*(?:quarter|quartal|trimestre|trimester|q|t)|[qt]\s*(\d))(?:\s+(\d{4}|\d{2}))?$/);
  if (m) {
    const q = +(m[1] || m[2]);
    const y = year(m[3]);
    if (q < 1 || q > 4) return { error: 'invalid' };
    if (!y) return { error: 'needYear' };
    return describe({ kind: 'span', y, from: firstOf(y, q * 3 - 2), to: lastOf(y, q * 3), text: `Q${q} ${y}`, vague: true });
  }
  m = s.match(/^(?:kw|cw|wk|week|woche|semaine|semana|sem)\s*(\d{1,2})(?:\s+(\d{4}|\d{2}))?$/);
  if (m) {
    const y = year(m[2]);
    if (+m[1] < 1 || +m[1] > 53) return { error: 'invalid' };
    if (!y) return { error: 'needYear' };
    const jan4 = new Date(y, 0, 4);
    const monday = new Date(y, 0, 4 - ((jan4.getDay() || 7) - 1) + (+m[1] - 1) * 7);
    const sunday = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 6);
    const from = fromTs(monday.getTime());
    const to = fromTs(sunday.getTime());
    return describe({ kind: 'span', y, from, to, text: spanText(from, to, false), vague: false });
  }
  m = s.match(/^(?:(\d)\s*(?:half|halbjahr|semestre|semester|s)|[hs]\s*(\d))(?:\s+(\d{4}|\d{2}))?$/);
  if (m) {
    const h = +(m[1] || m[2]);
    const y = year(m[3]);
    if (h < 1 || h > 2) return { error: 'invalid' };
    if (!y) return { error: 'needYear' };
    return describe({ kind: 'span', y, from: firstOf(y, h === 1 ? 1 : 7), to: lastOf(y, h === 1 ? 6 : 12), text: `H${h} ${y}`, vague: true });
  }
  m = s.match(/^(\d)\s*(?:half|halfte|quinzaine|quincena|quinzena)\s+([a-z]+)(?:\s+(\d{4}|\d{2}))?$/);
  if (m && MONTH_LOOKUP[m[2]]) {
    const month = MONTH_LOOKUP[m[2]];
    const y = year(m[3]);
    if (+m[1] < 1 || +m[1] > 2) return { error: 'invalid' };
    if (!y) return { error: 'needYear' };
    const first = +m[1] === 1;
    const from = iso(y, month, first ? 1 : 16);
    const to = iso(y, month, first ? 15 : daysInMonth(month, y));
    return describe({ kind: 'span', y, from, to, text: spanText(from, to, false), vague: true });
  }

  // Decades: "1990s", "the 90s", "in den 90ern", "années 90", "Ende der Neunziger", "early 90s"
  m = s.match(/^(early|mid|late)?[-\s]*(?:(annees|anos|years|jahre|decada|decade)\s+)?(?:(\d{4}|\d{2})\s*(s|er|ern|ers)?|([a-z]+))$/);
  if (m) {
    const [, part, word, digits, suffix, name] = m;
    if (name && DECADE_WORDS[name] !== undefined) return decade(part, DECADE_WORDS[name] >= 30 ? 1900 + DECADE_WORDS[name] : 2000 + DECADE_WORDS[name]);
    if (digits && (suffix || word) && +digits % 10 === 0) return decade(part, digits.length === 4 ? +digits : +digits >= 30 ? 1900 + +digits : 2000 + +digits);
  }
  return null;
}

function decade(part, start) {
  if (start < 1800 || start > 2090) return { error: 'invalid' };
  const [a, b] = part === 'early' ? [0, 3] : part === 'mid' ? [4, 6] : part === 'late' ? [7, 9] : [0, 9];
  return describe({ kind: 'span', y: start, from: firstOf(start + a, 1), to: lastOf(start + b, 12), text: partLabel(part, `${start}s`), vague: true });
}

// ---------- "last week", "2 years ago", "next friday" ----------

// Returns a description, or null when the text is not a relative date.
function relativeRead(raw) {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const at = (n) => new Date(today.getFullYear(), today.getMonth(), today.getDate() + n);
  const exact = (d) => describe({ kind: 'exact', y: d.getFullYear(), m: d.getMonth() + 1, d: d.getDate() });
  const monthOf = (y, m) => {
    const d = new Date(y, m - 1, 1);
    return describe({ kind: 'month', y: d.getFullYear(), m: d.getMonth() + 1 });
  };
  const span = (a, b) => {
    const from = fromTs(a.getTime());
    const to = fromTs(b.getTime());
    return describe({ kind: 'span', y: a.getFullYear(), from, to, text: spanText(from, to, false), vague: false });
  };
  const text = raw.replace(/[,.]/g, ' ').replace(/\b[dl]'/g, ' ').replace(/\s+/g, ' ').trim();
  if (!text) return null;

  // "2 years ago", "vor zwei Wochen", "il y a 3 mois", "hace una semana", "in 2 weeks", "dans 3 jours", "daqui a 2 semanas"
  const num = '(\\d+|[a-z]+)';
  const past = text.match(new RegExp(`^(?:(?:vor|il y a|hace|faz|ha)\\s+${num}\\s+([a-z-]+)|${num}\\s+([a-z-]+)\\s+ago)$`));
  const future = text.match(new RegExp(`^(?:in|dans|dentro de|daqui a|en|em|binnen)\\s+${num}\\s+([a-z-]+)$`));
  const hit = past || future;
  if (hit) {
    const [n0, u0] = past ? (hit[1] ? [hit[1], hit[2]] : [hit[3], hit[4]]) : [hit[1], hit[2]];
    const n = /^\d+$/.test(n0) ? +n0 : NUMBER_WORDS[n0];
    const unit = UNITS[u0];
    if (n && unit && unit !== 'weekend') {
      const dir = past ? -1 : 1;
      if (unit === 'day') return exact(at(dir * n));
      if (unit === 'week') return exact(at(dir * n * 7));
      if (unit === 'month') return monthOf(today.getFullYear(), today.getMonth() + 1 + dir * n);
      return describe({ kind: 'year', y: today.getFullYear() + dir * n });
    }
  }

  // "last week", "this month", "next year", "vendredi dernier", "el mes que viene", "mês que vem", "last march", "next friday", "last summer"
  const tokens = text.split(' ');
  const skip = new Set(['the', 'a', 'el', 'la', 'le', 'les', 'lo', 'los', 'las', 'o', 'os', 'no', 'na', 'nos', 'nas', 'em', 'en', 'in', 'on', 'at', 'im', 'am', 'dem', 'den', 'das', 'die', 'der', 'de', 'da', 'do', 'del', 'du', 'zum', 'que', 'of']);
  let direction = null;
  const core = [];
  tokens.forEach((token) => {
    if (token === 'vem' || token === 'viene') direction = 1;
    else if (MODIFIERS[token] !== undefined && direction === null) direction = MODIFIERS[token];
    else if (!skip.has(token)) core.push(token);
  });
  if (direction === null || core.length !== 1) return null;
  const word = core[0];
  const unit = UNITS[word];
  const dayNumber = today.getDay();
  if (unit === 'week') {
    const monday = at(1 - (dayNumber || 7) + direction * 7);
    return span(monday, new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 6));
  }
  if (unit === 'weekend') {
    const saturday = at((dayNumber === 0 ? -1 : 6 - dayNumber) + direction * 7);
    return span(saturday, new Date(saturday.getFullYear(), saturday.getMonth(), saturday.getDate() + 1));
  }
  if (unit === 'month') return monthOf(today.getFullYear(), today.getMonth() + 1 + direction);
  if (unit === 'year') return describe({ kind: 'year', y: today.getFullYear() + direction });
  if (unit === 'day') return null;
  if (WEEKDAYS[word] !== undefined) {
    const wanted = WEEKDAYS[word];
    let diff = (wanted - dayNumber + 7) % 7;
    if (direction < 0) diff = diff === 0 ? -7 : diff - 7;
    else if (direction > 0 && diff === 0) diff = 7;
    return exact(at(diff));
  }
  const month = MONTH_LOOKUP[word];
  if (month) {
    const here = today.getMonth() + 1;
    const y = today.getFullYear();
    if (direction === 0) return monthOf(y, month);
    if (direction < 0) return monthOf(month < here ? y : y - 1, month);
    return monthOf(month > here ? y : y + 1, month);
  }
  if (SEASONS[word]) {
    const season = SEASONS[word];
    const startMonth = { Spring: 3, Summer: 6, Autumn: 9, Winter: 12 }[season];
    const range = (y) => [new Date(y, startMonth - 1, 1), new Date(y, startMonth + 2, 0)];
    const y = today.getFullYear();
    let pick = y;
    if (direction === 0) pick = season === 'Winter' && today.getMonth() < 2 ? y - 1 : y;
    else if (direction < 0) pick = [y, y - 1, y - 2].find((c) => range(c)[1] < today);
    else pick = [y, y + 1, y + 2].find((c) => range(c)[0] > today);
    return describe({ kind: 'season', season, y: pick });
  }
  return null;
}

// ---------- cleaning what was typed ----------

const WEEKDAY_NAMES = Object.keys(WEEKDAYS).sort((a, b) => b.length - a.length).join('|');
const WEEKDAY_RE = new RegExp(`\\b(?:${WEEKDAY_NAMES})(?![a-z])(?:[- ]feira)?\\b[.,]?(?!\\s+(?:quinzena|quincena|trimestre|metade|semestre|hal))`, 'g');
const LEADING_FILLER = /^(?:a(?=\s+(?:la|mediados|principios|finales|fines|comienzos|inicios)\b)|on|in|at|the|am|an|im|den|der|dem|die|das|zum|zur|ab|le|la|les|el|los|las|lo|en|au|aux|dans|em|no|na|nos|nas|o|os|do|dos|da|du|de|del|des|von|vom|from|since|seit|depuis|desde|day|days|dia|dias|jour|tag|tage|mes|mois|month|monat|year|jahr|jahre|ano|annee|anno|courant|whole|all|of)\b[.,]?\s*/;

// Takes away what does not matter: times, weekdays ("Tuesday"), words like "on the" or "le", "first" for 1.
function clean(text) {
  let s = text
    .replace(/(\d)t(?=\d{1,2}:\d{2})/g, '$1 ') // 2024-03-05T10:00
    .replace(/\s*(?:\b(?:um|at|a las|a la|as|a|à)\s+)?\d{1,2}:\d{2}(?::\d{2})?(?:\s*(?:uhr|h|am|pm)\b)?(?:z\b)?/g, ' ')
    .replace(/\s*(?:\bum\s+)?\b\d{1,2}\s*uhr\b/g, ' ')
    .replace(/\b(?:weekend|wochenende|week-end|fin de semana|fin de semaine|fim de semana)\b/g, ' ')
    .replace(/\bmar[.,]?\s+(?=\d{1,2}(?:st|nd|rd|th|º|°|o)?\s+(?:de\s+)?[a-z]{3})/g, ' ') // "mar 5 de marzo" (Tuesday), not "Mar 5, 2024" (March)
    .replace(/\b(?:mo|di|mi|do|fr|sa|so)(?:[.,]|\s+(?=\d))/g, ' ') // German short weekdays: "Di, 5.3."
    .replace(WEEKDAY_RE, ' ')
    .replace(/\blos\s+(\d0)\b/g, '$1s') // "los 90"
    .replace(/\s+/g, ' ')
    .trim();
  // "le premier mars", "el primero de marzo", "primeiro de março": the first day
  s = s.replace(/\b(?:premier|primero|primeiro|first)\s+(?:of\s+|de\s+)?([a-z]+)/g, (all, next) => (MONTH_LOOKUP[next] ? `1 ${next}` : all));
  let before;
  do {
    before = s;
    s = s.replace(LEADING_FILLER, '');
  } while (s !== before);
  return s;
}

// Adds a year to a date that has none: "20.10" becomes "20.10.2026", "20 oct" becomes "20 oct 2026".
function withYear(text, year) {
  const numeric = text.match(/^(\d{1,2})([./-])(\d{1,2})\.?$/);
  return numeric ? `${numeric[1]}${numeric[2]}${numeric[3]}${numeric[2]}${year}` : `${text} ${year}`;
}

// "~" or a word like "around" in front (or "or so" behind) makes a date approximate.
function stripApprox(text) {
  let rest = text.trim();
  let approx = false;
  const end = rest.match(APPROX_END);
  if (end) {
    rest = rest.slice(0, end.index).trim();
    approx = true;
  }
  const m = rest.match(new RegExp(`^${APPROX}\\s*(.*)$`, 'i'));
  return m ? { approx: true, rest: m[1] } : { approx, rest };
}

// Everything that happens to the typed text before it is read: filler words, weekdays and times are dropped, "between X and Y" and
// "5 and 6 March" become ranges, spacing and compact forms ("5 / 3 / 2024", "20240305", "5-Mar-2024") are tidied.
const TIME_PARTS = /\b\d{1,2}:\d{2}\s*-\s*\d{1,2}:\d{2}(?:\s*(?:am|pm|uhr|h))?|(?:\b(?:at|um|a las|a la|as|a|à)\s+)?\b\d{1,2}(?::\d{2})?\s*(?:am|pm)\b|\b(?:in the |this )?(?:morning|afternoon|evening|noon|midday|midnight)\b/g;
const WEEKDAY_ONLY = Object.keys(WEEKDAYS).filter((w) => !MONTH_LOOKUP[w] && w.length >= 3).sort((a, b) => b.length - a.length).join('|');
const WEEKDAY_SPAN = new RegExp(`\\(\\s*(?:${WEEKDAY_ONLY})\\s*(?:-|to|bis|au|a|al|ao)\\s*(?:${WEEKDAY_ONLY})\\s*\\)|\\b(?:${WEEKDAY_ONLY})\\.?\\s*(?:-|to|bis|au|a|al|ao)\\s*(?:${WEEKDAY_ONLY})\\b\\.?`, 'g');

function prepare(typed) {
  const folded = fold(typed)
    .replace(TIME_PARTS, ' ')
    .replace(WEEKDAY_SPAN, ' ')
    .replace(/\s+(?:inclusive|inclusif|inclus|inklusive|einschliesslich|incluido|incluso|inclusivo|inclusiva)\b/g, '')
    .replace(/^(?:all\s+through|throughout|durante|during)\s+/, '')
    .replace(/\s+/g, ' ')
    .trim();
  const bare = folded.replace(/^(?:the|el|le|la|lo)\s+/, '');
  if (relativeDayOf(bare) !== undefined) return { rel: parseSingle(bare), text: bare, approx: false };
  const rel = relativeRead(folded);
  if (rel) return { rel, text: folded, approx: false };

  const between = /^(?:between|entre|zwischen)\s/.test(folded);
  const first = stripApprox(folded.replace(/^(?:between|entre|zwischen)\s+/, ''));
  const second = stripApprox(clean(first.rest));
  const approx = first.approx || second.approx;
  const rest = second.rest;
  let text = normalizeWords(
    clean(rest)
      .replace(/\b([a-z]{3,})\s+(?:de|del)\s+(\d{2})$/, (all, word, yy) => (MONTH_LOOKUP[word] ? `${word} '${yy}` : all)) // "marzo del 24": a year
      .replace(/[–—]/g, '-')
      .replace(/(\d)\.(?=\s*-)/g, '$1') // "14.–16. März": the dot after a day is dropped
      .replace(/(\d)\.\s+(?=[a-z])/g, '$1 '),
  )
    .replace(/\s+/g, ' ')
    .replace(/^[,;\s]+|[,;\s]+$/g, '');
  if (between) text = text.replace(/ (?:and|und|et|y|e) /, ' - ');
  text = text.replace(/^([a-z]{3,})\.?\/([a-z]{3,})\.?(?= |$)/, (all, x, y) => (MONTH_LOOKUP[x] && MONTH_LOOKUP[y] ? `${x} - ${y}` : all)); // "Nov/Dec 2026"
  text = text.replace(/^([a-z]{3,})\.? (\d{1,2}) (?:and|und|et|y|e|&|\+) (\d{1,2})(,?(?: .*)?)$/, (all, x, a, b, rest) => (MONTH_LOOKUP[x] ? `${x} ${a} - ${b}${rest}` : all)); // "Nov 20 & 21, 2026"
  text = text.replace(/^(\d{2}|\d{4})(?:s|er|ern|ers)? (?:and|&|und|et|y|e|\/) (\d{2}|\d{4})(s|er|ern|ers)$/, '$1$3 - $2$3'); // "the 80s and 90s"
  text = text.replace(/^(\d{4}-\d{2})\/(\d{4}-\d{2})$/, '$1 - $2'); // "2026-11/2027-02"
  text = text.replace(/^(\d{1,2})\.?\s*(?:and|und|et|y|e|&|\+|\/)\s*(?=(\d{1,2})\s+([a-z]+))/, (all, day, n, word) => (MONTH_LOOKUP[word] ? `${day} - ` : all)); // "5 and 6 March", "5./6. März"

  if (/^[\d\s./-]+$/.test(text)) {
    text = text.replace(/(\d)\s*([./])\s*(?=\d)/g, '$1$2'); // "5. 3. 2024", "5 / 3 / 2024"
    text = text.replace(/^(\d{1,2})\s+(\d{1,2})\s+(\d{4})$/, '$1.$2.$3').replace(/^(\d{4})\s+(\d{1,2})\s+(\d{1,2})$/, '$1-$2-$3');
    const compact = text.match(/^(\d{4})(\d{2})(\d{2})$/);
    if (compact && +compact[2] >= 1 && +compact[2] <= 12 && +compact[3] >= 1 && +compact[3] <= 31) text = `${compact[1]}-${compact[2]}-${compact[3]}`;
    text = text.replace(/^(\d{4}-\d{2}-\d{2})\s*\/\s*(\d{4}-\d{2}-\d{2})$/, '$1 - $2');
    const years = text.match(/^(\d{4})\/(\d{4}|\d{2})$/);
    if (years && +years[2].slice(-2) === (+years[1] + 1) % 100) text = `${years[1]} - ${years[2]}`; // "2019/2020", "2019/20": two years
  }
  text = text
    .replace(/^(\d{1,2})[-/.]([a-z]{3,})[-/.](\d{2}|\d{4})$/, '$1 $2 $3') // "5-Mar-2024"
    .replace(/^(\d{4})[-/.]([a-z]{3,})[-/.](\d{1,2})$/, '$3 $2 $1') // "2024-Mar-05"
    .replace(/^([a-z]{3,})[-/.](\d{4})$/, '$1 $2').replace(/^([a-z]{3,})[-/.](\d{2})$/, "$1 '$2"); // "mar/2024", "mar-24"
  return { rel: null, text, approx };
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
  // The same year on both sides is written once, at the end: "28 Oct–8 Nov 2026".
  const dated = (d) => (d.kind === 'exact' || (d.kind === 'month' && !d.part)) && d.y;
  if (dated(left) && dated(right) && left.y === right.y) {
    const bit = (d) => (d.kind === 'exact' ? dayMonth(d.d, d.m, long) : monthName(d.m, long));
    return `${bit(left)}–${bit(right)}${yearJoin(long)}${right.y}`;
  }
  return `${left.label(long)}–${right.label(long)}`;
}

// "3 days from Nov 20 2026", "Nov 20 2026 for 3 days", "5 nights from 1 March 2024": a start date and how long it lasts.
function durationRead(s) {
  let n;
  let unit;
  let start;
  let m = s.match(/^(?:for\s+)?(\d{1,2}|[a-z]+)\s+(day|night|week)s?\s+(?:from|starting|beginning)\s+(.+)$/);
  if (m) [, n, unit, start] = m;
  else {
    m = s.match(/^(.+?)\s+for\s+(\d{1,2}|[a-z]+)\s+(day|night|week)s?$/);
    if (!m) return null;
    [, start, n, unit] = m;
  }
  n = /^\d+$/.test(n) ? +n : NUMBER_WORDS[n];
  if (!n) return null;
  const first = parseDate(start);
  if (first.error || !first.date.from || first.date.from !== first.date.to) return null;
  const days = unit === 'week' ? 7 * n - 1 : unit === 'night' ? n : n - 1;
  return days ? parseDate(`${first.date.from} - ${addDays(first.date.from, days)}`) : first;
}

// Reads typed text. Returns { error: 'empty' | 'unknown' | 'invalid' | 'needYear' }
// or { date, reading, exact, yearly }, where "reading" is how the app understood it, e.g. "Mid March 2024 (~11–20 March)".
export function parseDate(input) {
  const typed = String(input || '').trim();
  if (!typed) return { error: 'empty' };
  const timed = durationRead(fold(typed));
  if (timed) return timed;
  const { rel, text: prepared, approx } = prepare(typed);
  if (!prepared) return { error: 'unknown' };
  // "winter 2023/24 to spring 2024": a winter is named by the year it starts in.
  const text = prepared.replace(/\b([a-z]+)\s+(\d{4})\s*[-/]\s*(\d{2})(?!\d)/g, (all, w, y1, y2) => (SEASONS[w] === 'Winter' && +y2 === (+y1 + 1) % 100 ? `${w} ${y1}` : all));
  // "week of March 4 2024": that week, Monday to Sunday.
  const wk = text.match(/^(?:week|woche|semaine|semana)\s+(?!\d{1,2}(?:\s+\d{4})?$)(?:(?:starting|beginning|commencing|ab)\s+)?(.+)$/);
  if (wk) {
    const inner = parseDate(wk[1]);
    if (!inner.error && inner.date.from && inner.date.from === inner.date.to) return parseDate(`${inner.date.from} - ${addDays(inner.date.from, 6)}`);
  }

  let single = rel || parseSingle(text);
  let range = null;
  let yearless = false; // a month, season or range without a year: it comes round every year
  if (single.error === 'needYear') {
    const dummy = parseSingle(`${text} ${DUMMY_YEAR}`);
    if (!dummy.error) {
      single = dummy;
      yearless = true;
    }
  }
  // "winter 2024-25" (or 2024/25): the winter that starts in the first year.
  const winter = text.match(/^([a-z]+)\s+(\d{4})\s*[-/]\s*(\d{2}|\d{4})$/);
  if (winter && SEASONS[winter[1]] === 'Winter' && +winter[3].slice(-2) === (+winter[2] + 1) % 100) {
    return parseDate(`${winter[1]} ${winter[2]}`);
  }
  const toRegex = new RegExp(`-|\\b${TO_WORDS}\\b`);
  if (single.error && toRegex.test(text)) {
    // A hyphen with spaces around it (or a word like "to") is the safest place to cut: "2026-10-20 - 2026-11-17".
    let cut = text.split(new RegExp(`\\s+-\\s+|\\s*\\b${TO_WORDS}\\b\\s*`));
    if (cut.length !== 2) cut = text.split(new RegExp(`\\s*(?:-|\\b${TO_WORDS}\\b)\\s*`));
    // "14-16 march": the first half is only a day.
    const lead = cut.length === 2 && /^\d{1,2}$/.test(cut[0]) && cut[1].match(/^\d{1,2}\s+(.+)$/);
    if (lead) cut[0] = `${cut[0]} ${lead[1]}`;
    // "7.-17.11.2026" and "7/-17/11/2026": the first half is only a day, the month comes from the right half.
    const numLead = cut.length === 2 && /^\d{1,2}$/.test(cut[0]) && cut[1].match(/^\d{1,2}([./])(\d{1,2})(.*)$/);
    if (numLead) cut[0] = `${cut[0]}${numLead[1]}${numLead[2]}${numLead[3]}`;
    // "Nov 7 - 17, 2026" and "November 7-17": the right half is only a day (and maybe the year), the month comes from the left.
    const dayOnly = cut.length === 2 && /^[a-z]+\.?\s*\d{1,2}$/.test(cut[0]) && cut[1].match(/^(\d{1,2})(?:[\s,]+(\d{4}))?$/);
    if (dayOnly) cut[1] = `${cut[0].replace(/\d{1,2}$/, dayOnly[1])}${dayOnly[2] ? ` ${dayOnly[2]}` : ''}`;
    // "mid - late nov 2026", "early to mid 2024": the left half is only a word like mid, the month and year come from the right half.
    if (cut.length === 2 && /^(?:early|mid|late)$/.test(cut[0])) {
      const tail = cut[1].replace(/^(?:early|mid|late)[-\s]*/, '');
      if (tail) cut[0] = `${cut[0]} ${tail}`;
    }
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
        left = parseSingle(withYear(cut[0], DUMMY_YEAR));
        right = parseSingle(withYear(cut[1], DUMMY_YEAR));
        if (!left.error && !right.error && left.from > right.to) right = parseSingle(withYear(cut[1], DUMMY_YEAR + 1));
        yearless = true;
      } else if (bare(left) && right.y) {
        // "20 oct - 17 nov 2026": the year belongs to both. "dec - feb 2025": the first half is in the year before.
        left = parseSingle(withYear(cut[0], right.y));
        if (!left.error && left.m > right.m) left = parseSingle(withYear(cut[0], right.y - 1));
      }
      else if (bare(right) && left.y) {
        // "20 oct 2026 - 17 nov"; "28 dec 2025 - 2 jan" ends in the next year.
        right = parseSingle(withYear(cut[1], left.y));
        if (!right.error && left.from && right.from < left.from) right = parseSingle(withYear(cut[1], left.y + 1));
      }
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
    // Only when it still reads as what was saved (an older reading of the same text, such as a two-digit year, is not trusted).
    if (!parsed.error && parsed.date && sameDate(parsed.date, d)) return parsed.date.text;
  } else if (d.yearly && !d.endMonth && !d.src) return dayMonth(d.day, d.month);
  return d.text || '';
}

function sameDate(a, b) {
  if (a.from || b.from) return a.from === b.from && a.to === b.to;
  return a.month === b.month && a.day === b.day && (a.endMonth || 0) === (b.endMonth || 0) && (a.endDay || 0) === (b.endDay || 0);
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
