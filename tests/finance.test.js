import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  FREQUENCIES,
  LoanInputError,
  acceleratedBiweekly,
  amortizationSchedule,
  compareLoans,
  payoffWithExtra,
  periodicPayment,
  summarize,
} from '../js/finance.js';

const { monthly, biweekly } = FREQUENCIES;
const cents = (amount) => Math.round(amount * 100);

// A spread of loans the schedule checks run against.
const loans = [
  { principal: 10000, annualRate: 5, years: 5, periodsPerYear: monthly },
  { principal: 200000, annualRate: 6, years: 30, periodsPerYear: monthly },
  { principal: 10000, annualRate: 5, years: 5, periodsPerYear: biweekly },
  { principal: 350000, annualRate: 7.25, years: 50, periodsPerYear: biweekly },
  { principal: 999.99, annualRate: 19.9, years: 1, periodsPerYear: monthly },
  { principal: 10000, annualRate: 0, years: 3, periodsPerYear: monthly },
];

describe('periodicPayment', () => {
  // Reference values from the standard annuity formula, as any bank calculator
  // or a spreadsheet's PMT() gives them.
  it('matches known monthly payments', () => {
    assert.equal(periodicPayment({ principal: 10000, annualRate: 5, years: 5, periodsPerYear: monthly }), 188.71);
    assert.equal(periodicPayment({ principal: 200000, annualRate: 6, years: 30, periodsPerYear: monthly }), 1199.10);
  });

  it('uses the per-period rate for bi-weekly payments', () => {
    // PMT(5%/26, 130, -10000) = 87.0122...
    assert.equal(periodicPayment({ principal: 10000, annualRate: 5, years: 5, periodsPerYear: biweekly }), 87.01);
  });

  it('splits the principal evenly when there is no interest', () => {
    assert.equal(periodicPayment({ principal: 12000, annualRate: 0, years: 1, periodsPerYear: monthly }), 1000);
  });
});

describe('amortizationSchedule', () => {
  it('has one row per payment', () => {
    assert.equal(amortizationSchedule(loans[0]).length, 60);
    assert.equal(amortizationSchedule(loans[2]).length, 130);
    assert.equal(amortizationSchedule(loans[3]).length, 1300);
  });

  for (const loan of loans) {
    const label = `${loan.principal} at ${loan.annualRate}% over ${loan.years} years, ${loan.periodsPerYear} a year`;

    it(`ends at exactly 0: ${label}`, () => {
      const rows = amortizationSchedule(loan);
      assert.equal(rows.at(-1).balance, 0);
      assert.ok(rows.every((row) => row.balance >= 0), 'no balance goes negative');
    });

    it(`principal parts add up to the principal, to the cent: ${label}`, () => {
      const total = amortizationSchedule(loan).reduce((sum, row) => sum + cents(row.principal), 0);
      assert.equal(total, cents(loan.principal));
    });

    it(`every row is payment = principal + interest: ${label}`, () => {
      for (const row of amortizationSchedule(loan)) {
        assert.equal(cents(row.payment), cents(row.principal) + cents(row.interest));
      }
    });
  }

  it('only lets the last payment differ from the regular one', () => {
    const rows = amortizationSchedule(loans[1]);
    const regular = periodicPayment(loans[1]);
    assert.ok(rows.slice(0, -1).every((row) => row.payment === regular));
    // The exact payment is 1199.10105. Rounding drops 0.1 cent a month, and with
    // interest on top that adds up to about a euro, which the last payment carries.
    // 1200.14 checked with a separate cent-by-cent simulation in Python's Decimal.
    assert.equal(rows.at(-1).payment, 1200.14);
  });

  it('charges no interest at a zero rate', () => {
    const rows = amortizationSchedule(loans[5]);
    assert.ok(rows.every((row) => row.interest === 0));
    assert.equal(rows[0].payment, 277.78);
    assert.equal(rows.at(-1).payment, 277.70); // 10,000 - 35 x 277.78
  });
});

describe('summarize', () => {
  it('totals a known schedule', () => {
    const summary = summarize(amortizationSchedule(loans[0]));
    assert.equal(summary.payments, 60);
    // Bank calculators show 1,322.74 total interest. Per-row rounding can move it a cent.
    assert.ok(Math.abs(summary.totalInterest - 1322.74) <= 0.02, `got ${summary.totalInterest}`);
    assert.equal(cents(summary.totalPaid), cents(10000) + cents(summary.totalInterest));
  });
});

describe('compareLoans', () => {
  const a = { principal: 20000, annualRate: 6, years: 5, periodsPerYear: monthly };
  const b = { principal: 20000, annualRate: 4.5, years: 7, periodsPerYear: monthly };

  it('summarizes both loans', () => {
    const result = compareLoans(a, b);
    assert.equal(result.a.payment, periodicPayment(a));
    assert.equal(result.b.payments, 84);
    assert.equal(result.b.years, 7);
  });

  it('reports differences as B minus A', () => {
    const { a: first, b: second, difference } = compareLoans(a, b);
    assert.equal(difference.payment, Math.round((second.payment - first.payment) * 100) / 100);
    assert.equal(cents(difference.totalInterest), cents(second.totalInterest) - cents(first.totalInterest));
    assert.equal(difference.years, 2);
    assert.ok(difference.payment < 0, 'the longer, cheaper-rate loan has a lower payment');
  });

  it('says which loan has the bad input', () => {
    assert.throws(
      () => compareLoans(a, { ...b, annualRate: -1 }),
      (error) => error instanceof LoanInputError && error.field === 'b.annualRate',
    );
  });
});

