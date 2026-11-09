// Reading a time of day typed freely, in English, German, French, Spanish and Portuguese:
// 1130, 11:30, 11.30, 11 30, 11h30, 11 Uhr 30, 11 heures 30, las 11 y media, half past 11, halb zwölf, quarter to 12, 11pm, noon ...
// The 24-hour clock is the default: "11" is 11:00. "pm" (or "evening", "abends", "de la tarde" ...) moves it to the afternoon.

import { fold } from './datewords.js';

// Number words: hours 0-24 and the usual minutes. Accents are already folded away.
const NUMBER_WORDS = {};
function addWords(list, extras = {}) {
  list.forEach((word, value) => {
    if (word) for (const w of word.split('|')) NUMBER_WORDS[w] = value;
  });
  Object.assign(NUMBER_WORDS, extras);
}
addWords(
  ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen', 'twenty', 'twenty one', 'twenty two', 'twenty three', 'twenty four'],
  { 'twenty five': 25, thirty: 30, 'thirty five': 35, forty: 40, 'forty five': 45, fifty: 50, 'fifty five': 55 },
);
addWords(
  ['null', 'eins|ein|eine', 'zwei', 'drei', 'vier', 'funf|fuenf', 'sechs', 'sieben', 'acht', 'neun', 'zehn', 'elf', 'zwolf|zwoelf', 'dreizehn', 'vierzehn', 'funfzehn|fuenfzehn', 'sechzehn', 'siebzehn', 'achtzehn', 'neunzehn', 'zwanzig', 'einundzwanzig', 'zweiundzwanzig', 'dreiundzwanzig', 'vierundzwanzig'],
  { funfundzwanzig: 25, fuenfundzwanzig: 25, dreissig: 30, funfunddreissig: 35, vierzig: 40, funfundvierzig: 45, fuenfundvierzig: 45, funfzig: 50, fuenfzig: 50, funfundfunfzig: 55 },
);
addWords(
  ['zero', 'un|une', 'deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit', 'neuf', 'dix', 'onze', 'douze', 'treize', 'quatorze', 'quinze', 'seize', 'dix sept', 'dix huit', 'dix neuf', 'vingt', 'vingt et un', 'vingt deux', 'vingt trois', 'vingt quatre'],
  { 'vingt cinq': 25, trente: 30, 'trente cinq': 35, quarante: 40, 'quarante cinq': 45, cinquante: 50, 'cinquante cinq': 55 },
);
addWords(
  ['cero', 'una|uno', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho', 'nueve', 'diez', 'once', 'doce', 'trece', 'catorce', 'quince', 'dieciseis', 'diecisiete', 'dieciocho', 'diecinueve', 'veinte', 'veintiuno|veintiuna', 'veintidos', 'veintitres', 'veinticuatro'],
  { veinticinco: 25, treinta: 30, 'treinta y cinco': 35, cuarenta: 40, 'cuarenta y cinco': 45, cincuenta: 50, 'cincuenta y cinco': 55 },
);
addWords(
  ['zero', 'uma', 'dois|duas', 'tres', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove', 'dez', 'onze', 'doze', 'treze', 'catorze|quatorze', 'quinze', 'dezesseis|dezasseis', 'dezessete|dezassete', 'dezoito', 'dezenove', 'vinte', 'vinte e um|vinte e uma', 'vinte e dois', 'vinte e tres', 'vinte e quatro'],
  { 'vinte e cinco': 25, trinta: 30, 'trinta e cinco': 35, quarenta: 40, 'quarenta e cinco': 45, cinquenta: 50, 'cinquenta e cinco': 55 },
);
const NUMBER_RE = new RegExp(`\\b(?:${Object.keys(NUMBER_WORDS).sort((a, b) => b.length - a.length).join('|')})\\b`, 'g');

const NOON = /\b(?:noon|midday|mittags?|midi|mediodia|medio dia|meio dia|meiodia)\b/g;
const MIDNIGHT = /\b(?:midnight|mitternacht|minuit|medianoche|media noche|meia noite|meianoite)\b/g;
const PM_WORDS = /\b(?:afternoon|evening|nachmittags?|nachm|abends?|soir|apres midi|de la tarde|da tarde)\b/g;
const NIGHT_WORDS = /\b(?:at night|night|nachts|de la noche|da noite|de la madrugada|da madrugada|madrugada|de nuit|de la nuit|nuit)\b/g;
const AM_WORDS = /\b(?:morning|morgens|vormittags?|matin|de la manana|da manha|du matin)\b/g;
const FILLER = /\b(?:at|um|ab|from|von|vers|about|around|circa|ca|gegen|desde|de la|de l|de|da|do|des|du|le|la|las|los|el|o|in the|in|im|am|of the|the|a|as|au|à)\b/g;

function toNumber(match) {
  return String(NUMBER_WORDS[match]);
}

// Turns what was typed into { h, m }, null when it is empty, or { error: true } when it cannot be read.
export function parseTime(text) {
  let s = fold(text).replace(/[–—]/g, '-').replace(/\s+/g, ' ').trim();
  if (!s) return null;
  s = s.replace(/-/g, ' ').replace(/'/g, ' ');
  // Afternoon / evening / night / morning words first ("apres midi" must not become noon)
  s = s.replace(/(\d)\s*([ap])\.?\s?m\b\.?/g, '$1 $2m ').replace(/\b([ap])\.\s?m\.?/g, ' $1m ');
  const pm = /\bpm\b/.test(s) || PM_WORDS.test(s);
  PM_WORDS.lastIndex = 0;
  const am = /\bam\b/.test(s); // "12 am" is midnight
  const morning = AM_WORDS.test(s); // "12 de la manana" is noon
  AM_WORDS.lastIndex = 0;
  s = s.replace(PM_WORDS, ' ').replace(AM_WORDS, ' ').replace(/\b(?:pm|am)\b/g, ' ');
  // Words that are the time itself ("media noche" before the night words are removed)
  s = s.replace(MIDNIGHT, ' 0 ').replace(NOON, ' 12 ');
  // "at night": 6-11 is the evening (11 de la noche = 23:00), 12 is midnight, 1-5 is the small hours (2 de la noche = 02:00)
  const night = NIGHT_WORDS.test(s);
  NIGHT_WORDS.lastIndex = 0;
  s = s.replace(NIGHT_WORDS, ' ');
  s = s.replace(NUMBER_RE, (word) => ` ${toNumber(word)} `);
  s = s.replace(/(\d)\s*o ?clock/g, '$1 ');
  s = s.replace(FILLER, ' ').replace(/\bl\b/g, ' ').replace(/\s+/g, ' ').trim();
  s = s.replace(/(\d)\s*(?:uhr|heures?|horas?|hrs?|hs|h|o ?clock|:)\s*(?=\d)/g, '$1:');
  s = s.replace(/(\d)\s*(?:uhr|heures?|horas?|hrs?|hs|h|o ?clock|oclock|:)(?=\s|$)/g, '$1');
  s = s.replace(/\s+/g, ' ').trim();

  let h = null;
  let m = 0;
  let match;
  const hour = (value, minutes, back = false) => {
    h = back ? (value + 23) % 24 : value;
    m = minutes;
  };
  if ((match = s.match(/^half (?:past )?(\d{1,2})$/))) hour(+match[1], 30); // "half past 11", British "half 11"
  else if ((match = s.match(/^halb (\d{1,2})$/))) hour(+match[1] === 1 ? 12 : +match[1] - 1, 30); // German "halb zwölf" = 11:30
  else if ((match = s.match(/^(viertel|dreiviertel) (\d{1,2})$/))) hour(+match[2] === 1 ? 12 : +match[2] - 1, match[1] === 'viertel' ? 15 : 45);
  else if ((match = s.match(/^(?:viertel|quarter) (?:nach|ueber|past|after) (\d{1,2})$/))) hour(+match[1], 15);
  else if ((match = s.match(/^(?:viertel|quarter) (?:vor|to|before|till|til|of) (\d{1,2})$/))) hour(+match[1], 45, true);
  else if ((match = s.match(/^(\d{1,2}) (?:minutes? )?(nach|ueber|past|after) (\d{1,2})$/))) hour(+match[3], +match[1]);
  else if ((match = s.match(/^(\d{1,2}) (?:minutes? )?(vor|to|before|till|til|of) (\d{1,2})$/))) hour(+match[3], 60 - +match[1], true);
  else if ((match = s.match(/^(\d{1,2}) (?:et|y|e) (demie?|media|meia|medio)$/))) hour(+match[1], 30);
  else if ((match = s.match(/^(\d{1,2}) (?:et|y|e) (?:le |el |o )?(?:quart|cuarto|quarto)$/))) hour(+match[1], 15);
  else if ((match = s.match(/^(\d{1,2}) (?:et|y|e) (\d{1,2})$/))) hour(+match[1], +match[2]);
  else if ((match = s.match(/^(\d{1,2}) (?:moins|menos) (?:le |el |o )?(?:quart|cuarto|quarto)$/))) hour(+match[1], 45, true);
  else if ((match = s.match(/^(\d{1,2}) (?:moins|menos) (\d{1,2})$/))) hour(+match[1], 60 - +match[2], true);
  else if ((match = s.match(/^(\d{1,2})$/))) hour(+match[1], 0);
  else if ((match = s.match(/^(\d{1,2})(\d{2})$/)) && s.length >= 3) hour(+match[1], +match[2]); // 930, 1130
  else if ((match = s.match(/^(\d{1,2})[:.,\s]+(\d{2})(?:[:.]\d{2})?$/))) hour(+match[1], +match[2]);
  else return { error: true };

  if (h === 24 && m === 0) h = 0;
  if (h < 0 || h > 23 || m < 0 || m > 59) return { error: true };
  if (pm && h < 12) h += 12;
  else if (night && !am && !morning) {
    if (h >= 6 && h <= 11) h += 12;
    else if (h === 12) h = 0;
  }
  else if (am && h === 12) h = 0;
  return { h, m };
}

const minutesOf = (time) => time.h * 60 + time.m;

export function formatTime(time) {
  return `${String(time.h).padStart(2, '0')}:${String(time.m).padStart(2, '0')}`;
}

// A range typed into the first field: "11-12:30", "11 to 12", "11 bis 12 Uhr", "de 11h a 12h".
function splitRange(text) {
  const parts = fold(text).split(/\s*[-–—]\s*|\s+(?:to|until|till|bis|au|al|a|ate|hasta|jusqu'?a)\s+/);
  return parts.length === 2 && parts[0].trim() && parts[1].trim() ? parts : null;
}

// The start and end the person typed. Gives
//   { none: true }                                  nothing typed: an all-day event
//   { start, end, endNextDay, defaultedEnd }        times (only a start: it lasts 1 hour)
//   { error: 'start' | 'end' | 'needStart' }        what could not be read
export function resolveTimes(startText, endText) {
  let first = String(startText || '').trim();
  let second = String(endText || '').trim();
  if (first && !second) {
    const range = splitRange(first);
    if (range) [first, second] = range;
  }
  if (!first && !second) return { none: true };
  if (!first) return { error: 'needStart' };
  const start = parseTime(first);
  if (!start || start.error) return { error: 'start' };
  if (!second) {
    const end = { h: (start.h + 1) % 24, m: start.m };
    return { start, end, endNextDay: start.h === 23, defaultedEnd: true };
  }
  const end = parseTime(second);
  if (!end || end.error) return { error: 'end' };
  // An end before the start is the next day ("22:00-01:00"); a bare "pm" on the end follows the start ("10 - 11pm" stays 22-23)
  let fixed = end;
  // "10 - 11pm": the start has no am/pm of its own and would otherwise be in the morning
  let from = start;
  if (!/[ap]\.?m|abend|soir|tarde|noche|noite|evening|afternoon|nachm/i.test(first) && /p\.?m|abend|soir|tarde|noche|noite|evening|afternoon|nachm/i.test(second) && start.h < 12 && start.h * 60 + start.m <= (end.h - 12) * 60 + end.m) {
    from = { h: start.h + 12, m: start.m };
  }
  return { start: from, end: fixed, endNextDay: minutesOf(fixed) < minutesOf(from), defaultedEnd: false };
}
