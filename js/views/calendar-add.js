// "Add to calendar" for an event: a button on the event page, and a tick box on a new event.
// The choices are in a small pop-up: the calendar app on the phone, Google Calendar, or a downloaded file.

import { strings } from '../strings.js';
import { calendarInfo, calendarTexts, buildIcs, googleUrl, sendFile } from '../calendar.js';
import { openModal } from './modal.js';
import { formatDate } from '../dates.js';

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
    const panel = make('div', 'modal-panel calendar-choices');
    panel.append(make('h3', 'prompt-title', strings['cal.title']), make('p', 'modal-text', `${texts.summary} · ${formatDate(values.date)}`));
    const choices = [
      ['cal.app', 'btn btn-primary', () => sendFile(buildIcs({ id, info, ...texts }), texts.summary)],
      ['cal.google', 'btn btn-secondary', () => window.open(googleUrl({ info, ...texts }), '_blank', 'noopener')],
      ['cal.file', 'btn btn-secondary', () => sendFile(buildIcs({ id, info, ...texts }), texts.summary, { download: true })],
    ];
    let dialog;
    for (const [key, className, action] of choices) {
      const button = make('button', `${className} btn-small`, strings[key]);
      button.type = 'button';
      button.addEventListener('click', async () => {
        await action();
        dialog.close();
      });
      panel.append(button);
    }
    const cancel = make('button', 'link', strings['cal.cancel']);
    cancel.type = 'button';
    cancel.addEventListener('click', () => dialog.close());
    panel.append(cancel);
    dialog = openModal(panel, resolve);
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
