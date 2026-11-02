// Compare page: two loans side by side and one sentence on what the difference means.
import { comparisonCsv } from '../csv.js';
import { downloadText } from '../download.js';
import { compareSentence } from '../explain.js';
import { compareLoans } from '../finance.js';
import { formatDuration, formatMoney } from '../format.js';
import { showToast } from '../toast.js';
import { handleSubmit, readNumber, restoreFromLink } from './forms.js';

// The last comparison, kept for the "Save as CSV" button.
let last = null;

// Called by the router each time the page is shown: a shared link fills both loans
// and compares them.
export function init($root, params) {
  restoreFromLink($root.find('#compare-form'), params, '/compare');
}

function readLoan($form, key) {
  return {
    principal: readNumber($form, `${key}.principal`),
    annualRate: readNumber($form, `${key}.annualRate`),
    years: readNumber($form, `${key}.years`),
    periodsPerYear: readNumber($form, `${key}.periodsPerYear`),
  };
}

function calculate($form) {
  const a = readLoan($form, 'a');
  const b = readLoan($form, 'b');
  return { result: compareLoans(a, b), samePaymentFrequency: a.periodsPerYear === b.periodsPerYear };
}

function render($section, { result, samePaymentFrequency }) {
  const { a, b, difference } = result;
  last = { result, samePaymentFrequency };
  const cell = (row, col, text) => $section.find(`[data-row="${row}"] [data-col="${col}"]`).text(text);
  const signedMoney = (amount) => formatMoney(amount, { signed: true });

  $section.find('[data-field="sentence"]').text(compareSentence(result, { samePaymentFrequency }));

  cell('payment', 'a', formatMoney(a.payment));
  cell('payment', 'b', formatMoney(b.payment));
  // A monthly payment minus a bi-weekly one isn't a meaningful number.
  cell('payment', 'difference', samePaymentFrequency ? signedMoney(difference.payment) : 'Not comparable');

  cell('time', 'a', formatDuration(a.years));
  cell('time', 'b', formatDuration(b.years));
  const sameTerm = Math.round(difference.years * 12) === 0;
  cell('time', 'difference', sameTerm ? 'Same'
    : `${formatDuration(difference.years)} ${difference.years > 0 ? 'longer' : 'shorter'}`);

  cell('totalInterest', 'a', formatMoney(a.totalInterest));
  cell('totalInterest', 'b', formatMoney(b.totalInterest));
  cell('totalInterest', 'difference', signedMoney(difference.totalInterest));

  cell('totalPaid', 'a', formatMoney(a.totalPaid));
  cell('totalPaid', 'b', formatMoney(b.totalPaid));
  cell('totalPaid', 'difference', signedMoney(difference.totalPaid));
}

handleSubmit('#compare-form', '#compare-results', calculate, render, '/compare');

$(document).on('click', '#compare-results [data-action="save-comparison"]', () => {
  if (!last) return;
  const fileName = 'loan-comparison.csv';
  downloadText(fileName, comparisonCsv(last.result, { samePaymentFrequency: last.samePaymentFrequency }));
  showToast(`Saved as ${fileName}.`);
});
