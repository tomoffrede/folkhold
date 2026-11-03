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
  1: ['janv', 'ene', 'janner'],
  2: ['fevr', 'febr', 'feber'],
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
  spring: 'Spring', primavera: 'Spring', printemps: 'Spring', fruhling: 'Spring', fruehling: 'Spring', fruhjahr: 'Spring',
  summer: 'Summer', verao: 'Summer', sommer: 'Summer', ete: 'Summer', verano: 'Summer',
  autumn: 'Autumn', fall: 'Autumn', outono: 'Autumn', herbst: 'Autumn', automne: 'Autumn', otono: 'Autumn',
  winter: 'Winter', inverno: 'Winter', hiver: 'Winter', invierno: 'Winter',
};

// Weekdays (folded), for reading "Tuesday 5 March" and "last friday": 0 = Sunday ... 6 = Saturday.
export const WEEKDAYS = {
  sunday: 0, sun: 0, sonntag: 0, dimanche: 0, dim: 0, domingo: 0, dom: 0,
  monday: 1, mon: 1, montag: 1, lundi: 1, lun: 1, lunes: 1, segunda: 1, seg: 1,
  tuesday: 2, tue: 2, tues: 2, dienstag: 2, mardi: 2, martes: 2, terca: 2, ter: 2,
  wednesday: 3, wed: 3, mittwoch: 3, mercredi: 3, mer: 3, miercoles: 3, mie: 3, quarta: 3, qua: 3,
  thursday: 4, thu: 4, thur: 4, thurs: 4, donnerstag: 4, jeudi: 4, jeu: 4, jueves: 4, jue: 4, quinta: 4, qui: 4,
  friday: 5, fri: 5, freitag: 5, vendredi: 5, ven: 5, viernes: 5, vie: 5, sexta: 5, sex: 5,
  saturday: 6, sat: 6, samstag: 6, sonnabend: 6, samedi: 6, sam: 6, sabado: 6, sab: 6,
};

// Number words, for "two weeks ago" (folded).
export const NUMBER_WORDS = {
  a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12,
  ein: 1, eine: 1, einer: 1, einem: 1, einen: 1, zwei: 2, drei: 3, vier: 4, funf: 5, sechs: 6, sieben: 7, acht: 8, neun: 9, zehn: 10, elf: 11, zwolf: 12,
  un: 1, une: 1, deux: 2, trois: 3, quatre: 4, cinq: 5, sept: 7, huit: 8, neuf: 9, dix: 10, onze: 11, douze: 12,
  una: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8, nueve: 9, diez: 10, once: 11, doce: 12,
  um: 1, uma: 1, dois: 2, duas: 2, quatro: 4, sete: 7, oito: 8, nove: 9, dez: 10, doze: 12,
};

// Units of time (folded): day, week, month, year, weekend.
export const UNITS = {
  day: 'day', days: 'day', tag: 'day', tage: 'day', tagen: 'day', jour: 'day', jours: 'day', dia: 'day', dias: 'day',
  week: 'week', weeks: 'week', woche: 'week', wochen: 'week', semaine: 'week', semaines: 'week', semana: 'week', semanas: 'week',
  month: 'month', months: 'month', monat: 'month', monate: 'month', monaten: 'month', mois: 'month', mes: 'month', meses: 'month',
  year: 'year', years: 'year', jahr: 'year', jahre: 'year', jahren: 'year', an: 'year', ans: 'year', annee: 'year', annees: 'year', ano: 'year', anos: 'year',
  weekend: 'weekend', wochenende: 'weekend', 'week-end': 'weekend', weekends: 'weekend',
};

// "last", "this" and "next" in every language (folded): -1, 0, 1.
export const MODIFIERS = {
  last: -1, previous: -1, past: -1, letzte: -1, letzten: -1, letzter: -1, letztes: -1, letztem: -1, vergangene: -1, vergangenen: -1, vergangener: -1, vergangenes: -1, vorige: -1, vorigen: -1,
  dernier: -1, derniere: -1, passe: -1, passee: -1, pasado: -1, pasada: -1, passado: -1, passada: -1, anterior: -1,
  this: 0, diese: 0, diesen: 0, dieser: 0, dieses: 0, diesem: 0, ce: 0, cet: 0, cette: 0, este: 0, esta: 0, esse: 0, essa: 0,
  next: 1, coming: 1, upcoming: 1, nachste: 1, nachsten: 1, nachster: 1, nachstes: 1, nachstem: 1, kommende: 1, kommenden: 1, kommender: 1, kommendes: 1,
  prochain: 1, prochaine: 1, proximo: 1, proxima: 1, seguinte: 1,
};

