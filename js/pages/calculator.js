// Calculator page: one loan, its summary, and the schedule printed as a receipt.
import { chartSlot, drawYearBars } from '../charts.js';
import { scheduleCsv, scheduleFileName } from '../csv.js';
import { downloadText } from '../download.js';
import { interestNote, interestShareSentence, loanLine, yearOneNote } from '../explain.js';
import { FREQUENCIES, amortizationSchedule, groupByYear, loanErrors, periodicPayment, summarize } from '../finance.js';
import { formatMoney, formatNumber, splitMoney } from '../format.js';
import { showToast } from '../toast.js';
import { handleSubmit, readNumber, restoreFromLink, showNote } from './forms.js';

// The last result, kept for the "Tear off (CSV)" button.
let last = null;
const chart = chartSlot();

// Called by the router each time the page is shown. A shared link fills the form and
// calculates; the cleanup it returns runs when the page goes away, so the chart is
// destroyed with it.
export function init($root, params) {
  restoreFromLink($root.find('#calculator-form'), params, '/calculator');
  return () => chart.destroy();
}

function readLoan($form) {
  return {
    principal: readNumber($form, 'principal'),
    annualRate: readNumber($form, 'annualRate'),
    years: readNumber($form, 'years'),
    periodsPerYear: readNumber($form, 'periodsPerYear'),
  };
}

function calculate($form) {
  const loan = readLoan($form);
  const schedule = amortizationSchedule(loan);
  return { loan, schedule, payment: periodicPayment(loan), ...summarize(schedule) };
}

// The currency sign (with its space, for KM) gets its own span: on phones it's hidden
// from view (still read out by screen readers) to make room for five columns. The
// receipt's header names the currency.
function moneyCell(amount) {
  const { currency, separator, number } = splitMoney(amount);
  return $('<td class="text-end">').append(
    $('<span class="receipt-currency">').text(currency + separator),
    $('<span>').text(number),
  );
}

// One year on the receipt: a row with the year's totals, whose button opens a second
// tbody with every payment in that year (a Bootstrap collapse).
function yearRows(year) {
  const id = `calc-year-${year.year}`;
  // "Year 1" on wide screens, "Y1" on phones, where every character of width counts.
  // Screen readers always get the full word; the short form is hidden from them.
  const $toggle = $('<button class="receipt-toggle" type="button" data-bs-toggle="collapse">')
    .attr({ 'data-bs-target': `#${id}`, 'aria-controls': id, 'aria-expanded': 'false' })
    .append(
      $('<span class="year-long">').text(`Year ${year.year}`),
      $('<span class="year-short" aria-hidden="true">').text(`Y${year.year}`),
    );

  const $summary = $('<tbody class="receipt-year">').append($('<tr>').append(
    $('<th scope="row">').append($toggle),
    moneyCell(year.paid),
    moneyCell(year.principal),
    moneyCell(year.interest),
    moneyCell(year.balance),
  ));

  const $payments = $('<tbody class="receipt-payments collapse">').attr('id', id).append(
    year.payments.map((row) => $('<tr>').append(
      $('<td>').text(row.number),
      moneyCell(row.payment),
      moneyCell(row.principal),
      moneyCell(row.interest),
      moneyCell(row.balance),
    )),
  );
  return [$summary, $payments];
}

function render($section, result) {
  const { loan, schedule, payment, totalInterest, totalPaid, payments } = result;
  const show = (name, text) => $section.find(`[data-field="${name}"]`).text(text);
  last = result;

  show('paymentLabel', loan.periodsPerYear === FREQUENCIES.monthly ? 'Monthly payment' : 'Payment every two weeks');
  show('payment', formatMoney(payment));
  show('totalInterest', formatMoney(totalInterest));
  showNote($section.find('[data-note="interest"]'), interestNote(totalInterest));
  show('totalPaid', formatMoney(totalPaid));
  show('payments', formatNumber(payments));

  show('receiptLoan', loanLine(loan));

  // A longer loan makes a longer receipt. Every row is built first and inserted in
  // one go, so the page reflows once.
  const years = groupByYear(schedule, loan.periodsPerYear);
  const $table = $section.find('.receipt-table');
  $table.children('tbody').remove();
  $table.append(years.flatMap(yearRows));

  // The year 1 note sits in year 1's own row group, so it stays when the year is closed.
  const note = yearOneNote(years);
  if (note) {
    $table.find('tbody.receipt-year').first().append($('<tr class="receipt-note">').append(
      $('<td colspan="5">').append($('<span class="margin-note">').text(note)),
    ));
  }

  // The chart's story in words: visible under the chart, and the canvas's label.
  const sentence = interestShareSentence(years);
  show('chartSummary', sentence);
  const canvas = $section.find('.chart canvas').attr('aria-label', `Bar chart of principal and interest per year. ${sentence}`)[0];
  // If Chart.js can't load, the empty frame goes and the caption says why.
  const $frame = $(canvas).closest('.chart-canvas').removeClass('d-none');
  chart.show(() => drawYearBars(canvas, years)).catch((error) => {
    console.error(error);
    $frame.addClass('d-none');
    show('chartSummary', `${sentence} (The chart couldn't load, but the numbers above and below are complete.)`);
  });
}

handleSubmit({
  form: '#calculator-form',
  results: '#calculator-results',
  check: ($form) => loanErrors(readLoan($form)),
  calculate,
  render,
  route: '/calculator',
});

$(document).on('click', '#calculator-results [data-action="tear-off"]', () => {
  if (!last) return;
  const fileName = scheduleFileName(last.loan);
  downloadText(fileName, scheduleCsv(last.schedule, last.loan.periodsPerYear));
  showToast(`Torn off and saved as ${fileName}.`);
});
