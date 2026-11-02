import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { formatDuration, formatMoney, formatMoneyShort, formatNumber, parseAmount, splitMoney } from '../js/format.js';

describe('formatMoney', () => {
  it('uses English grouping with the euro sign first', () => {
    assert.equal(formatMoney(10000), '€10,000.00');
    assert.equal(formatMoney(188.71), '€188.71');
    assert.equal(formatMoney(0), '€0.00');
  });

  it('signs differences, but not zero', () => {
    assert.equal(formatMoney(1240.5, { signed: true }), '+€1,240.50');
    assert.equal(formatMoney(-85.2, { signed: true }), '-€85.20');
    assert.equal(formatMoney(0, { signed: true }), '€0.00');
  });

  it('can format another currency', () => {
    assert.equal(formatMoney(5, { currency: 'USD' }), 'US$5.00');
  });
});

describe('formatMoneyShort', () => {
  it('shortens big amounts for chart axes', () => {
    assert.equal(formatMoneyShort(2264.52), '€2.3K');
    assert.equal(formatMoneyShort(300000), '€300K');
    assert.equal(formatMoneyShort(1250000), '€1.3M');
    assert.equal(formatMoneyShort(0), '€0');
    assert.equal(formatMoneyShort(850), '€850');
  });
});

describe('splitMoney', () => {
  it('separates the currency sign from the number', () => {
    assert.deepEqual(splitMoney(2264.52), { currency: '€', number: '2,264.52' });
    assert.deepEqual(splitMoney(0), { currency: '€', number: '0.00' });
  });

  it('puts the two halves back together as formatMoney does', () => {
    for (const amount of [1, 999.99, 1234567.8]) {
      const { currency, number } = splitMoney(amount);
      assert.equal(currency + number, formatMoney(amount));
    }
  });

  it('works for another currency', () => {
    assert.deepEqual(splitMoney(5, { currency: 'USD' }), { currency: 'US$', number: '5.00' });
  });
});

describe('formatNumber', () => {
  it('groups thousands', () => {
    assert.equal(formatNumber(1300), '1,300');
  });
});

describe('formatDuration', () => {
  it('spells out years and months', () => {
    assert.equal(formatDuration(4 + 5 / 12), '4 years and 5 months');
    assert.equal(formatDuration(1), '1 year');
    assert.equal(formatDuration(1 / 12), '1 month');
    assert.equal(formatDuration(2.5), '2 years and 6 months');
  });

  it('rounds bi-weekly periods to the nearest month', () => {
    assert.equal(formatDuration(130 / 26), '5 years');
    assert.equal(formatDuration(3 / 26), '1 month'); // 6 weeks
  });

  it('says so when it is under half a month', () => {
    assert.equal(formatDuration(1 / 26), 'less than a month');
    assert.equal(formatDuration(0), 'less than a month');
  });

  it('ignores the sign', () => {
    assert.equal(formatDuration(-2), '2 years');
  });
});

describe('parseAmount', () => {
  const cases = [
    ['10000', 10000],
    ['10,000', 10000],
    ['1,234,567.89', 1234567.89],
    ['€ 10 000', 10000],
    ['10.000', 10000],
    ['10.000,50', 10000.5],
    ['5,5', 5.5],
    ['5.5', 5.5],
    ['5.5%', 5.5],
    ['.5', 0.5],
    ['-200', -200],
    ['  7  ', 7],
    ['1e309', Infinity],
  ];
  for (const [text, expected] of cases) {
    it(`reads "${text}" as ${expected}`, () => assert.equal(parseAmount(text), expected));
  }

  for (const text of ['', '   ', 'abc', '10k', '1,2,3', '0x10', '1..2', null, undefined]) {
    it(`rejects ${JSON.stringify(text)}`, () => assert.ok(Number.isNaN(parseAmount(text))));
  }
});
