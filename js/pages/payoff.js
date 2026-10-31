// Pay off faster page: the current plan next to either an extra payment or
// accelerated bi-weekly payments.
import { payoffSentence } from '../explain.js';
import { acceleratedBiweekly, payoffWithExtra } from '../finance.js';
import { formatDuration, formatMoney, formatNumber } from '../format.js';
import { handleSubmit, readNumber } from './forms.js';

const strategyOf = ($form) => $form.find('[name="strategy"]:checked').val();

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
    return { now: result.monthly, plan: result.accelerated, planHeading: 'Accelerated bi-weekly', ...result };
  }

  const result = payoffWithExtra({
    balance,
    annualRate,
    payment,
    extra: readNumber($form, 'extra'),
    periodsPerYear: readNumber($form, 'periodsPerYear'),
  });
  return { now: result.original, plan: result.withExtra, planHeading: 'With extra', ...result };
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
}

handleSubmit('#payoff-form', '#payoff-results', calculate, render);
