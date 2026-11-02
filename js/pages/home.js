// Home page: a worked example, so the first page isn't empty. Computed live with the
// same math as the Calculator, in the chosen currency.
import { loanLine } from '../explain.js';
import { FREQUENCIES, amortizationSchedule, periodicPayment, summarize } from '../finance.js';
import { formatMoney } from '../format.js';
import { SHARE_FIELDS, toQuery } from '../share.js';

const EXAMPLE = { principal: 15000, annualRate: 6, years: 5, periodsPerYear: FREQUENCIES.monthly };

function fill($example) {
  const { totalInterest, totalPaid } = summarize(amortizationSchedule(EXAMPLE));
  const show = (name, text) => $example.find(`[data-field="${name}"]`).text(text);
  show('loan', loanLine(EXAMPLE));
  show('payment', formatMoney(periodicPayment(EXAMPLE)));
  show('interest', formatMoney(totalInterest));
  show('paid', formatMoney(totalPaid));
  // A shared link, so the Calculator opens with the example filled in and worked out.
  $example.find('[data-field="link"]').attr('href', `#/calculator?${toQuery(EXAMPLE, SHARE_FIELDS['/calculator'])}`);
}

export function init($root) {
  fill($root.find('#home-example'));
}

// A different currency: redraw the example in place, if Home is showing.
$(document).on('currencychange', () => {
  const $example = $('#home-example');
  if ($example.length) fill($example);
});
