// Turning numbers into text and back. No DOM, so it's tested in Node.
//
// Everything goes through Intl.NumberFormat, the browser's built-in formatter,
// so grouping, decimals and the currency sign follow one locale everywhere.

const LOCALE = 'en-IE'; // English text with the euro: €10,000.00
const DEFAULT_CURRENCY = 'EUR';

const moneyFormats = new Map();

function moneyFormat(currency, signed) {
  const key = `${currency}:${signed}`;
  if (!moneyFormats.has(key)) {
    moneyFormats.set(key, new Intl.NumberFormat(LOCALE, {
      style: 'currency',
      currency,
      signDisplay: signed ? 'exceptZero' : 'auto',
    }));
  }
  return moneyFormats.get(key);
}

// formatMoney(10000) -> "€10,000.00". With { signed: true } differences get a
// sign: "+€12.50", "-€12.50", "€0.00".
export function formatMoney(amount, { currency = DEFAULT_CURRENCY, signed = false } = {}) {
  return moneyFormat(currency, signed).format(amount);
}

const numberFormat = new Intl.NumberFormat(LOCALE);

export function formatNumber(value) {
  return numberFormat.format(value);
}

// A length of time in years (fractions allowed) as words: "4 years and 5 months".
export function formatDuration(years) {
  const months = Math.round(Math.abs(years) * 12);
  if (months === 0) return 'less than a month';

  const whole = Math.floor(months / 12);
  const rest = months % 12;
  const parts = [];
  if (whole) parts.push(`${whole} ${whole === 1 ? 'year' : 'years'}`);
  if (rest) parts.push(`${rest} ${rest === 1 ? 'month' : 'months'}`);
  return parts.join(' and ');
}

// Reads what people actually type: "10000", "10,000.50", "€ 10 000", "5,5" or
// "10.000,50". Returns NaN for anything that isn't a number, and leaves the range
// checks to finance.js.
export function parseAmount(text) {
  const value = String(text ?? '').replace(/[\s€%]/g, '');
  if (value === '') return Number.NaN;

  // 10,000 or 1,234,567.89: commas group thousands.
  if (/^-?\d{1,3}(,\d{3})+(\.\d+)?$/.test(value)) return Number(value.replaceAll(',', ''));
  // 10.000 or 10.000,50: dots group thousands, the comma is the decimal point.
  if (/^-?\d{1,3}(\.\d{3})+(,\d+)?$/.test(value)) return Number(value.replaceAll('.', '').replace(',', '.'));
  // 5,5: a lone comma is a decimal point.
  if (/^-?\d+,\d+$/.test(value)) return Number(value.replace(',', '.'));

  // Plain numbers, exponents included. "1e309" becomes Infinity, which finance.js
  // rejects. Number() alone would also accept hex like "0x10", so check the shape first.
  return /^-?(\d+\.?\d*|\.\d+)(e[+-]?\d+)?$/i.test(value) ? Number(value) : Number.NaN;
}
