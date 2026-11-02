// Starts the app: the route table, a few site-wide handlers, then the router.
import { currencySymbol, currentCurrency, setCurrency } from './format.js';
import { createRouter } from './router.js';
import { showToast } from './toast.js';
// Each page binds its form once, on document, when its module loads. Its init() fills
// the form from a shared link; pages with a chart also return a cleanup from it.
import * as calculatorPage from './pages/calculator.js';
import * as comparePage from './pages/compare.js';
import * as homePage from './pages/home.js';
import * as payoffPage from './pages/payoff.js';

const routes = {
  '/': { view: 'home', page: homePage },
  '/calculator': { view: 'calculator', title: 'Calculator', page: calculatorPage },
  '/compare': { view: 'compare', title: 'Compare loans', page: comparePage },
  '/payoff': { view: 'payoff', title: 'Pay off faster', page: payoffPage },
  '/about': { view: 'about', title: 'About' },
};
const notFound = { view: '404', title: 'Page not found' };

// The hash belongs to the router, so the skip link moves focus itself instead of
// letting the browser jump to #app, which the router would read as a route.
$(document).on('click', '.skip-link', (event) => {
  event.preventDefault();
  $('#app').trigger('focus');
});

// On phones the nav is a collapsed menu. Close it once a page is picked.
$(document).on('click', '#main-nav .nav-link', () => {
  window.bootstrap.Collapse.getInstance('#main-nav')?.hide();
});

// "Copy link": after a result, the address already holds the form's values.
$(document).on('click', '[data-action="copy-link"]', async () => {
  try {
    await navigator.clipboard.writeText(window.location.href);
    showToast('Link copied. Anyone who opens it sees this result.');
  } catch {
    showToast('Couldn\'t copy. The address in your browser\'s bar is the link.');
  }
});

// Currency. It only changes how amounts look, so switching re-runs the visible result
// in the new currency. The choice is saved on this device; storage can be blocked
// (private windows), in which case it lasts until the page is closed.
const CURRENCY_KEY = 'loan-insights-currency';

function showCurrencySymbols($root) {
  $root.find('[data-currency-symbol]').text(currencySymbol());
}

try {
  setCurrency(window.localStorage.getItem(CURRENCY_KEY));
} catch {
  // Not saved before, or storage is blocked: stay with euros.
}
$('#currency').val(currentCurrency());

$(document).on('change', '#currency', (event) => {
  const code = setCurrency(event.target.value);
  try {
    window.localStorage.setItem(CURRENCY_KEY, code);
  } catch {
    // Applied below, just not remembered.
  }
  showCurrencySymbols($('#app'));
  $(document).trigger('currencychange');
  // Each page has one form; if its result is showing, work it out again.
  if ($('#app section[id$="-results"]:not(.d-none)').length) $('#app form')[0].requestSubmit();
});

createRouter({
  routes,
  notFound,
  $outlet: $('#app'),
  $nav: $('#main-nav'),
  onRender: showCurrencySymbols,
}).start();
