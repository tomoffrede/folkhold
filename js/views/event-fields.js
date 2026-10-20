// The fields of an event: title, date (as exact or as vague as you like), yearly repeat and details.
// Used by the event screen and by the new-contact form.
// createEventFields({ title, details, date, repeat, onChange }) returns { element, get(), set(values), focus() }.
// get() returns { title, details, date, repeat, problem }, where problem is null, 'incomplete' or 'invalid'.

import { strings } from '../strings.js';
import { PRECISIONS, needs, buildDate, monthNames } from '../dates.js';

function make(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

const PRECISION_LABELS = { day: 'event.pDay', monthDay: 'event.pMonthDay', month: 'event.pMonth', year: 'event.pYear' };

export function createEventFields({ title = '', details = '', date = null, repeat = false, onChange = () => {} } = {}) {
  const element = make('div', 'form');
  let precision = date ? date.precision : 'day';
  let repeating = Boolean(repeat);

  const titleLabel = make('label', 'field');
  const titleInput = make('input');
  titleInput.type = 'text';
  titleInput.autocomplete = 'off';
  titleInput.placeholder = strings['event.titlePlaceholder'];
  titleInput.setAttribute('aria-label', strings['event.titlePlaceholder']);
  titleInput.addEventListener('input', () => onChange());
  titleLabel.append(titleInput);

  // How exact the date is.
  const kindRow = make('div', 'prio-row kind-row');
  kindRow.append(make('span', 'prio-label', strings['event.dateKind']));
  const kindButtons = PRECISIONS.map((value) => {
    const button = make('button', 'chip prio-chip', strings[PRECISION_LABELS[value]]);
    button.type = 'button';
    button.addEventListener('click', () => {
      precision = value;
      refresh();
      onChange();
    });
    kindRow.append(button);
    return { value, button };
  });

  const day = make('input');
  day.type = 'number';
  day.min = '1';
  day.max = '31';
  day.inputMode = 'numeric';
  day.placeholder = strings['event.day'];
  day.setAttribute('aria-label', strings['event.day']);

  const month = make('select');
  month.setAttribute('aria-label', strings['event.month']);
  const none = make('option', '', strings['event.month']);
  none.value = '';
  month.append(none);
  monthNames().forEach((name, index) => {
    const option = make('option', '', name);
    option.value = String(index + 1);
    month.append(option);
  });

  const year = make('input');
  year.type = 'number';
  year.inputMode = 'numeric';
  year.placeholder = strings['event.year'];
  year.setAttribute('aria-label', strings['event.year']);

  const dateRow = make('div', 'birthday-row');
  dateRow.append(day, month, year);
  [day, month, year].forEach((field) => {
    field.addEventListener('input', () => onChange());
    field.addEventListener('change', () => onChange());
  });

  const repeatLabel = make('label', 'check');
  const repeatBox = make('input');
  repeatBox.type = 'checkbox';
  repeatBox.addEventListener('change', () => {
    repeating = repeatBox.checked;
    onChange();
  });
  repeatLabel.append(repeatBox, make('span', '', strings['event.repeat']));
  const repeatNote = make('p', 'hint', strings['event.repeatsAuto']);

  const detailsLabel = make('label', 'field');
  const detailsInput = make('textarea');
  detailsInput.rows = 3;
  detailsInput.placeholder = strings['event.detailsPlaceholder'];
  detailsInput.setAttribute('aria-label', strings['event.detailsPlaceholder']);
  detailsInput.addEventListener('input', () => onChange());
  detailsLabel.append(detailsInput);

  // Shows only the date boxes the chosen kind needs, and the repeat choice where it makes sense.
  function refresh() {
    kindButtons.forEach(({ value, button }) => button.setAttribute('aria-pressed', String(value === precision)));
    const used = needs(precision);
    day.hidden = !used.includes('day');
    month.hidden = !used.includes('month');
    year.hidden = !used.includes('year');
    repeatLabel.hidden = precision !== 'day';
    repeatNote.hidden = precision !== 'monthDay';
    repeatBox.checked = repeating;
  }

  function fill(values) {
    titleInput.value = values.title || '';
    detailsInput.value = values.details || '';
    const d = values.date || values.parts || null; // 'parts': a half-typed date kept in a draft
    precision = d ? d.precision : 'day';
    day.value = d && d.day ? d.day : '';
    month.value = d && d.month ? String(d.month) : '';
    year.value = d && d.year ? d.year : '';
    repeating = Boolean(values.repeat);
    refresh();
  }

  element.append(titleLabel, kindRow, dateRow, repeatLabel, repeatNote, detailsLabel);
  fill({ title, details, date, repeat });

  return {
    element,
    get() {
      const parts = { day: parseInt(day.value, 10) || null, month: parseInt(month.value, 10) || null, year: parseInt(year.value, 10) || null };
      const untouched = !day.value && !month.value && !year.value;
      const built = untouched ? { error: 'incomplete' } : buildDate(precision, parts);
      return {
        title: titleInput.value.trim(),
        details: detailsInput.value.trim(),
        date: built.date || null,
        repeat: precision === 'day' && repeating,
        parts: { precision, ...parts },
        problem: built.error || null,
        blank: untouched,
      };
    },
    set: fill,
    focus: () => titleInput.focus(),
  };
}
