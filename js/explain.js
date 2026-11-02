// Plain sentences that say what the numbers mean. Kept apart from the pages so the
// wording can be tested in Node, and changed in one place.
import { FREQUENCIES } from './finance.js';
import { currencyUnit, formatDuration, formatMoney, formatNumber } from './format.js';

// A loan in one line, for receipt headers: "€10,000.00 at 5% over 5 years, monthly".
export function loanLine({ principal, annualRate, years, periodsPerYear }) {
  const term = `${formatNumber(years)} ${years === 1 ? 'year' : 'years'}`;
  const frequency = periodsPerYear === FREQUENCIES.monthly ? 'monthly' : 'every two weeks';
  return `${formatMoney(principal)} at ${formatNumber(annualRate)}% over ${term}, ${frequency}`;
}

// One sentence about loan B against loan A: the payment, the interest and the time.
// Clauses that pull the same way are joined with "and", opposite ones with "but":
// "Loan B's payment is €85.20 lower, but it costs €2,410.00 more in interest and
// takes 2 years longer."
// Payments are only compared when both loans pay equally often, because a monthly
// payment next to a bi-weekly one says nothing.
export function compareSentence({ difference }, { samePaymentFrequency = true } = {}) {
  const { payment, totalInterest, years } = difference;
  const clauses = [];

  if (samePaymentFrequency && payment !== 0) {
    clauses.push({
      better: payment < 0,
      startsWithPayment: true,
      text: `Loan B's payment is ${formatMoney(Math.abs(payment))} ${payment < 0 ? 'lower' : 'higher'}`,
    });
  }
  if (totalInterest !== 0) {
    clauses.push({
      better: totalInterest < 0,
      text: `costs ${formatMoney(Math.abs(totalInterest))} ${totalInterest < 0 ? 'less' : 'more'} in interest`,
    });
  }
  if (Math.round(years * 12) !== 0) {
    const duration = formatDuration(years);
    clauses.push({
      better: years < 0,
      text: years < 0 ? `is paid off ${duration} sooner` : `takes ${duration} longer`,
    });
  }

  if (clauses.length === 0) return 'Both loans cost the same.';

  let sentence = clauses[0].startsWithPayment ? clauses[0].text : `Loan B ${clauses[0].text}`;
  for (let i = 1; i < clauses.length; i++) {
    const joiner = clauses[i].better === clauses[i - 1].better ? ' and' : ', but';
    // After "Loan B's payment is ...", the next clause needs its own subject.
    const subject = i === 1 && clauses[0].startsWithPayment ? ' it' : '';
    sentence += `${joiner}${subject} ${clauses[i].text}`;
  }
  return `${sentence}.`;
}

// The story of the principal vs interest chart, in words, for anyone who can't see it:
// "In year 1, 81% of what you pay goes to interest. By year 30, it's 2%."
export function interestShareSentence(years) {
  const share = (year) => (year.paid > 0 ? Math.round((year.interest / year.paid) * 100) : 0);
  const first = years[0];
  const last = years.at(-1);
  if (first.interest === 0) return 'There\'s no interest, so every payment goes to the loan itself.';
  if (years.length === 1) return `Over the year, ${share(first)}% of what you pay goes to interest.`;
  return `In year 1, ${share(first)}% of what you pay goes to interest. By year ${last.year}, it's ${share(last)}%.`;
}

// The story of the balance chart: "The balance reaches zero after 15 years and 7 months
// as you pay now, and after 12 years and 4 months with the extra payment."
export function balanceSentence(nowYears, planYears, planLabel) {
  return `The balance reaches zero after ${formatDuration(nowYears)} as you pay now, `
    + `and after ${formatDuration(planYears)} ${planLabel}.`;
}

// What a payoff plan saves: "You finish 4 years and 5 months sooner and pay
// €29,420.00 less in interest."
export function payoffSentence({ yearsSaved, interestSaved }) {
  if (yearsSaved <= 0 && interestSaved <= 0) return 'This doesn\'t change anything. The loan ends at the same time.';
  return `You finish ${formatDuration(yearsSaved)} sooner and pay ${formatMoney(interestSaved)} less in interest.`;
}

// ---------------------------------------------------------------------------
// Margin notes: short handwritten asides next to a result. Each one returns null when
// it wouldn't be true for the numbers on screen, and then no note is shown.

// Calculator, next to the total interest.
export function interestNote(totalInterest) {
  return totalInterest > 0 ? 'That\'s the bank\'s fee for lending you the money. All of it on top.' : null;
}

// Calculator receipt, at year 1. Interest falls every year as the balance falls, so the
// second half always holds; the first half depends on the loan.
export function yearOneNote(years) {
  const [first] = years;
  if (years.length < 2 || first.interest === 0) return null;
  const share = Math.round((first.interest / first.paid) * 100);
  return share > 50
    ? 'Year 1 is mostly interest. It gets better.'
    : `Year 1 is ${share}% interest. Less every year after.`;
}

// Pay off faster, next to the interest saved.
export function payoffNote({ interestSaved }) {
  return interestSaved > 0 ? `Every extra ${currencyUnit()} you pay stops earning the bank interest.` : null;
}

// Compare, under the sentence: only when the loan with the lower payment is the one
// that costs more interest.
export function compareNote({ difference }, { samePaymentFrequency = true } = {}) {
  const { payment, totalInterest } = difference;
  const lowerPaymentCostsMore = (payment < 0 && totalInterest > 0) || (payment > 0 && totalInterest < 0);
  return samePaymentFrequency && lowerPaymentCostsMore ? 'The lower payment isn\'t always the cheaper loan.' : null;
}
