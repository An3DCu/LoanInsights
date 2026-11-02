import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { comparisonCsv, scheduleCsv, scheduleFileName, toCsv } from '../js/csv.js';
import { FREQUENCIES, amortizationSchedule, compareLoans } from '../js/finance.js';

const { monthly, biweekly } = FREQUENCIES;
const lines = (text) => text.trimEnd().split('\r\n');

describe('toCsv', () => {
  it('joins fields with commas and ends every line with CRLF', () => {
    assert.equal(toCsv([['a', 1], ['b', 2]]), 'a,1\r\nb,2\r\n');
  });

  it('quotes fields with commas, quotes or line breaks', () => {
    assert.equal(toCsv([['B minus A, roughly', 'say "hi"', 'two\nlines', 'plain']]),
      '"B minus A, roughly","say ""hi""","two\nlines",plain\r\n');
  });
});

describe('scheduleCsv', () => {
  const loan = { principal: 10000, annualRate: 5, years: 5, periodsPerYear: monthly };
  const rows = lines(scheduleCsv(amortizationSchedule(loan), monthly));

  it('has a header and one line per payment', () => {
    assert.equal(rows[0], 'Payment,Year,Amount,Principal,Interest,Balance');
    assert.equal(rows.length, 61);
  });

  it('writes plain numbers with two decimals', () => {
    assert.equal(rows[1], '1,1,188.71,147.04,41.67,9852.96');
    assert.match(rows.at(-1), /^60,5,[\d.]+,[\d.]+,[\d.]+,0\.00$/);
  });

  it('numbers the years from the payment number', () => {
    const biweeklyRows = lines(scheduleCsv(amortizationSchedule({ ...loan, periodsPerYear: biweekly }), biweekly));
    assert.match(biweeklyRows[26], /^26,1,/);
    assert.match(biweeklyRows[27], /^27,2,/);
  });
});

describe('comparisonCsv', () => {
  it('has one line per detail, with B minus A', () => {
    const a = { principal: 20000, annualRate: 6, years: 5, periodsPerYear: monthly };
    const b = { principal: 20000, annualRate: 4.5, years: 7, periodsPerYear: monthly };
    const rows = lines(comparisonCsv(compareLoans(a, b)));
    assert.equal(rows[0], 'Detail,Loan A,Loan B,Difference (B minus A)');
    assert.equal(rows.length, 6);
    assert.equal(rows[1], 'Payment,386.66,278.00,-108.66');
    assert.equal(rows[2], 'Number of payments,60,84,24');
    assert.equal(rows[3], 'Years to pay off,5,7,2');
  });

  it('does not subtract payments made at different frequencies', () => {
    const a = { principal: 20000, annualRate: 6, years: 5, periodsPerYear: monthly };
    const b = { ...a, periodsPerYear: biweekly };
    const rows = lines(comparisonCsv(compareLoans(a, b), { samePaymentFrequency: false }));
    assert.match(rows[1], /^Payment,386\.66,[\d.]+,Not comparable$/);
  });
});

describe('scheduleFileName', () => {
  it('says what is inside', () => {
    assert.equal(scheduleFileName({ principal: 10000, annualRate: 5, years: 5, periodsPerYear: monthly }),
      'schedule-10000-at-5pct-5y-monthly.csv');
    assert.equal(scheduleFileName({ principal: 2500.5, annualRate: 7.25, years: 3, periodsPerYear: biweekly }),
      'schedule-2500.5-at-7.25pct-3y-biweekly.csv');
  });
});
