// Plain sentences that say what the numbers mean. Kept apart from the pages so the
// wording can be tested in Node, and changed in one place.
import { formatDuration, formatMoney } from './format.js';

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

// What a payoff plan saves: "You finish 4 years and 5 months sooner and pay
// €29,420.00 less in interest."
export function payoffSentence({ yearsSaved, interestSaved }) {
  if (yearsSaved <= 0 && interestSaved <= 0) return 'This doesn\'t change anything. The loan ends at the same time.';
  return `You finish ${formatDuration(yearsSaved)} sooner and pay ${formatMoney(interestSaved)} less in interest.`;
}
