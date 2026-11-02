import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  balanceSentence,
  compareNote,
  compareSentence,
  interestNote,
  interestShareSentence,
  loanLine,
  payoffNote,
  payoffSentence,
  yearOneNote,
} from '../js/explain.js';
import { setCurrency } from '../js/format.js';
import { FREQUENCIES, amortizationSchedule, compareLoans, groupByYear, payoffWithExtra } from '../js/finance.js';

const diff = (payment, totalInterest, years) => ({ difference: { payment, totalInterest, years } });

describe('compareSentence', () => {
  it('uses "but" when the payment and the cost pull different ways', () => {
    assert.equal(
      compareSentence(diff(-85.2, 2410, 2)),
      'Loan B\'s payment is €85.20 lower, but it costs €2,410.00 more in interest and takes 2 years longer.',
    );
  });

  it('uses "and" when everything points the same way', () => {
    assert.equal(
      compareSentence(diff(-20, -300, 0)),
      'Loan B\'s payment is €20.00 lower and it costs €300.00 less in interest.',
    );
  });

  it('starts with "Loan B" when the payments are equal', () => {
    assert.equal(
      compareSentence(diff(0, -1240.5, 2)),
      'Loan B costs €1,240.50 less in interest, but takes 2 years longer.',
    );
  });

  it('leaves the payment out when the loans pay at different frequencies', () => {
    assert.equal(
      compareSentence(diff(-100, 50, 0), { samePaymentFrequency: false }),
      'Loan B costs €50.00 more in interest.',
    );
  });

  it('mentions a shorter term', () => {
    assert.equal(
      compareSentence(diff(150, -900, -1.5)),
      'Loan B\'s payment is €150.00 higher, but it costs €900.00 less in interest and is paid off 1 year and 6 months sooner.',
    );
  });

  it('says when the loans are the same', () => {
    assert.equal(compareSentence(diff(0, 0, 0)), 'Both loans cost the same.');
  });

  it('works on a real comparison', () => {
    const a = { principal: 20000, annualRate: 6, years: 5, periodsPerYear: FREQUENCIES.monthly };
    const b = { principal: 20000, annualRate: 4.5, years: 7, periodsPerYear: FREQUENCIES.monthly };
    const sentence = compareSentence(compareLoans(a, b));
    assert.match(sentence, /^Loan B's payment is €[\d,.]+ lower, but it costs €[\d,.]+ (more|less) in interest/);
    assert.match(sentence, /takes 2 years longer\.$/);
  });
});

describe('interestShareSentence', () => {
  const yearsOf = (loan) => groupByYear(amortizationSchedule(loan), loan.periodsPerYear);

  it('compares the first and the last year', () => {
    const years = yearsOf({ principal: 200000, annualRate: 6, years: 30, periodsPerYear: FREQUENCIES.monthly });
    // Checked with a separate cent-by-cent Python Decimal run: year 1 is 11,933.19 interest
    // of 14,389.20 paid (82.9%), year 30 is 457.01 of 14,390.24 (3.2%).
    assert.equal(interestShareSentence(years), 'In year 1, 83% of what you pay goes to interest. By year 30, it\'s 3%.');
  });

  it('handles a one year loan', () => {
    const years = yearsOf({ principal: 1200, annualRate: 10, years: 1, periodsPerYear: FREQUENCIES.monthly });
    assert.match(interestShareSentence(years), /^Over the year, \d+% of what you pay goes to interest\.$/);
  });

  it('handles a loan without interest', () => {
    const years = yearsOf({ principal: 1200, annualRate: 0, years: 2, periodsPerYear: FREQUENCIES.monthly });
    assert.equal(interestShareSentence(years), 'There\'s no interest, so every payment goes to the loan itself.');
  });
});

describe('balanceSentence', () => {
  it('names both plans', () => {
    assert.equal(
      balanceSentence(15 + 7 / 12, 12 + 4 / 12, 'with the extra payment'),
      'The balance reaches zero after 15 years and 7 months as you pay now, and after 12 years and 4 months with the extra payment.',
    );
  });
});

describe('payoffSentence', () => {
  it('says how much sooner and how much less', () => {
    assert.equal(
      payoffSentence({ yearsSaved: 4 + 5 / 12, interestSaved: 29420 }),
      'You finish 4 years and 5 months sooner and pay €29,420.00 less in interest.',
    );
  });

  it('says when nothing changes', () => {
    const result = payoffWithExtra({ balance: 1000, annualRate: 5, payment: 100, extra: 0, periodsPerYear: 12 });
    assert.equal(payoffSentence(result), 'This doesn\'t change anything. The loan ends at the same time.');
  });
});

describe('margin notes', () => {
  const yearsOf = (loan) => groupByYear(amortizationSchedule(loan), loan.periodsPerYear);
  const { monthly } = FREQUENCIES;

  it('interestNote only shows when there is interest', () => {
    assert.match(interestNote(1322.74), /bank's fee/);
    assert.equal(interestNote(0), null);
  });

  it('yearOneNote says "mostly interest" only when it is', () => {
    assert.equal(yearOneNote(yearsOf({ principal: 200000, annualRate: 6, years: 30, periodsPerYear: monthly })),
      'Year 1 is mostly interest. It gets better.');
    assert.equal(yearOneNote(yearsOf({ principal: 10000, annualRate: 5, years: 5, periodsPerYear: monthly })),
      'Year 1 is 20% interest. Less every year after.');
  });

  it('yearOneNote stays quiet for one year loans and zero interest', () => {
    assert.equal(yearOneNote(yearsOf({ principal: 1200, annualRate: 10, years: 1, periodsPerYear: monthly })), null);
    assert.equal(yearOneNote(yearsOf({ principal: 1200, annualRate: 0, years: 3, periodsPerYear: monthly })), null);
  });

  it('payoffNote names the current currency\'s unit, and needs a saving', () => {
    assert.equal(payoffNote({ interestSaved: 100 }), 'Every extra euro you pay stops earning the bank interest.');
    setCurrency('BAM');
    try {
      assert.equal(payoffNote({ interestSaved: 100 }), 'Every extra mark you pay stops earning the bank interest.');
    } finally {
      setCurrency('EUR');
    }
    assert.equal(payoffNote({ interestSaved: 0 }), null);
  });

  it('compareNote only appears when the lower payment costs more', () => {
    const note = 'The lower payment isn\'t always the cheaper loan.';
    assert.equal(compareNote(diff(-85, 2410, 2)), note);
    assert.equal(compareNote(diff(85, -2410, -2)), note);
    assert.equal(compareNote(diff(-20, -300, 0)), null);
    assert.equal(compareNote(diff(-85, 2410, 2), { samePaymentFrequency: false }), null);
  });
});

describe('loanLine', () => {
  it('describes a loan in one line', () => {
    assert.equal(loanLine({ principal: 10000, annualRate: 5, years: 5, periodsPerYear: FREQUENCIES.monthly }),
      '€10,000.00 at 5% over 5 years, monthly');
    assert.equal(loanLine({ principal: 15000, annualRate: 6.25, years: 1, periodsPerYear: FREQUENCIES.biweekly }),
      '€15,000.00 at 6.25% over 1 year, every two weeks');
  });
});
