// The words used to type and to show dates, in each language.
// Typing: words from ALL languages are understood at all times (so a date typed in German still works in a French app).
// Showing: month names come from the language in use.

import { getLang } from './lang.js';

export function fold(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[’‘]/g, "'")
    .replace(/ß/g, 'ss')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
}

const LONG = {
  en: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
  pt: ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'],
  de: ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'],
  fr: ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'],
  es: ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'],
};

const SHORT = {
  en: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
  pt: ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'],
  de: ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'],
  fr: ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'],
  es: ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'],
};

// Extra spellings of months (folded: no accents, no capitals).
const MONTH_EXTRA = {
  1: ['janv', 'ene'],
  2: ['fevr', 'febr'],
  3: ['maerz', 'mrz', 'mar'],
  4: ['avr', 'abr'],
  6: ['juin'],
  7: ['juil'],
  8: ['aout', 'ago'],
  9: ['sept', 'setiembre', 'set'],
  10: ['out', 'okt'],
  12: ['dez', 'dic'],
};

export const MONTH_LOOKUP = {};
Object.values(LONG).forEach((names) =>
  names.forEach((name, i) => {
    const folded = fold(name);
    MONTH_LOOKUP[folded] = i + 1;
    MONTH_LOOKUP[folded.slice(0, 3)] = i + 1;
  }),
);
Object.entries(MONTH_EXTRA).forEach(([month, words]) => words.forEach((word) => (MONTH_LOOKUP[word] = +month)));

export const SEASONS = {
  spring: 'Spring', primavera: 'Spring', printemps: 'Spring', fruhling: 'Spring', fruehling: 'Spring',
  summer: 'Summer', verao: 'Summer', sommer: 'Summer', ete: 'Summer', verano: 'Summer',
  autumn: 'Autumn', fall: 'Autumn', outono: 'Autumn', herbst: 'Autumn', automne: 'Autumn', otono: 'Autumn',
  winter: 'Winter', inverno: 'Winter', hiver: 'Winter', invierno: 'Winter',
};

// Words for the beginning, middle and end of a month or year, and for today, yesterday and tomorrow (folded).
const PART_WORDS = {
  early: ['beginning', 'start', 'inicio', 'comeco', 'principio', 'principios', 'inicios', 'comienzos', 'anfang', 'debut'],
  mid: ['middle', 'meio', 'meados', 'metade', 'mitte', 'milieu', 'mediados', 'mitad'],
  late: ['end', 'fim', 'final', 'finais', 'ende', 'fin', 'finales', 'fines'],
};
const RELATIVE = {
  today: 0, hoje: 0, heute: 0, "aujourd'hui": 0, hoy: 0,
  yesterday: -1, ontem: -1, gestern: -1, hier: -1, ayer: -1,
  tomorrow: 1, amanha: 1, morgen: 1, demain: 1, manana: 1,
};

export const relativeDay = (word) => RELATIVE[word];
export const APPROX = '(?:~|≈|c\\.|ca\\.|circa\\b|around\\b|about\\b|approx\\.?|approximately\\b|aprox\\.?|aproximadamente\\b|cerca de\\b|ungefahr\\b|etwa\\b|env\\.?|environ\\b|vers\\b|hacia\\b|alrededor de\\b|em torno de\\b|por volta de\\b)';
export const TO_WORDS = '(?:to|until|a|ate|bis|au|hasta|al)';

// Turns the words of any language for early/mid/late into "early", "mid", "late", and drops small linking words.
export function normalizeWords(text) {
  let s = text.replace(/\b(\d{1,2})(st|nd|rd|th|er|ere)\b/g, '$1').replace(/(\d)[º°]/g, '$1');
  Object.entries(PART_WORDS).forEach(([canonical, words]) => {
    s = s.replace(new RegExp(`\\b(?:${words.join('|')})\\b`, 'g'), canonical);
  });
  return s.replace(/\bmi-/g, 'mid ').replace(/\b(of|de|del|von|em|en)\b/g, ' ');
}

export const monthName = (m, long) => (long ? LONG : SHORT)[getLang()][m - 1];
export const shortMonthNames = () => SHORT[getLang()];
export const longMonthNames = () => LONG[getLang()];
