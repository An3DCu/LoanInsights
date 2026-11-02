// Messages for screen readers. One polite live region sits in index.html from the
// start: a region that appears together with its text is often not read at all.
export function announce(text) {
  const $region = $('#announcer');
  // Emptied first and filled a moment later, so the same message twice is read twice.
  $region.text('');
  setTimeout(() => $region.text(text), 100);
}
