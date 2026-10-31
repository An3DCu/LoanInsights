import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { compareSentence, payoffSentence } from '../js/explain.js';
import { FREQUENCIES, compareLoans, payoffWithExtra } from '../js/finance.js';

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
