// Your settings: one small encrypted record, saved like any other item.
// get('contactSort') reads a setting (with its default); set('contactSort', 'last') saves one.

import * as store from './store.js';

const DEFAULTS = {
  contactSort: 'first', // 'first' = by first name, 'last' = by last name
  showLastMet: true, // show "Last met: ..." on a contact's page
  hiddenFields: [], // detail buttons not offered: 'emails', 'phones', 'addresses', 'handles', 'birthday', 'met'
  showPriority: true, // show the priority choice when writing a note
};

let queue = Promise.resolve(); // saves run one after the other, so the record is never created twice

// There is normally one settings record. If two devices each made one, they are read together (the newer wins).
function records() {
  return store.list('settings').sort((a, b) => store.version(a.id).localeCompare(store.version(b.id)));
}

function current() {
  const list = records();
  if (!list.length) return null;
  const merged = Object.assign({}, ...list.map(({ id, ...fields }) => fields));
  return { ...merged, id: list[0].id };
}

export function get(key) {
  const item = current();
  return item && item[key] !== undefined ? item[key] : DEFAULTS[key];
}

async function write(key, value) {
  const item = current();
  if (!item) {
    await store.add('settings', { [key]: value });
    return;
  }
  const { id, ...fields } = item;
  await store.update('settings', id, { ...fields, [key]: value });
  // Any extra record (made on another device) is now merged into this one, so it is removed.
  for (const other of records().filter((record) => record.id !== id)) await store.remove('settings', other.id).catch(() => {});
}

export function set(key, value) {
  const run = queue.then(async () => {
    try {
      await write(key, value);
    } catch (error) {
      if (!error.conflict) throw error;
      await write(key, value); // the newest settings are loaded now: once more
    }
  });
  queue = run.catch(() => {}); // a failed save must not block the next one
  return run;
}
