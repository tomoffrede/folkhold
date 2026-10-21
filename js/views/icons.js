// Tiny person symbols: one person for "their life", two people for "you & them". They use the text colour.

const NS = 'http://www.w3.org/2000/svg';

function person(offset) {
  const group = document.createElementNS(NS, 'g');
  group.setAttribute('transform', `translate(${offset} 0)`);
  const head = document.createElementNS(NS, 'circle');
  head.setAttribute('cx', '5');
  head.setAttribute('cy', '3');
  head.setAttribute('r', '2.6');
  const body = document.createElementNS(NS, 'path');
  body.setAttribute('d', 'M0.5 14V9.5A4.5 4.5 0 0 1 5 6A4.5 4.5 0 0 1 9.5 9.5V14Z');
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
