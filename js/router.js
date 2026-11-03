// Hash router on top of jQuery. Replaces spapp.
//
// A route is a hash like #/calculator. For each one the route table names an HTML
// fragment in views/ and, optionally, a page module with an init($root, params)
// function. init may return a cleanup function, which runs before the next page
// replaces this one (for things like charts that must be destroyed).
//
// Hash routes never reach the server, so the site works on GitHub Pages without
// any rewrite rules, and back, forward and refresh all keep you on the right page.

const APP_NAME = 'Loan Insights';

// "#/calculator?amount=10000" -> { path: '/calculator', params: URLSearchParams }
function parseHash(hash) {
  const [rawPath, query = ''] = hash.replace(/^#/, '').split('?');
  const path = rawPath.length > 1 ? rawPath.replace(/\/+$/, '') : '/';
  return { path, params: new URLSearchParams(query) };
}

// onRender($outlet) runs after every page is inserted, before the page's own init,
// for things every page needs (like the current currency sign in labels).
export function createRouter({ routes, notFound, $outlet, $nav, onRender }) {
  const fragments = new Map(); // view name -> its HTML, so each file is fetched once
  let cleanup = null;
  let navigation = 0; // counts navigations, so a slow load can't overwrite a newer page
  let firstRender = true;

  async function loadFragment(view) {
    if (!fragments.has(view)) {
      fragments.set(view, await $.get({ url: `views/${view}.html`, dataType: 'html' }));
    }
    return fragments.get(view);
  }

  function markActiveLink(path) {
    $nav.find('a.nav-link').each(function () {
      const isCurrent = $(this).attr('href') === `#${path}`;
      $(this).toggleClass('active', isCurrent).attr('aria-current', isCurrent ? 'page' : null);
    });
  }

  // Set out like an empty state, in the same voice, with a way to ask again.
  function showLoadError() {
    const $message = $('<div class="empty-state" role="alert">').append(
      $('<p class="empty-state-title">').text('This page didn\'t come through.'),
      $('<p>').text('Check your connection, then try again.'),
      $('<button class="btn btn-outline-primary" type="button">').text('Try again').on('click', render),
    );
    $outlet.empty().append($message);
  }

  async function render() {
    const id = ++navigation;
    const { path, params } = parseHash(window.location.hash);
    // Only the table's own routes: "#constructor" or "#__proto__" would otherwise
    // match properties every object has, and show a load error instead of the 404.
    const route = Object.hasOwn(routes, path) ? routes[path] : notFound;

    let html;
    try {
      html = await loadFragment(route.view);
    } catch {
      if (id === navigation) showLoadError();
      return;
    }
    if (id !== navigation) return; // the user already moved on

    cleanup?.();
    cleanup = null;

    // parseHTML leaves out <script> tags, so a fragment can only ever be markup.
    $outlet.empty().append($.parseHTML(html));
    document.title = route.title ? `${route.title} · ${APP_NAME}` : APP_NAME;
    markActiveLink(path);
    onRender?.($outlet);

    const result = route.page?.init($outlet, params);
    if (typeof result === 'function') cleanup = result;

    window.scrollTo(0, 0);
    // After a navigation, screen reader and keyboard users start at the new heading.
    // Not on the first load, where focus should stay at the top of the document.
    if (!firstRender) $outlet.find('h1').first().attr('tabindex', '-1').trigger('focus');
    firstRender = false;
  }

  return {
    start() {
      $(window).on('hashchange', render);
      render();
    },
  };
}
