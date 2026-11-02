import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { SHARE_FIELDS, fromQuery, toQuery } from '../js/share.js';

const calculator = SHARE_FIELDS['/calculator'];

describe('toQuery', () => {
  it('writes the fields in order, with frequencies as words', () => {
    assert.equal(
      toQuery({ principal: 10000, annualRate: 5, years: 5, periodsPerYear: 12 }, calculator),
      'amount=10000&rate=5&years=5&pay=monthly',
    );
    assert.equal(toQuery({ principal: 2500.5, annualRate: 7.25, years: 3, periodsPerYear: 26 }, calculator),
      'amount=2500.5&rate=7.25&years=3&pay=biweekly');
  });

  it('leaves out fields that have no value', () => {
    assert.equal(toQuery({ principal: 10000 }, calculator), 'amount=10000');
  });

  it('handles both loans on Compare', () => {
    const query = toQuery({
      'a.principal': 20000, 'a.annualRate': 6, 'a.years': 5, 'a.periodsPerYear': 12,
      'b.principal': 20000, 'b.annualRate': 4.5, 'b.years': 7, 'b.periodsPerYear': 26,
    }, SHARE_FIELDS['/compare']);
    assert.equal(query, 'amountA=20000&rateA=6&yearsA=5&payA=monthly&amountB=20000&rateB=4.5&yearsB=7&payB=biweekly');
  });
});

describe('fromQuery', () => {
  it('reads a link back into form values', () => {
    assert.deepEqual(fromQuery(new URLSearchParams('amount=10000&rate=5&years=5&pay=monthly'), calculator),
      { principal: '10000', annualRate: '5', years: '5', periodsPerYear: '12' });
  });

  it('round-trips with toQuery', () => {
    const values = { balance: 150000, annualRate: 5.5, payment: 1200, periodsPerYear: 26, extra: 200, strategy: 'extra' };
    const back = fromQuery(new URLSearchParams(toQuery(values, SHARE_FIELDS['/payoff'])), SHARE_FIELDS['/payoff']);
    assert.deepEqual(back, { strategy: 'extra', balance: '150000', annualRate: '5.5', payment: '1200', periodsPerYear: '26', extra: '200' });
  });

  it('ignores params it does not know', () => {
    assert.deepEqual(fromQuery(new URLSearchParams('amount=1&evil=<script>'), calculator), { principal: '1' });
  });

  it('passes bad values through, for the form to reject', () => {
    assert.deepEqual(fromQuery(new URLSearchParams('amount=abc&pay=weekly'), calculator),
      { principal: 'abc', periodsPerYear: 'weekly' });
  });
});
