// Pay off faster page: the current plan next to either an extra payment or
// accelerated bi-weekly payments.
import { chartSlot, drawBalanceLines } from '../charts.js';
import { balanceSentence, payoffSentence } from '../explain.js';
import { FREQUENCIES, acceleratedBiweekly, payoffWithExtra } from '../finance.js';
import { formatDuration, formatMoney, formatNumber } from '../format.js';
import { handleSubmit, readNumber, restoreFromLink } from './forms.js';

const strategyOf = ($form) => $form.find('[name="strategy"]:checked').val();
const chart = chartSlot();

// Called by the router each time the page is shown. A shared link fills the form and
// calculates; the cleanup destroys the chart.
export function init($root, params) {
  restoreFromLink($root.find('#payoff-form'), params, '/payoff');
  return () => chart.destroy();
}

// Show only the fields and labels that belong to the chosen plan.
$(document).on('change', '#payoff-form [name="strategy"]', (event) => {
  const $form = $(event.currentTarget).closest('form');
  const strategy = strategyOf($form);
  $form.find('[data-strategy]').each(function () {
    $(this).toggleClass('d-none', $(this).data('strategy') !== strategy);
  });
});

function calculate($form) {
  const balance = readNumber($form, 'balance');
  const annualRate = readNumber($form, 'annualRate');
  const payment = readNumber($form, 'payment');

  if (strategyOf($form) === 'accelerated') {
    const result = acceleratedBiweekly({ balance, annualRate, payment });
    return {
      ...result,
      now: result.monthly,
      plan: result.accelerated,
      planHeading: 'Accelerated bi-weekly',
      planLabel: 'with accelerated bi-weekly payments',
      nowPerYear: FREQUENCIES.monthly,
      planPerYear: FREQUENCIES.biweekly,
      balance,
    };
  }

  const periodsPerYear = readNumber($form, 'periodsPerYear');
  const result = payoffWithExtra({ balance, annualRate, payment, extra: readNumber($form, 'extra'), periodsPerYear });
  return {
    ...result,
    now: result.original,
    plan: result.withExtra,
    planHeading: 'With extra',
    planLabel: 'with the extra payment',
    nowPerYear: periodsPerYear,
    planPerYear: periodsPerYear,
    balance,
  };
}

function render($section, result) {
  const { now, plan } = result;
  const cells = (row, nowText, planText) => {
    $section.find(`[data-row="${row}"] [data-col="now"]`).text(nowText);
    $section.find(`[data-row="${row}"] [data-col="plan"]`).text(planText);
  };

  $section.find('[data-field="sentence"]').text(payoffSentence(result));
  $section.find('[data-field="planHeading"]').text(result.planHeading);

  cells('payment', formatMoney(now.schedule[0].payment), formatMoney(plan.schedule[0].payment));
  cells('payments', formatNumber(now.payments), formatNumber(plan.payments));
  cells('time', formatDuration(now.years), formatDuration(plan.years));
  cells('totalInterest', formatMoney(now.totalInterest), formatMoney(plan.totalInterest));
  cells('totalPaid', formatMoney(now.totalPaid), formatMoney(plan.totalPaid));

  // The chart's story in words: visible under the chart, and the canvas's label.
  const sentence = balanceSentence(now.years, plan.years, result.planLabel);
  $section.find('[data-field="chartSummary"]').text(sentence);
  const canvas = $section.find('.chart canvas').attr('aria-label', `Line chart of the balance over time. ${sentence}`)[0];
  chart.show(() => drawBalanceLines(canvas, result)).catch((error) => {
    console.error(error);
    $section.find('[data-field="chartSummary"]').text(`${sentence} (The chart couldn't load, but the table above is complete.)`);
  });
}

handleSubmit('#payoff-form', '#payoff-results', calculate, render, '/payoff');
