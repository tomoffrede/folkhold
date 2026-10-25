// "Back" that follows the pages the person actually visited.
// The browser's history is the truth; we only remember which page sits at which position in it.

const pages = []; // pages[i] is the address at history position i (known only for pages seen in this tab load)
let index = 0;
let replacing = false;

function stamp() {
  const state = history.state;
  if (state && typeof state.idx === 'number') {
    index = state.idx; // arrived by Back/Forward or a reload
  } else {
    if (!replacing) index += 1; // a new page was opened
    history.replaceState({ idx: index }, '');
  }
  replacing = false;
  pages[index] = location.hash;
}

// Leaves the current page for `dest`. If the page before this one already is `dest`, go back to it
// (so "Back" afterwards leads on to the page before that); otherwise swap this page for `dest`.
export function leave(dest) {
  if (index > 0 && pages[index - 1] === dest) {
    history.back();
    return;
  }
  replacing = true;
  if (location.hash === dest) replacing = false;
  else location.replace(dest);
}

export function initNav() {
  const state = history.state;
  index = state && typeof state.idx === 'number' ? state.idx : 0;
  history.replaceState({ idx: index }, '');
  pages[index] = location.hash;
  window.addEventListener('hashchange', stamp);
  // Every "← Back" style link goes through leave().
  document.addEventListener('click', (event) => {
    const link = event.target.closest && event.target.closest('a.back');
    if (!link || link.id === 'pages-back') return;
    event.preventDefault();
    leave(link.getAttribute('href'));
  });
}
