// The fields of an event: title, who it is about ("their life" or "together"), a freely typed date, and details.
// Used by the event screen and by the new-contact form.
// createEventFields({ title, details, date, repeat, kind, onChange }) returns { element, get(), set(values), focus(), setName(name) }.
// get() returns { title, details, date, repeat, kind, problem, blank }: problem is null or a reason the date cannot be used.

import { strings, t } from '../strings.js';
import { parseDate, modernize } from '../dates.js';
import { personIcon } from './icons.js';

function make(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

// The name used in the two labels: a first name, else a nickname, else the whole name.
export function shortName(contact) {
  return contact.firstName || contact.nickname || contact.lastName || '';
}

function remembered(name, fallback) {
  try {
    return localStorage.getItem(name) || fallback;
  } catch {
    return fallback;
  }
}

function remember(name, value) {
  try {
    localStorage.setItem(name, value);
  } catch {
    // only a convenience
  }
}

// The examples box is open the first few times, then folds into a small "Examples" link.
function helpOpenNow() {
  const seen = Number(remembered('folkhold-datehelp', '0')) + 1;
  remember('folkhold-datehelp', String(seen));
  return seen <= 3;
}

export function createEventFields({ title = '', details = '', date = null, repeat = false, kind, onChange = () => {} } = {}) {
  const element = make('div', 'form');
  let who = kind === undefined ? remembered('folkhold-lastkind', 'life') : kind === 'together' ? 'together' : 'life';
  let repeating = Boolean(repeat);
  let name = '';

  const titleLabel = make('label', 'field');
  const titleInput = make('input');
  titleInput.type = 'text';
  titleInput.autocomplete = 'off';
  titleInput.placeholder = strings['event.titlePlaceholder'];
  titleInput.setAttribute('aria-label', strings['event.titlePlaceholder']);
  titleInput.addEventListener('input', () => onChange());
  titleLabel.append(titleInput);

  // Whose event it is: a switch of two choices.
  const whoRow = make('div', 'prio-row');
  const whoButtons = ['life', 'together'].map((value) => {
    const button = make('button', 'chip prio-chip');
    button.type = 'button';
    button.addEventListener('click', () => {
      who = value;
      if (kind === undefined) remember('folkhold-lastkind', value);
      refreshWho();
      onChange();
    });
    whoRow.append(button);
    return { value, button };
  });
  function refreshWho() {
    whoButtons.forEach(({ value, button }) => {
      button.replaceChildren(personIcon(value === 'together' ? 2 : 1), name ? t(`event.kind.${value}`, { name }) : strings[`event.kindNobody.${value}`]);
      button.setAttribute('aria-pressed', String(value === who));
    });
  }

  // The date: typed freely; the app shows how it understood it.
  const dateInput = make('input');
  dateInput.type = 'text';
  dateInput.autocomplete = 'off';
  dateInput.autocapitalize = 'none';
  dateInput.spellcheck = false;
  dateInput.placeholder = strings['event.datePlaceholder'];
  dateInput.setAttribute('aria-label', strings['event.dateLabel']);
  const reading = make('p', 'date-reading');
  reading.setAttribute('aria-live', 'polite');

  const help = make('div', 'date-help');
  const helpToggle = make('button', 'link', strings['event.examples']);
  helpToggle.type = 'button';
  const helpBody = make('div', 'date-help-body');
  helpBody.append(make('p', 'date-help-title', strings['event.helpTitle']));
  ['event.help1', 'event.help2', 'event.help3', 'event.help4'].forEach((key) => helpBody.append(make('p', 'date-help-line', strings[key])));
  helpBody.hidden = !helpOpenNow();
  helpToggle.hidden = !helpBody.hidden;
  helpToggle.addEventListener('click', () => {
    helpBody.hidden = false;
    helpToggle.hidden = true;
  });
  help.append(helpToggle, helpBody);

  const repeatLabel = make('label', 'check');
  const repeatBox = make('input');
  repeatBox.type = 'checkbox';
  repeatBox.addEventListener('change', () => {
    repeating = repeatBox.checked;
    onChange();
  });
  repeatLabel.append(repeatBox, make('span', '', strings['event.repeat']));

  function refreshDate() {
    const result = parseDate(dateInput.value);
    reading.textContent = result.error ? (result.error === 'empty' ? '' : strings['event.readingUnsure']) : `→ ${result.reading}`;
    reading.classList.toggle('is-unsure', Boolean(result.error));
    repeatLabel.hidden = !(result.repeatable && !result.error);
    repeatBox.checked = repeating && !repeatLabel.hidden;
  }
  dateInput.addEventListener('input', () => {
    refreshDate();
    onChange();
  });

  const detailsLabel = make('label', 'field');
  const detailsInput = make('textarea');
  detailsInput.rows = 3;
  detailsInput.placeholder = strings['event.detailsPlaceholder'];
  detailsInput.setAttribute('aria-label', strings['event.detailsPlaceholder']);
  detailsInput.addEventListener('input', () => onChange());
  detailsLabel.append(detailsInput);

  function fill(values) {
    titleInput.value = values.title || '';
    detailsInput.value = values.details || '';
    const d = modernize(values.date);
    dateInput.value = (d && (d.src || d.text)) || values.dateText || '';
    repeating = Boolean(values.repeat);
    if (values.kind) who = values.kind === 'together' ? 'together' : 'life';
    refreshWho();
    refreshDate();
  }

  element.append(titleLabel, whoRow, dateInput, reading, help, repeatLabel, detailsLabel);
  fill({ title, details, date, repeat });

  return {
    element,
    get() {
      const result = parseDate(dateInput.value);
      return {
        title: titleInput.value.trim(),
        details: detailsInput.value.trim(),
        date: result.error ? null : result.date,
        dateText: dateInput.value,
        repeat: Boolean(result.repeatable) && repeating,
        kind: who,
        problem: result.error || null,
        blank: !dateInput.value.trim(),
      };
    },
    set: fill,
    setName(value) {
      name = value || '';
      refreshWho();
    },
    focus: () => titleInput.focus(),
  };
}
