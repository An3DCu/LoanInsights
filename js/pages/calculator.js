// Calculator page: one loan, its summary and the full schedule.
import { FREQUENCIES, amortizationSchedule, periodicPayment, summarize } from '../finance.js';
import { formatMoney, formatNumber } from '../format.js';
import { handleSubmit, readNumber } from './forms.js';

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

function render($section, { loan, schedule, payment, totalInterest, totalPaid, payments }) {
  const show = (name, text) => $section.find(`[data-field="${name}"]`).text(text);

  show('paymentLabel', loan.periodsPerYear === FREQUENCIES.monthly ? 'Monthly payment' : 'Payment every two weeks');
  show('payment', formatMoney(payment));
  show('totalInterest', formatMoney(totalInterest));
  show('totalPaid', formatMoney(totalPaid));
  show('payments', formatNumber(payments));

  // Build every row first and insert them in one go, so the page reflows once.
  const rows = schedule.map((row) => $('<tr>').append(
    $('<td>').text(row.number),
    $('<td class="text-end">').text(formatMoney(row.payment)),
    $('<td class="text-end">').text(formatMoney(row.principal)),
    $('<td class="text-end">').text(formatMoney(row.interest)),
    $('<td class="text-end">').text(formatMoney(row.balance)),
  ));
  $section.find('[data-field="schedule"]').empty().append(rows);
}

handleSubmit('#calculator-form', '#calculator-results', calculate, render);
