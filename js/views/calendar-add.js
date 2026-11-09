// "Add to calendar" for an event: a button on the event page, and a tick box on a new event.
// The choices are in a small pop-up: the calendar app on the phone, Google Calendar, or a downloaded file.

import { strings } from '../strings.js';
import { calendarInfo, calendarTexts, buildIcs, googleUrl, sendFile } from '../calendar.js';
import { resolveTimes, formatTime } from '../times.js';
import { openModal } from './modal.js';
import { t } from '../strings.js';

function make(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

// values: { title, details, date, repeat }. Returns when the pop-up is closed.
export function openCalendarChooser({ id, values, fallback }) {
  const info = calendarInfo(values.date, values.repeat);
  if (!info) return Promise.resolve();
  const texts = calendarTexts({ title: values.title, details: values.details, fallback });
  return new Promise((resolve) => {
    // iPhone Safari cancels a file download that has only just started if the page changes at the same moment
    // (which happens when this pop-up was opened by saving a new event), so the caller waits a moment after a download.
    let slow = false;
    const done = () => (slow ? setTimeout(resolve, 1500) : resolve());
    const panel = make('div', 'modal-panel calendar-choices');
    // Optional time of day (only for a single day)
    let timeBox = null;
    let readTimes = () => ({ none: true });
    if (info.start === info.end) {
      const head = make('div', 'time-head');
      head.append(make('span', 'time-title', strings['cal.timeLabel']));
      const infoButton = make('button', 'time-info', 'i');
      infoButton.type = 'button';
      infoButton.setAttribute('aria-label', strings['cal.timeInfoLabel']);
      infoButton.setAttribute('aria-expanded', 'false');
      const help = make('div', 'time-help');
      help.hidden = true;
      for (const line of strings['cal.timeHelp'].split('\n')) help.append(make('p', '', line));
      infoButton.addEventListener('click', () => {
        help.hidden = !help.hidden;
        infoButton.setAttribute('aria-expanded', String(!help.hidden));
      });
      head.append(infoButton);
      const row = make('div', 'time-row');
      const makeInput = (placeholder, label) => {
        const field = make('label', 'time-field');
        field.append(make('span', 'time-label', label));
        const input = make('input');
        input.type = 'text';
        input.inputMode = 'text';
        input.autocomplete = 'off';
        input.autocapitalize = 'off';
        input.spellcheck = false;
        input.placeholder = placeholder;
        field.append(input);
        row.append(field);
        return input;
      };
      const startInput = makeInput(strings['cal.startPlaceholder'], strings['cal.start']);
      const endInput = makeInput(strings['cal.endPlaceholder'], strings['cal.end']);
      const reading = make('p', 'time-reading');
      reading.setAttribute('aria-live', 'polite');
      const show = (final) => {
        const r = resolveTimes(startInput.value, endInput.value);
        startInput.classList.toggle('is-invalid', r.error === 'start' && final);
        endInput.classList.toggle('is-invalid', r.error === 'end' && final);
        reading.classList.toggle('is-error', Boolean(r.error));
        if (r.none) reading.textContent = strings['cal.timeAllDay'];
        else if (r.error === 'start') reading.textContent = final ? strings['cal.timeErrStart'] : '';
        else if (r.error === 'end') reading.textContent = final ? strings['cal.timeErrEnd'] : '';
        else if (r.error === 'needStart') reading.textContent = strings['cal.timeNeedStart'];
        else {
          const range = `${formatTime(r.start)}–${formatTime(r.end)}${r.endNextDay ? ` ${strings['cal.nextDay']}` : ''}`;
          reading.textContent = r.defaultedEnd ? t('cal.timeReadingDefault', { range }) : range;
        }
        return r;
      };
      for (const input of [startInput, endInput]) {
        input.addEventListener('input', () => show(false));
        input.addEventListener('blur', () => show(true));
      }
      show(false);
      readTimes = () => show(true);
      timeBox = make('div', 'time-box');
      timeBox.append(head, help, row, reading);
      panel.append(timeBox);
    }
    const choices = [
      ['cal.app', 'btn btn-primary', (times) => {
        slow = true; // see below
        sendFile(buildIcs({ id, info, times, ...texts }), texts.summary);
      }],
      ['cal.google', 'btn btn-secondary', (times) => window.open(googleUrl({ info, times, ...texts }), '_blank', 'noopener')],
    ];
    let dialog;
    for (const [key, className, action] of choices) {
      const button = make('button', `${className} btn-small`, strings[key]);
      button.type = 'button';
      button.addEventListener('click', async () => {
        const times = readTimes();
        if (times.error) return; // the message under the time fields says what to fix
        await action(times);
        dialog.close();
      });
      panel.append(button);
    }
    const cancel = make('button', 'link', strings['cal.cancel']);
    cancel.type = 'button';
    cancel.addEventListener('click', () => dialog.close());
    panel.append(cancel);
    dialog = openModal(panel, done);
  });
}

// The button on an existing event. getValues() gives the current { title, details, date, repeat }.
export function calendarButton({ getId, getValues, getFallback }) {
  const wrap = make('div', 'calendar-add');
  const button = make('button', 'btn btn-secondary btn-small', strings['cal.add']);
  button.type = 'button';
  const hint = make('p', 'hint', strings['cal.needDay']);
  button.addEventListener('click', () => openCalendarChooser({ id: getId(), values: getValues(), fallback: getFallback() }));
  wrap.append(button, hint);
  const refresh = () => {
    const ok = Boolean(calendarInfo(getValues().date, getValues().repeat));
    button.disabled = !ok;
    hint.hidden = ok;
  };
  refresh();
  return { element: wrap, refresh };
}

// The tick box on a new event.
export function calendarTick({ getValues }) {
  const label = make('label', 'check calendar-tick');
  const box = make('input');
  box.type = 'checkbox';
  label.append(box, make('span', '', strings['cal.tick']));
  const hint = make('p', 'hint', strings['cal.needDay']);
  const wrap = make('div', 'calendar-add');
  wrap.append(label, hint);
  const refresh = () => {
    const ok = Boolean(calendarInfo(getValues().date, getValues().repeat));
    box.disabled = !ok;
    if (!ok) box.checked = false;
    hint.hidden = ok;
  };
  refresh();
  return { element: wrap, refresh, checked: () => box.checked };
}
