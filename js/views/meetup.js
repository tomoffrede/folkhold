// "Met up": log that you met one or more people, in a few taps. It creates a "You & them" event on that day,
// which is what "Last met" is worked out from. Opened from Home and from a contact's page.

import { strings, t } from '../strings.js';
import * as store from '../store.js';
import * as events from '../events.js';
import { parseDate, span, startOfToday } from '../dates.js';
import { createPicker } from './contact-picker.js';
import { displayName } from './contacts.js';
import { openModal } from './modal.js';
import { showToast } from './toast.js';

function make(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

const iso = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

// A short text goes in as the title, a longer one as the description.
function splitText(text) {
  const clean = text.trim();
  if (!clean) return {};
  return clean.length <= 50 && !clean.includes('\n') ? { title: clean } : { details: clean };
}

export function openMeetup({ contactIds = [] } = {}) {
  let choice = 'today'; // 'today' | 'yesterday' | 'other'
  const panel = make('div', 'modal-panel meetup');
  panel.append(make('h3', 'prompt-title', strings['meetup.title']));

  const picker = createPicker({ selected: contactIds });
  panel.append(picker.element);

  const day = make('div', 'meetup-days');
  const chips = {};
  [['today', 'meetup.today'], ['yesterday', 'meetup.yesterday']].forEach(([key, label]) => {
    const chip = make('button', 'chip prio-chip', strings[label]);
    chip.type = 'button';
    chip.addEventListener('click', () => {
      choice = key;
      other.value = '';
      sync();
    });
    chips[key] = chip;
    day.append(chip);
  });
  const other = make('input', 'meetup-other');
  other.type = 'text';
  other.autocomplete = 'off';
  other.placeholder = strings['meetup.otherDate'];
  other.addEventListener('input', () => {
    choice = other.value.trim() ? 'other' : 'today';
    sync();
  });
  panel.append(day, other);

  const what = make('input', 'meetup-what');
  what.type = 'text';
  what.autocomplete = 'off';
  what.placeholder = strings['meetup.what'];
  panel.append(what);

  const message = make('p', 'meetup-message');
  message.setAttribute('aria-live', 'polite');
  const save = make('button', 'btn btn-primary btn-small', strings['meetup.save']);
  const cancel = make('button', 'link link-small', strings['cal.cancel']);
  save.type = 'button';
  cancel.type = 'button';
  const actions = make('div', 'modal-actions');
  actions.append(save);
  panel.append(message, actions, cancel);
  const dialog = openModal(panel);

  function sync() {
    Object.entries(chips).forEach(([key, chip]) => chip.setAttribute('aria-pressed', String(choice === key)));
    message.textContent = '';
  }
  sync();

  // The day as a date the app understands, or an error message.
  function readDay() {
    const today = startOfToday();
    let typed;
    if (choice === 'today') typed = iso(new Date(today));
    else if (choice === 'yesterday') typed = iso(new Date(today - 86400000));
    else typed = other.value;
    const result = parseDate(typed);
    if (result.error) return { problem: strings['meetup.badDate'] };
    if (result.yearly || result.date.yearly) {
      // No year typed ("3.11"): the most recent such day that is not in the future
      const { month, day } = result.date;
      if (!month || !day) return { problem: strings['meetup.badDate'] };
      const now = new Date(today);
      let year = now.getFullYear();
      if (new Date(year, month - 1, day).getTime() > today) year -= 1;
      const again = parseDate(iso(new Date(year, month - 1, day)));
      return again.error ? { problem: strings['meetup.badDate'] } : { date: again.date };
    }
    const range = span(result.date);
    if (!range || range.earliest > today) return { problem: strings['meetup.future'] };
    return { date: result.date };
  }

  cancel.addEventListener('click', () => dialog.close());
  save.addEventListener('click', async () => {
    const ids = picker.getSelected();
    if (!ids.length) {
      message.textContent = strings['meetup.needContact'];
      return;
    }
    const read = readDay();
    if (read.problem) {
      message.textContent = read.problem;
      return;
    }
    save.disabled = true;
    try {
      const eventId = await events.create({ ...splitText(what.value), date: read.date, kind: 'together', contactIds: ids });
      dialog.close();
      const names = ids.map((id) => displayName(store.get('contact', id) || {})).filter(Boolean).join(', ');
      showToast(t('meetup.saved', { names }), 8000, {
        label: strings['meetup.undo'],
        run: () => events.removeEverywhere({ id: eventId }).catch((error) => showToast(error.message)),
      });
    } catch (error) {
      save.disabled = false;
      message.textContent = error.message;
    }
  });
}

export function initMeetup() {
  document.querySelectorAll('[data-action="met-up"]').forEach((el) => el.addEventListener('click', () => openMeetup()));
}