describe('payoffWithExtra', () => {
  const plan = { balance: 150000, annualRate: 5.5, payment: 1200, periodsPerYear: monthly };

  it('pays off sooner and with less interest when paying extra', () => {
    const result = payoffWithExtra({ ...plan, extra: 200 });
    assert.ok(result.withExtra.payments < result.original.payments);
    assert.ok(result.withExtra.totalInterest < result.original.totalInterest);
    assert.equal(result.paymentsSaved, result.original.payments - result.withExtra.payments);
    assert.ok(result.interestSaved > 0);
  });

  it('changes nothing when the extra is zero', () => {
    const result = payoffWithExtra({ ...plan, extra: 0 });
    assert.deepEqual(result.withExtra, result.original);
    assert.equal(result.paymentsSaved, 0);
    assert.equal(result.yearsSaved, 0);
    assert.equal(result.interestSaved, 0);
  });

  it('pays the balance down to exactly 0 in both plans', () => {
    const result = payoffWithExtra({ ...plan, extra: 333.33 });
    for (const { schedule } of [result.original, result.withExtra]) {
      assert.equal(schedule.at(-1).balance, 0);
      const principal = schedule.reduce((sum, row) => sum + cents(row.principal), 0);
      assert.equal(principal, cents(plan.balance));
    }
  });

  it('follows the fixed-term schedule when given that loan\'s own payment', () => {
    const loan = loans[1];
    const result = payoffWithExtra({
      balance: loan.principal, annualRate: loan.annualRate, payment: periodicPayment(loan), extra: 0, periodsPerYear: monthly,
    });
    // Same 360 payments, except the rounding leftover (the euro the fixed-term schedule
    // adds to its last payment) is paid as a small 361st payment instead.
    const { schedule } = result.original;
    assert.equal(schedule.length, 361);
    assert.ok(schedule.at(-1).payment < 2, `last payment ${schedule.at(-1).payment}`);
  });

  it('throws when the payment doesn\'t cover the interest', () => {
    // 150,000 at 5.5% a year is 687.50 interest in the first month.
    for (const payment of [500, 687.5]) {
      assert.throws(
        () => payoffWithExtra({ ...plan, payment, extra: 0 }),
        (error) => error instanceof LoanInputError && error.field === 'payment',
      );
    }
  });

  it('throws when paying off would take longer than the limit', () => {
    // 687.51 covers the interest by one cent, so it would take centuries.
    assert.throws(
      () => payoffWithExtra({ ...plan, payment: 687.51, extra: 0 }),
      (error) => error instanceof LoanInputError && /years/.test(error.message),
    );
  });
});

describe('acceleratedBiweekly', () => {
  it('pays off a 30 year mortgage years earlier', () => {
    const loan = { principal: 200000, annualRate: 6, years: 30, periodsPerYear: monthly };
    const result = acceleratedBiweekly({ balance: 200000, annualRate: 6, payment: periodicPayment(loan) });
    assert.equal(Math.round(result.monthly.years), 30);
    assert.equal(result.accelerated.schedule[0].payment, 599.55);
    // Commonly quoted: about 4 to 6 years sooner on a 30 year loan at this rate.
    assert.ok(result.yearsSaved > 4 && result.yearsSaved < 6, `saved ${result.yearsSaved} years`);
    assert.ok(result.interestSaved > 0);
    assert.equal(result.accelerated.schedule.at(-1).balance, 0);
  });
});

describe('input checks', () => {
  const good = { principal: 10000, annualRate: 5, years: 5, periodsPerYear: monthly };
  const bad = [
    ['principal', 'not a number', { principal: Number.NaN }],
    ['principal', 'a string', { principal: '10000' }],
    ['principal', 'negative', { principal: -5 }],
    ['principal', 'zero', { principal: 0 }],
    ['principal', 'infinite (1e309)', { principal: 1e309 }],
    ['principal', 'too large', { principal: 1e13 }],
    ['annualRate', 'negative', { annualRate: -1 }],
    ['annualRate', 'above 100%', { annualRate: 101 }],
    ['years', 'zero', { years: 0 }],
    ['years', 'negative', { years: -2 }],
    ['years', 'over the limit', { years: 101 }],
    ['periodsPerYear', 'weekly', { periodsPerYear: 52 }],
  ];

  for (const [field, what, change] of bad) {
    it(`rejects ${field}: ${what}`, () => {
      assert.throws(
        () => amortizationSchedule({ ...good, ...change }),
        (error) => error instanceof LoanInputError && error.field === field,
      );
    });
  }

  it('rejects a negative extra payment', () => {
    assert.throws(
      () => payoffWithExtra({ balance: 1000, annualRate: 5, payment: 100, extra: -1, periodsPerYear: monthly }),
      (error) => error instanceof LoanInputError && error.field === 'extra',
    );
  });
});
