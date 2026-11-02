// Calculator page: one loan, its summary, and the schedule printed as a receipt.
import { scheduleCsv, scheduleFileName } from '../csv.js';
import { downloadText } from '../download.js';
import { FREQUENCIES, amortizationSchedule, groupByYear, periodicPayment, summarize } from '../finance.js';
import { formatMoney, formatNumber, splitMoney } from '../format.js';
import { showToast } from '../toast.js';
import { handleSubmit, readNumber } from './forms.js';

// The last result, kept for the "Tear off (CSV)" button.
let last = null;

function calculate($form) {
  const loan = {
    principal: readNumber($form, 'principal'),
    annualRate: readNumber($form, 'annualRate'),
    years: readNumber($form, 'years'),
    periodsPerYear: readNumber($form, 'periodsPerYear'),
  };
  const schedule = amortizationSchedule(loan);
  return { loan, schedule, payment: periodicPayment(loan), ...summarize(schedule) };
}

// The euro sign gets its own span: on phones it's hidden from view (still read out by
// screen readers) to make room for five columns. The receipt's header names the currency.
function moneyCell(amount) {
  const { currency, number } = splitMoney(amount);
  return $('<td class="text-end">').append(
    $('<span class="receipt-currency">').text(currency),
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

function describeLoan({ principal, annualRate, years, periodsPerYear }) {
  const term = `${formatNumber(years)} ${years === 1 ? 'year' : 'years'}`;
  const frequency = periodsPerYear === FREQUENCIES.monthly ? 'monthly' : 'every two weeks';
  return `${formatMoney(principal)} at ${formatNumber(annualRate)}% over ${term}, ${frequency}`;
}

function render($section, result) {
  const { loan, schedule, payment, totalInterest, totalPaid, payments } = result;
  const show = (name, text) => $section.find(`[data-field="${name}"]`).text(text);
  last = result;

  show('paymentLabel', loan.periodsPerYear === FREQUENCIES.monthly ? 'Monthly payment' : 'Payment every two weeks');
  show('payment', formatMoney(payment));
  show('totalInterest', formatMoney(totalInterest));
  show('totalPaid', formatMoney(totalPaid));
  show('payments', formatNumber(payments));

  show('receiptLoan', describeLoan(loan));
  show('receiptInterest', formatMoney(totalInterest));
  show('receiptPaid', formatMoney(totalPaid));

  // A longer loan makes a longer receipt. Every row is built first and inserted in
  // one go, so the page reflows once.
  const rows = groupByYear(schedule, loan.periodsPerYear).flatMap(yearRows);
  const $table = $section.find('.receipt-table');
  $table.children('tbody').remove();
  $table.append(rows);
}

handleSubmit('#calculator-form', '#calculator-results', calculate, render);

$(document).on('click', '#calculator-results [data-action="tear-off"]', () => {
  if (!last) return;
  const fileName = scheduleFileName(last.loan);
  downloadText(fileName, scheduleCsv(last.schedule, last.loan.periodsPerYear));
  showToast(`Torn off and saved as ${fileName}.`);
});
