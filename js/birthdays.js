// Recognising a birthday that was entered as an event ("Anna's birthday", "Geburtstag", "niver", "誕生日" ...)
// so it can be saved in the contact's details instead. Only an event whose title says nothing but "birthday"
// (plus the person's name and small filler words), with one exact day, no details, and one contact, is moved.

import * as store from './store.js';
import { modernize } from './dates.js';

// Words and phrases for "birthday" (and "date of birth"), including everyday short forms and spellings without accents.
// They are compared after accents and capitals are removed, so "Aniversário" and "aniversario" are the same.
const PHRASES = [
  // English
  'birthday', 'bday', 'b-day', 'b day', "b'day", 'birth day', 'hbd', 'birthdate', 'birth date', 'date of birth', 'dob',
  // German
  'geburtstag', 'geburtstage', 'geburtstags', 'geburtsdatum', 'burzeltag', 'wiegenfest',
  // Portuguese
  'aniversário', 'niver', 'aniv', 'data de nascimento', 'nascimento', 'natalício', 'dia do aniversário',
  // French
  'anniversaire', 'anniv', 'date de naissance', 'naissance',
  // Spanish
  'cumpleaños', 'cumple', 'fecha de nacimiento', 'nacimiento', 'natalicio',
  // Italian
  'compleanno', 'compleanni', 'data di nascita', 'nascita', 'genetliaco',
  // Dutch
  'verjaardag', 'verjaardagen', 'jarig', 'geboortedatum',
  // Swedish, Danish, Norwegian
  'födelsedag', 'födelsedagen', 'födelsedatum', 'fodis', 'fødselsdag', 'fødselsdagen', 'fødselsdato', 'bursdag', 'bursdagen',
  // Finnish
  'syntymäpäivä', 'synttärit', 'synttäri',
  // Polish, Czech, Slovak, Hungarian, Romanian
  'urodziny', 'urodzinki', 'data urodzenia', 'narozeniny', 'narodeniny', 'datum narození', 'születésnap', 'szülinap', 'zi de naștere', 'ziua de naștere', 'data nașterii',
  // Turkish
  'doğum günü', 'doğum tarihi', 'dogumgunu',
  // Russian, Ukrainian
  'день рождения', 'дня рождения', 'днем рождения', 'дню рождения', 'день рожденья', 'днюха', 'др', 'дата рождения', 'den rozhdeniya', 'день народження', 'дня народження', 'днем народження', 'дата народження',
  // Greek, Hebrew, Arabic, Persian
  'γενέθλια', 'יום הולדת', 'عيد ميلاد', 'عيد الميلاد', 'تاريخ الميلاد', 'روز تولد',
  // Hindi, Indonesian, Vietnamese, Tagalog, Swahili, Thai
  'जन्मदिन', 'जन्मदिवस', 'janmadin', 'janamdin', 'ulang tahun', 'ultah', 'hari lahir', 'sinh nhật', 'sinhnhat', 'kaarawan', 'siku ya kuzaliwa', 'วันเกิด',
  // Japanese, Chinese, Korean
  '誕生日', 'お誕生日', 'たんじょうび', 'バースデー', 'バースデイ', '生日', '生日快乐', '出生日期', '생일', '생신',
];

// Small words that may stand next to the birthday word: "Happy birthday", "Mein Geburtstag", "Anna's 30th".
const FILLERS = new Set(
  ('happy belated my your his her the of s turns turning th st nd rd er e eme o a ten te ' +
    'de da do dos das du des di del el la le les d l mi mon ma mein meine meiner mijn min mitt to for para pour per voor zum zu fur ' +
    'feliz joyeux bon buon alles gute grattis gefeliciteerd dia dag с').split(' '),
);

function fold(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/ß/g, 'ss')
    .replace(/ø/g, 'o')
    .replace(/æ/g, 'ae')
    .replace(/œ/g, 'oe')
    .replace(/ł/g, 'l')
    .replace(/đ/g, 'd')
    .replace(/ı/g, 'i')
    .replace(/[’`´]/g, "'")
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
}

const CJK = /[぀-ヿ㐀-鿿가-힯]/;
const escape = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const alternatives = [...new Set(PHRASES.map(fold))]
  .sort((a, b) => b.length - a.length)
  .map((phrase) => (CJK.test(phrase) ? escape(phrase) : `(?<![\\p{L}\\p{N}])${escape(phrase)}(?![\\p{L}\\p{N}])`));
const FINDER = new RegExp(alternatives.join('|'), 'gu');

const tokens = (text) => text.split(/[^\p{L}\p{N}]+/u).filter(Boolean);

// The birthday an event title and date stand for, or null. event: { title, details, date, kind }; contact: the one contact.
export function detect(event, contact) {
  if (!event.title || event.details) return null;
  const date = modernize(event.date);
  let birthday = null;
  if (date && date.yearly && !date.endMonth) birthday = { day: date.day, month: date.month };
  else if (date && date.from && date.from === date.to) birthday = { day: +date.from.slice(8, 10), month: +date.from.slice(5, 7), year: +date.from.slice(0, 4) };
  if (!birthday) return null;

  const title = fold(event.title);
  if (!FINDER.test(title)) return null;
  FINDER.lastIndex = 0;
  const names = new Set(['firstName', 'lastName', 'nickname'].flatMap((key) => tokens(fold(contact[key]))));
  const left = tokens(title.replace(FINDER, ' '));
  const mentionsName = left.some((word) => names.has(word));
  const extra = left.filter((word) => !names.has(word) && !FILLERS.has(word) && !/^\d+$/.test(word));
  if (extra.length) return null; // "Birthday dinner", "Anniversaire de mariage": a different event
  if (event.kind === 'together' && !mentionsName) return null; // "Birthday" shared by two people is more likely the party
  return birthday;
}

const same = (a, b) => Boolean(a) && a.day === b.day && a.month === b.month && (a.year || 0) === (b.year || 0);

// Saves the birthday in the contact's details. Returns 'saved', 'updated' (it replaced a different one) or 'same'.
export async function save(contact, birthday) {
  if (same(contact.birthday, birthday)) return 'same';
  const { id, ...fields } = contact;
  await store.update('contact', id, { ...fields, birthday });
  return contact.birthday ? 'updated' : 'saved';
}