// Words for the beginning, middle and end of a month or year, and for today, yesterday and tomorrow (folded).
const PART_WORDS = {
  early: ['beginning', 'start', 'inicio', 'comeco', 'principio', 'principios', 'inicios', 'comienzos', 'anfang', 'debut'],
  mid: ['middle', 'meio', 'meados', 'metade', 'mitte', 'milieu', 'mediados', 'mitad'],
  late: ['end', 'fim', 'final', 'finais', 'ende', 'fin', 'finales', 'fines', 'fins'],
};
const RELATIVE = {
  today: 0, hoje: 0, heute: 0, "aujourd'hui": 0, hoy: 0,
  now: 0, present: 0, ongoing: 0, jetzt: 0, maintenant: 0, agora: 0, ahora: 0, atualmente: 0, actualmente: 0, aktuell: 0,
  yesterday: -1, ontem: -1, gestern: -1, hier: -1, ayer: -1,
  tomorrow: 1, amanha: 1, morgen: 1, demain: 1, manana: 1,
  'day before yesterday': -2, vorgestern: -2, 'avant-hier': -2, 'avant hier': -2, anteayer: -2, 'antes de ayer': -2, anteontem: -2, 'antes de ontem': -2,
  'day after tomorrow': 2, ubermorgen: 2, 'apres-demain': 2, 'apres demain': 2, 'pasado manana': 2, 'depois de amanha': 2,
};

export const relativeDay = (word) => RELATIVE[word];
export const APPROX = "(?:~|≈|c\\.|ca\\.|circa\\b|zirka\\b|around\\b|about\\b|roughly\\b|approximately\\b|approx\\.?|somewhere (?:around|in|about)\\b|sometime (?:around|in|about)\\b|aproximadamente\\b|aprox\\.?|cerca de\\b|perto de\\b|mais ou menos\\b|mas o menos\\b|por ahi de\\b|a eso de\\b|sobre\\b|ungefahr\\b|etwa\\b|gegen\\b|rund um\\b|so um\\b|irgendwann (?:in|um|so um)\\b|irgendwann\\b|um(?=\\s*\\d)|environ\\b|env\\.?|vers\\b|a peu pres\\b|autour de\\b|aux alentours de\\b|quelque part en\\b|hacia\\b|alrededor de\\b|en torno a\\b|em torno de\\b|por volta de\\b|la por\\b|uns(?=\\s*\\d))";
export const APPROX_END = /\s+(?:or so|oder so|ou so|ou a peu pres|o algo asi|mais ou menos|mas o menos|ungefahr|more or less)$/;
export const TO_WORDS = "(?:to|until|till|til|through|thru|a|ate|ao|bis|au|hasta|al|jusqu'au|jusqu'a|jusqu'en|jusque)";

// Small words that carry no meaning in a date, in every language: "5th of March", "5 de março de 2024", "le 5 mars", "am 5. März".
const SMALL_WORDS = new RegExp(
  `\\b(?:${[
    'of', 'de', 'del', 'von', 'em', 'en', 'do', 'da', 'dos', 'das', 'du', 'des', 'der', 'den', 'dem', 'die', 'the', 'el', 'la', 'lo', 'le', 'les', 'los', 'las', 'o', 'os',
    'am', 'im', 'on', 'at', 'in', 'zum', 'zur', 'no', 'na', 'nos', 'nas', 'dia', 'dias', 'day', 'days', 'jour', 'tag', 'mes', 'mois', 'month', 'monat', 'year', 'jahr', 'jahre', 'jahren', 'ano', 'annee', 'anno',
    'since', 'seit', 'depuis', 'desde', 'from', 'courant', 'whole', 'all', 'vom',
  ].join('|')})\\b`,
  'g',
);

// Turns the words of any language for early/mid/late into "early", "mid", "late", and drops small linking words.
export function normalizeWords(text) {
  let s = text
    .replace(/[ᵉʳᵈˢᵗʰ]/g, '') // superscript endings: 1ᵉʳ
    .replace(/\b(\d{1,2})(st|nd|rd|th|e|eme|ten|te|ter|tem|tes|o|a)\b/g, (all, n) => (+n <= 31 ? n : all))
    .replace(/\b1(er|ere)\b/g, '1')
    .replace(/(\d)[º°ª]/g, '$1')
    .replace(/\bfruh(?=(sommer|herbst|winter))/g, 'early ')
    .replace(/\bspat(?=(sommer|herbst|winter|fruhling|fruhjahr))/g, 'late ')
    .replace(/\bhochsommer\b/g, 'mid sommer')
    .replace(/\b[dl]'/g, ' ');
  Object.entries(PART_WORDS).forEach(([canonical, words]) => {
    s = s.replace(new RegExp(`\\b(?:${words.join('|')})\\b`, 'g'), canonical);
  });
  return s.replace(/\bmi-/g, 'mid ').replace(SMALL_WORDS, ' ');
}

export const monthName = (m, long) => (long ? LONG : SHORT)[getLang()][m - 1];
export const shortMonthNames = () => SHORT[getLang()];
export const longMonthNames = () => LONG[getLang()];

// Day-and-month order of numbers like 5/3/2024: day first (default) or month first (US). Settings sets where to look.
let orderProvider = () => 'dmy';
export const setOrderProvider = (fn) => {
  orderProvider = fn;
};
export const usOrder = () => orderProvider() === 'mdy';
