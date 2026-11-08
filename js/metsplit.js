// "How we met": one free text that may hold a date and a description, like "Max's wedding, late 2021" or "2019 climbing gym".
// The date is found inside the text (the longest stretch of words that reads as a date with a year); the rest is the description.
// splitMet(text) gives { date, reading, rest, needYear }:
//   date: the date in the format of dates.js, or null     reading: how the date was read (for the green line)
//   rest: the text without the date                       needYear: a day and month was found but no year, so no date could be kept

import { parseDate } from './dates.js';

const MAX_WORDS = 8; // the longest date looked for, in words ("from late summer 2019 to early spring 2021")

// Little words left next to where the date was cut out ("wedding in [2021]", "[2021] at Max's wedding").
const LEAD = /^(?:at|on|in|for|during|from|since|um|bei|im|en|au|lors|em|no|na|por|durante|depuis|seit|desde)\s+/i;
const TRAIL = /(?:^|\s+)(?:at|on|in|for|during|from|since|until|till|to|through|around|circa|about|um|bei|im|en|au|em|no|na|por|desde|depuis|seit|bis)$/i;
const EDGE = /^[\s,;:.\-–—(\[]+|[\s,;:\-–—(\[]+$/g;

function tidy(text) {
  return text.replace(/\s+/g, ' ').replace(EDGE, '').trim();
}

export function splitMet(text) {
  const full = String(text || '').trim();
  if (!full) return { date: null, reading: '', rest: '', needYear: false };
  const words = [...full.matchAll(/\S+/g)].map((m) => ({ start: m.index, end: m.index + m[0].length }));
  let needYear = false;
  for (let length = Math.min(words.length, MAX_WORDS); length >= 1; length--) {
    for (let from = words.length - length; from >= 0; from--) {
      const start = words[from].start;
      const end = words[from + length - 1].end;
      const candidate = full.slice(start, end).replace(/^[\s,;:(\[]+|[\s,;:.!)\]]+$/g, '');
      if (!candidate) continue;
      const result = parseDate(candidate);
      if (result.error) continue;
      if (result.yearly) {
        if (/\d/.test(candidate)) needYear = true;
        continue;
      }
      if (!result.date || !result.date.from) continue;
      return { date: result.date, reading: result.reading, rest: tidy(`${tidy(full.slice(0, start)).replace(TRAIL, '')} ${tidy(full.slice(end)).replace(LEAD, '')}`), needYear: false };
    }
  }
  return { date: null, reading: '', rest: tidy(full), needYear };
}
