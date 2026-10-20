// Formatted text for notes (bold, italic, underline) without storing any HTML.
//
// A text is saved as a list of lines. A line is a list of pieces: [text, style].
// The style is a number: 1 = bold, 2 = italic, 4 = underline, added together (3 = bold and italic).
//   Example: [[["Hello ", 0], ["world", 1]], [], [["Next line", 0]]]
// Because only plain text and these numbers are stored, pasted or typed HTML can never end up in a note.

const BOLD = 1;
const ITALIC = 2;
const UNDERLINE = 4;
const BLOCKS = new Set(['DIV', 'P', 'LI', 'UL', 'OL', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'BLOCKQUOTE', 'PRE']);

// Reads the lines out of the editing box (an element the user typed in).
export function readBody(root) {
  const lines = [];
  let current = null;
  const line = () => {
    if (!current) {
      current = [];
      lines.push(current);
    }
    return current;
  };
  const endLine = () => {
    current = null;
  };
  const addText = (text, style) => {
    if (!text) return;
    const target = line();
    const last = target[target.length - 1];
    if (last && last[1] === style) last[0] += text;
    else target.push([text, style]);
  };

  const walk = (node, style) => {
    node.childNodes.forEach((child) => {
      if (child.nodeType === Node.TEXT_NODE) {
        child.textContent
          .replace(/ /g, ' ')
          .split('\n')
          .forEach((part, index) => {
            if (index > 0) {
              line();
              endLine();
            }
            addText(part, style);
          });
        return;
      }
      if (child.nodeType !== Node.ELEMENT_NODE) return;
      const tag = child.tagName;
      if (tag === 'BR') {
        line();
        endLine();
        return;
      }
      let childStyle = style;
      const css = child.style || {};
      if (tag === 'B' || tag === 'STRONG' || css.fontWeight === 'bold' || Number(css.fontWeight) >= 600) childStyle |= BOLD;
      if (tag === 'I' || tag === 'EM' || css.fontStyle === 'italic') childStyle |= ITALIC;
      if (tag === 'U' || String(css.textDecorationLine || css.textDecoration || '').includes('underline')) childStyle |= UNDERLINE;
      const block = BLOCKS.has(tag);
      if (block) endLine();
      walk(child, childStyle);
      if (block) endLine();
    });
  };

  walk(root, 0);
  while (lines.length && lines[lines.length - 1].length === 0) lines.pop(); // blank lines at the end are dropped
  return lines;
}

function pieceNode(text, style) {
  let node = document.createTextNode(text);
  const wrap = (tag) => {
    const outer = document.createElement(tag);
    outer.append(node);
    node = outer;
  };
  if (style & UNDERLINE) wrap('u');
  if (style & ITALIC) wrap('i');
  if (style & BOLD) wrap('b');
  return node;
}

// For showing a note: one paragraph per line.
export function renderBody(lines) {
  const fragment = document.createDocumentFragment();
  lines.forEach((line) => {
    const paragraph = document.createElement('p');
    paragraph.className = 'note-line';
    if (line.length === 0) paragraph.append(document.createElement('br'));
    line.forEach(([text, style]) => paragraph.append(pieceNode(text, style)));
    fragment.append(paragraph);
  });
  return fragment;
}

// For editing a note: puts the saved lines into the editing box.
export function fillEditor(root, lines) {
  root.replaceChildren();
  lines.forEach((line, index) => {
    if (index > 0) root.append(document.createElement('br'));
    line.forEach(([text, style]) => root.append(pieceNode(text, style)));
  });
}

// True when there is no visible text at all.
export function isEmpty(lines) {
  return !lines.some((line) => line.some(([text]) => text.trim()));
}

export function sameBody(a, b) {
  return JSON.stringify(a || []) === JSON.stringify(b || []);
}
