// Hands text to the browser as a file download. Nothing goes to a server: the file is
// made in memory (a Blob), given a temporary blob: URL, and clicked through a link
// that's removed right after.
export function downloadText(fileName, text, type = 'text/csv') {
  const url = URL.createObjectURL(new Blob([text], { type: `${type};charset=utf-8` }));
  const $link = $('<a>').attr({ href: url, download: fileName }).appendTo(document.body);
  $link[0].click();
  $link.remove();
  // Give the browser a moment to start the download before the URL is freed.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
