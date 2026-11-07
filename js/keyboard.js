// Getting the cursor (and on a phone the keyboard) into a field right after the screen changes.
// A phone only opens the keyboard for a field focused straight from a tap. The screen is built a moment after the tap,
// so the tap handler calls primeKeyboard() (focus goes to an invisible field, the keyboard opens), and the new screen
// then calls focusSoon() to hand the focus over to the real field; the keyboard stays open.

let proxy = null;

function release() {
  if (proxy) proxy.remove();
  proxy = null;
}

export function primeKeyboard() {
  release();
  proxy = document.createElement('input');
  proxy.type = 'text';
  proxy.tabIndex = -1;
  proxy.setAttribute('aria-hidden', 'true');
  proxy.style.cssText = 'position:fixed;top:0;left:0;width:1px;height:1px;opacity:0;border:0;padding:0;font-size:16px;pointer-events:none';
  document.body.append(proxy);
  proxy.focus();
  setTimeout(release, 1500); // a safety net, in case no screen takes over
}

// `focus` is a function that puts the cursor in the wanted field. It is tried at once and again shortly after,
// in case the screen was not visible yet, but never when the person has already clicked somewhere else.
export function focusSoon(focus) {
  const free = () => !document.activeElement || document.activeElement === document.body || document.activeElement === proxy;
  focus();
  requestAnimationFrame(() => free() && focus());
  setTimeout(() => {
    if (free()) focus();
    release();
  }, 150);
}
