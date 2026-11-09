// Sending an event to a calendar: a standard calendar file (.ics) that the phone's own calendar app takes
// (and so every account linked to it: Google, Infomaniak kSuite, iCloud...), or a ready-filled Google Calendar page.
// Only events with an exact day (or a short run of days) can be sent; vague dates ("mid March") cannot.

import { modernize, nextOccurrence } from './dates.js';

const MAX_DAYS = 31; // longer stretches are not calendar events

function pad(n) {
  return String(n).padStart(2, '0');
}

function isoOf(ts) {
  const d = new Date(ts);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function plusDay(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return isoOf(new Date(y, m - 1, d + 1).getTime());
}

// { start, end (the last day, included), yearly } for a date that can go into a calendar, otherwise null.
export function calendarInfo(date, repeat = false) {
  const d = modernize(date);
  if (!d) return null;
  if (d.yearly) {
    if (d.endMonth) return null; // "28 Dec–2 Jan" every year: not offered
    const next = nextOccurrence({ date: d });
    if (next === null) return null;
    const start = isoOf(next);
    return { start, end: start, yearly: true };
  }
  if (!d.from || !d.to) return null;
  const days = Math.round((Date.parse(d.to) - Date.parse(d.from)) / 86400000);
  if (days > 0 && !(/^\d/.test(d.text || '') && days < MAX_DAYS)) return null; // only ranges typed as days ("20-22 Nov")
  return { start: d.from, end: d.to, yearly: Boolean(repeat) };
}

// The calendar event's title and description from the event's title and details.
// No title: the first words of the details become the title; the full details are kept as the description unless they fit in the title.
export function calendarTexts({ title, details, fallback }) {
  const name = String(title || '').trim();
  const text = String(details || '').trim();
  if (name) return { summary: name, description: text };
  if (!text) return { summary: fallback, description: '' };
  const flat = text.replace(/\s+/g, ' ');
  let short = flat.split(' ').slice(0, 6).join(' ');
  if (short.length > 50) short = short.slice(0, 50).replace(/\s+\S*$/, '') || short.slice(0, 50);
  const cut = short.length < flat.length;
  return { summary: cut ? `${short}…` : short, description: cut ? text : '' };
}

function escapeText(text) {
  return text.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
}

// Lines of a calendar file are at most 75 bytes; longer ones continue on the next line after a space.
function fold(line) {
  const encoder = new TextEncoder();
  const out = [];
  let current = '';
  let bytes = 0;
  for (const char of line) {
    const size = encoder.encode(char).length;
    if (bytes + size > (out.length ? 74 : 75)) {
      out.push(current);
      current = '';
      bytes = 0;
    }
    current += char;
    bytes += size;
  }
  out.push(current);
  return out.join('\r\n ');
}

const compact = (iso) => iso.replace(/-/g, '');

// The start and end of the event as calendar values: whole days, or (with a time of day) local clock times.
// times: { start:{h,m}, end:{h,m}, endNextDay } from resolveTimes, only for a single-day event.
function when(info, times) {
  if (!times || !times.start || info.start !== info.end) {
    return { allDay: true, start: compact(info.start), end: compact(plusDay(info.end)) };
  }
  const clock = (t) => `${pad(t.h)}${pad(t.m)}00`;
  const endDay = times.endNextDay ? plusDay(info.start) : info.start;
  return { allDay: false, start: `${compact(info.start)}T${clock(times.start)}`, end: `${compact(endDay)}T${clock(times.end)}` };
}

export function buildIcs({ id, info, summary, description, times }) {
  const w = when(info, times);
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Folkhold//Events//EN',
    'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT',
    `UID:${id || crypto.randomUUID()}@folkhold`,
    `DTSTAMP:${stamp}`,
    w.allDay ? `DTSTART;VALUE=DATE:${w.start}` : `DTSTART:${w.start}`,
    w.allDay ? `DTEND;VALUE=DATE:${w.end}` : `DTEND:${w.end}`,
  ];
  if (info.yearly) lines.push('RRULE:FREQ=YEARLY');
  lines.push(`SUMMARY:${escapeText(summary)}`);
  if (description) lines.push(`DESCRIPTION:${escapeText(description)}`);
  lines.push('END:VEVENT', 'END:VCALENDAR');
  return `${lines.map(fold).join('\r\n')}\r\n`;
}

export function googleUrl({ info, summary, description, times }) {
  const w = when(info, times);
  const params = new URLSearchParams({ action: 'TEMPLATE', text: summary, dates: `${w.start}/${w.end}` });
  if (description) params.set('details', description);
  if (info.yearly) params.set('recur', 'RRULE:FREQ=YEARLY');
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

function fileName(summary) {
  const base = summary.replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-+|-+$/g, '').slice(0, 40);
  return `${base || 'event'}.ics`;
}

// Downloads the calendar file; on a phone, opening it from the downloads offers the calendars on the device.
export function sendFile(ics, summary) {
  const link = document.createElement('a');
  link.href = URL.createObjectURL(new Blob([ics], { type: 'text/calendar;charset=utf-8' }));
  link.download = fileName(summary);
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(link.href), 10000);
}
