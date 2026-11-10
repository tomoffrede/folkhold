// Tiny person symbols: one person for "their life", two people for "you & them". They use the text colour.

const NS = 'http://www.w3.org/2000/svg';

function person(offset) {
  const group = document.createElementNS(NS, 'g');
  group.setAttribute('transform', `translate(${offset} 0)`);
  const head = document.createElementNS(NS, 'circle');
  head.setAttribute('cx', '5');
  head.setAttribute('cy', '3.4');
  head.setAttribute('r', '3');
  const body = document.createElementNS(NS, 'path');
  body.setAttribute('d', 'M0.8 14V11A4.2 4.2 0 0 1 5 7.2A4.2 4.2 0 0 1 9.2 11V14Z');
  group.append(head, body);
  return group;
}

// count: 1 or 2
export function personIcon(count) {
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', count === 2 ? '0 0 20 14' : '0 0 10 14');
  svg.setAttribute('class', `who-icon who-${count}`);
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  svg.append(person(0));
  if (count === 2) svg.append(person(10));
  return svg;
}

// A pin (filled when the contact is pinned). It uses the text colour.
export function pinIcon(filled) {
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('class', 'pin-icon');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  svg.setAttribute('fill', filled ? 'currentColor' : 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '2');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  const path = document.createElementNS(NS, 'path');
  path.setAttribute('d', 'M9 3h6l-1 6 3 3v2H7v-2l3-3-1-6ZM12 14v7');
  svg.append(path);
  return svg;
}
