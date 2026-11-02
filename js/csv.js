// CSV text for the schedule and the comparison. No DOM, so it's tested in Node; the
// pages turn the text into a download.
//
// Amounts are plain numbers with two decimals and a dot (1322.74), not formatted
// money (€1,322.74), so a spreadsheet reads them as numbers in any language setting.

import { FREQUENCIES } from './finance.js';

const LINE_END = '\r\n'; // what RFC 4180 and Excel expect

// Quotes a field only when it has to: commas, quotes or line breaks inside it.
function field(value) {
  const text = String(value);
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export function toCsv(rows) {
  return rows.map((row) => row.map(field).join(',')).join(LINE_END) + LINE_END;
}

const amount = (value) => value.toFixed(2);

export function scheduleCsv(schedule, periodsPerYear) {
  const header = ['Payment', 'Year', 'Amount', 'Principal', 'Interest', 'Balance'];
  const rows = schedule.map((row) => [
    row.number,
    Math.ceil(row.number / periodsPerYear),
    amount(row.payment),
    amount(row.principal),
    amount(row.interest),
    amount(row.balance),
  ]);
  return toCsv([header, ...rows]);
}

// Like the page, it doesn't subtract a monthly payment from a bi-weekly one.
export function comparisonCsv({ a, b, difference }, { samePaymentFrequency = true } = {}) {
  const line = (label, key) => [label, amount(a[key]), amount(b[key]), amount(difference[key])];
  const payment = line('Payment', 'payment');
  if (!samePaymentFrequency) payment[3] = 'Not comparable';
  return toCsv([
    ['Detail', 'Loan A', 'Loan B', 'Difference (B minus A)'],
    payment,
    ['Number of payments', a.payments, b.payments, b.payments - a.payments],
    ['Years to pay off', a.years, b.years, difference.years],
    line('Total interest', 'totalInterest'),
    line('Total paid', 'totalPaid'),
  ]);
}

// A file name that says what's inside: schedule-10000-at-5pct-5y-monthly.csv
export function scheduleFileName({ principal, annualRate, years, periodsPerYear }) {
  const frequency = periodsPerYear === FREQUENCIES.monthly ? 'monthly' : 'biweekly';
  return `schedule-${principal}-at-${annualRate}pct-${years}y-${frequency}.csv`;
}
