// Shareable links: a calculator's inputs written into the address, and read back.
// #/calculator?amount=10000&rate=5&years=5&pay=monthly
//
// No DOM, so it's tested in Node. Each page lists its fields as
// { param in the link: field name in the form }. Payment frequencies travel as words
// (monthly, biweekly), not as the 12 and 26 the forms use inside.

const WORDS = { 12: 'monthly', 26: 'biweekly' };
const FROM_WORDS = { monthly: '12', biweekly: '26' };

const FREQUENCY_FIELDS = /periodsPerYear$/;

export const SHARE_FIELDS = {
  '/calculator': { amount: 'principal', rate: 'annualRate', years: 'years', pay: 'periodsPerYear' },
  '/compare': {
    amountA: 'a.principal', rateA: 'a.annualRate', yearsA: 'a.years', payA: 'a.periodsPerYear',
    amountB: 'b.principal', rateB: 'b.annualRate', yearsB: 'b.years', payB: 'b.periodsPerYear',
  },
  '/payoff': {
    plan: 'strategy', owe: 'balance', rate: 'annualRate', payment: 'payment', pay: 'periodsPerYear', extra: 'extra',
  },
};

// values: { fieldName: value } -> "amount=10000&rate=5&..." in the order the page lists them.
export function toQuery(values, fields) {
  const params = new URLSearchParams();
  for (const [param, field] of Object.entries(fields)) {
    if (values[field] === undefined) continue;
    const value = FREQUENCY_FIELDS.test(field) ? WORDS[values[field]] ?? values[field] : values[field];
    params.set(param, String(value));
  }
  return params.toString();
}

// URLSearchParams -> { fieldName: text for the form }. Unknown params are ignored.
// Values aren't checked here: a bad value lands in the form, and the form's own checks
// say what's wrong with it, as if it had been typed.
export function fromQuery(params, fields) {
  const values = {};
  for (const [param, field] of Object.entries(fields)) {
    if (!params.has(param)) continue;
    const value = params.get(param);
    values[field] = FREQUENCY_FIELDS.test(field) ? FROM_WORDS[value] ?? value : value;
  }
  return values;
}
