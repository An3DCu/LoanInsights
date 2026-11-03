// Turning numbers into text and back. No DOM, so it's tested in Node.
//
// Everything goes through Intl.NumberFormat, the browser's built-in formatter,
// so grouping, decimals and the currency sign follow one locale everywhere.

const LOCALE = 'en-IE'; // English text with the euro first: €10,000.00

// The currency only changes how amounts look, never the math. narrowSymbol gives the
// signs people use locally: KM rather than "BAM", $ rather than "US$".
export const CURRENCIES = ['EUR', 'BAM', 'USD', 'GBP'];
let current = 'EUR';

export function setCurrency(code) {
  if (CURRENCIES.includes(code)) current = code;
  return current;
}

export function currentCurrency() {
  return current;
}

const formats = new Map();

function moneyFormat(currency, { signed = false, short = false } = {}) {
  const key = `${currency}:${signed}:${short}`;
  if (!formats.has(key)) {
    formats.set(key, new Intl.NumberFormat(LOCALE, {
      style: 'currency',
      currency,
      currencyDisplay: 'narrowSymbol',
      signDisplay: signed ? 'exceptZero' : 'auto',
      ...(short && { notation: 'compact', maximumFractionDigits: 1 }),
    }));
  }
  return formats.get(key);
}

// formatMoney(10000) -> "€10,000.00". With { signed: true } differences get a
// sign: "+€12.50", "-€12.50", "€0.00".
export function formatMoney(amount, { currency = current, signed = false } = {}) {
  return moneyFormat(currency, { signed }).format(amount);
}

// Short money for chart axes, where space is tight: €2.3K, €300K, €1.2M.
export function formatMoneyShort(amount, { currency = current } = {}) {
  return moneyFormat(currency, { short: true }).format(amount);
}

// The everyday word for one unit, for sentences like "every extra euro".
const UNIT_NAMES = { EUR: 'euro', BAM: 'mark', USD: 'dollar', GBP: 'pound' };

export function currencyUnit(currency = current) {
  return UNIT_NAMES[currency];
}

// Just the sign: "€", "KM", "$", "£". Used in labels like "Amount borrowed (€)".
export function currencySymbol(currency = current) {
  return moneyFormat(currency).formatToParts(0).find((part) => part.type === 'currency').value;
}

// The same money split up, { currency: '€', separator: '', number: '2,264.52' }, so a
// page can show the sign and the number separately (the receipt drops the sign on
// phones). separator is the space some signs need: "KM 2,264.52", but "€2,264.52".
export function splitMoney(amount, { currency = current } = {}) {
  const parts = moneyFormat(currency).formatToParts(amount);
  const signIndex = parts.findIndex((part) => part.type === 'currency');
  const next = parts[signIndex + 1];
  const separator = next?.type === 'literal' ? next.value : '';
  return {
    currency: parts[signIndex].value,
    separator,
    number: parts
      .filter((part, index) => index !== signIndex && !(separator && index === signIndex + 1))
      .map((part) => part.value)
      .join(''),
  };
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

// Reads what people actually type: "10000", "10,000.50", "€ 10 000", "KM 1.500",
// "5,5" or "10.000,50". Returns NaN for anything that isn't a number, and leaves the range
// checks to finance.js.
export function parseAmount(text) {
  const value = cleanNumber(text, /[\s€$£%]|KM/gi);
  if (value === null) return Number.NaN;

  // 10,000 or 1,234,567.89: commas group thousands. A group never starts with 0, so
  // "0,001" is a decimal.
  if (/^-?[1-9]\d{0,2}(,\d{3})+(\.\d+)?$/.test(value)) return Number(value.replaceAll(',', ''));
  // 10.000 or 10.000,50: dots group thousands, the comma is the decimal point.
  if (/^-?[1-9]\d{0,2}(\.\d{3})+(,\d+)?$/.test(value)) return Number(value.replaceAll('.', '').replace(',', '.'));
  return parsePlain(value);
}

// Rates and terms: nobody writes thousands in them, so a single dot or comma is
// always the decimal point. "6.125" is a mortgage rate, not 6,125%.
export function parseDecimal(text) {
  const value = cleanNumber(text, /[\s%]/g);
  return value === null ? Number.NaN : parsePlain(value);
}

// The text without the signs and spaces people type around a number, or null when
// there's nothing left, or too much: no number here needs more than 40 characters,
// and refusing longer text keeps a huge paste from tying up the patterns below.
function cleanNumber(text, ignore) {
  const raw = String(text ?? '');
  if (raw.length > 40) return null;
  const value = raw.replace(ignore, '');
  return value === '' ? null : value;
}

// 5,5: a lone comma is a decimal point. Otherwise plain numbers, exponents included;
// "1e309" becomes Infinity, which finance.js turns away as too large. Number() alone
// would also accept hex like "0x10", so check the shape first.
function parsePlain(value) {
  if (/^-?\d+,\d+$/.test(value)) return Number(value.replace(',', '.'));
  return /^-?(\d+\.?\d*|\.\d+)(e[+-]?\d+)?$/i.test(value) ? Number(value) : Number.NaN;
}
