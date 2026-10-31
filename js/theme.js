// Light or dark. Runs in <head> as a plain script, before the page is drawn, so it
// never flashes the wrong colors. jQuery and the modules load too late for that,
// which is why this one file is plain JavaScript.
//
// Default: the system setting (prefers-color-scheme). The switch overrides it, and
// the choice is saved on this device. If storage is blocked (private windows, some
// privacy settings), the switch still works until the page is reloaded.
(function () {
  const KEY = 'loan-insights-theme';
  const system = window.matchMedia('(prefers-color-scheme: dark)');

  function saved() {
    try {
      return window.localStorage.getItem(KEY);
    } catch {
      return null;
    }
  }

  function apply(theme) {
    document.documentElement.setAttribute('data-bs-theme', theme);
    const toggle = document.getElementById('theme-toggle');
    if (toggle) toggle.setAttribute('aria-pressed', String(theme === 'dark'));
  }

  apply(saved() || (system.matches ? 'dark' : 'light'));

  // Follow the system while nobody has picked a side.
  system.addEventListener('change', (event) => {
    if (!saved()) apply(event.matches ? 'dark' : 'light');
  });

  // The switch is in the page body, which doesn't exist yet when this runs.
  document.addEventListener('DOMContentLoaded', () => {
    apply(document.documentElement.getAttribute('data-bs-theme'));
  });

  document.addEventListener('click', (event) => {
    if (!event.target.closest('#theme-toggle')) return;
    const next = document.documentElement.getAttribute('data-bs-theme') === 'dark' ? 'light' : 'dark';
    try {
      window.localStorage.setItem(KEY, next);
    } catch {
      // Not saved, but still applied below.
    }
    apply(next);
  });
}());
