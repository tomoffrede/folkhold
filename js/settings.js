// Your settings: one small encrypted record, saved like any other item.
// get('contactSort') reads a setting (with its default); set('contactSort', 'last') saves one.

import * as store from './store.js';

const DEFAULTS = {
  contactSort: 'first', // 'first' = by first name, 'last' = by last name
};

let queue = Promise.resolve(); // saves run one after the other, so the record is never created twice

function current() {
  return store.list('settings')[0] || null;
}

export function get(key) {
  const item = current();
  return item && item[key] !== undefined ? item[key] : DEFAULTS[key];
}

export function set(key, value) {
  const run = queue.then(async () => {
    const item = current();
    if (item) {
      const { id, ...fields } = item;
      await store.update('settings', id, { ...fields, [key]: value });
    } else {
      await store.add('settings', { [key]: value });
    }
  });
  queue = run.catch(() => {}); // a failed save must not block the next one
  return run;
}
