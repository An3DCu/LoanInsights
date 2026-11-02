// Starts the app: the route table, a few site-wide handlers, then the router.
import { createRouter } from './router.js';
// Each page binds its form once, on document, when its module loads. Pages with a
// chart also export init(), whose cleanup destroys the chart when the page goes away.
import * as calculatorPage from './pages/calculator.js';
import './pages/compare.js';
import * as payoffPage from './pages/payoff.js';

const routes = {
  '/': { view: 'home' },
  '/calculator': { view: 'calculator', title: 'Calculator', page: calculatorPage },
  '/compare': { view: 'compare', title: 'Compare loans' },
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

createRouter({ routes, notFound, $outlet: $('#app'), $nav: $('#main-nav') }).start();
