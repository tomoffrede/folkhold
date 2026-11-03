// Keyboard use of a dropdown list that sits under a text field: the arrow keys move a highlight through the options,
// Enter picks the highlighted one. The highlighted option carries the class "is-active".
// Call from the field's keydown handler; it returns true when it handled the key.
//   options()  the option buttons currently shown, in order
//   open()     (optional) opens the list when it is closed and an arrow is pressed
export function handleDropKeys(event, options, open) {
  const { key } = event;
  if (key !== 'ArrowDown' && key !== 'ArrowUp' && key !== 'Enter') return false;
  let list = options();
  if (!list.length && key !== 'Enter' && open) {
    open();
    list = options();
  }
  if (!list.length) return false;
  const at = list.findIndex((option) => option.classList.contains('is-active'));
  if (key === 'Enter') {
    if (at < 0) return false;
    event.preventDefault();
    list[at].click();
    return true;
  }
  event.preventDefault();
  const next = key === 'ArrowDown' ? (at + 1) % list.length : (at <= 0 ? list.length - 1 : at - 1);
  list.forEach((option, i) => option.classList.toggle('is-active', i === next));
  list[next].scrollIntoView({ block: 'nearest' });
  return true;
}
