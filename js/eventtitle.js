// The title shown for an event: its own title, or a name for the kind of event when it has none ("Met up" for meet-ups).

import { strings } from './strings.js';

export function eventTitle(event) {
  return event.title || strings[event.kind === 'together' ? 'event.metUp' : 'event.untitled'];
}
