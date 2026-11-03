// Loan math. Pure functions: no DOM and no jQuery, so it runs (and is tested) in Node.
//
// Money is handled in whole cents inside this file. Floating point can't store 0.1
// exactly, so adding up hundreds of rows in euros drifts by fractions of a cent.
// Integers don't drift. Results go back out as ordinary amounts (188.71).

export const FREQUENCIES = { monthly: 12, biweekly: 26 };

// Upper bounds keep every loop finite and every number inside safe integer range.
// The worst case, the largest amount at 100% for 100 years, pays back about
// €1,000 billion: 1e14 cents, well under Number.MAX_SAFE_INTEGER (about 9e15).
export const LIMITS = { maxAmount: 1e10, maxRate: 100, maxYears: 100 };

// Thrown for input the math can't work with. `field` names the input at fault,
// so the page can mark that field as invalid.
export class LoanInputError extends Error {
  constructor(field, message) {
    super(message);
    this.name = 'LoanInputError';
    this.field = field;
  }
}

const toCents = (amount) => Math.round(amount * 100);
const fromCents = (cents) => cents / 100;

// ---------------------------------------------------------------------------
// Input checks

// Infinity ("1e309") is a number, just a huge one, so it gets the "too large" message
// from the checks below rather than this one.
function requireNumber(field, value) {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    throw new LoanInputError(field, 'That doesn\'t read as a number. Digits only, please.');
  }
}

function checkAmount(field, value) {
  requireNumber(field, value);
  if (value <= 0) throw new LoanInputError(field, 'The amount has to be more than zero.');
  if (toCents(value) < 1) throw new LoanInputError(field, 'The smallest amount here is one cent.');
  if (value > LIMITS.maxAmount) throw new LoanInputError(field, 'That\'s more than this ledger handles.');
}

function checkRate(value) {
  requireNumber('annualRate', value);
  if (value < 0) throw new LoanInputError('annualRate', 'A rate can\'t be below zero.');
  if (value > LIMITS.maxRate) throw new LoanInputError('annualRate', `Rates above ${LIMITS.maxRate}% aren't handled here.`);
}

function checkFrequency(periodsPerYear) {
  if (!Object.values(FREQUENCIES).includes(periodsPerYear)) {
    throw new LoanInputError('periodsPerYear', 'Pick monthly or bi-weekly payments.');
  }
}

function checkYears(years, periodsPerYear) {
  requireNumber('years', years);
  if (years > LIMITS.maxYears) throw new LoanInputError('years', `Terms over ${LIMITS.maxYears} years aren't handled here.`);
  if (Math.round(years * periodsPerYear) < 1) throw new LoanInputError('years', 'The term is too short for a single payment.');
}

function checkExtra(extra) {
  requireNumber('extra', extra);
  if (extra < 0) throw new LoanInputError('extra', 'The extra amount can\'t be below zero.');
  if (extra > LIMITS.maxAmount) throw new LoanInputError('extra', 'That\'s more than this ledger handles.');
}

// Every problem with a set of inputs at once, instead of stopping at the first, so a
// form can mark all the fields that need fixing in one go. These run the same checks
// the calculations below run.
function collect(checks) {
  const errors = [];
  for (const check of checks) {
    try {
      check();
    } catch (error) {
      if (!(error instanceof LoanInputError)) throw error;
      errors.push(error);
    }
  }
  return errors;
}

export function loanErrors(loan) {
  const { principal, annualRate, years, periodsPerYear } = loan;
  const errors = collect([
    () => checkAmount('principal', principal),
    () => checkRate(annualRate),
    () => checkFrequency(periodsPerYear),
    () => checkYears(years, periodsPerYear),
  ]);
  // Only once every field is fine on its own: is there enough to go round?
  return errors.length ? errors : collect([() => paymentInCents(loan)]);
}

// Accelerated bi-weekly has no extra amount or frequency to check.
export function payoffErrors({ balance, annualRate, payment, extra, periodsPerYear, accelerated = false }) {
  const checks = [
    () => checkAmount('balance', balance),
    () => checkRate(annualRate),
    () => checkAmount('payment', payment),
  ];
  if (!accelerated) checks.push(() => checkExtra(extra), () => checkFrequency(periodsPerYear));
  return collect(checks);
}

// ---------------------------------------------------------------------------
// Fixed-term loans

// The standard annuity formula, in cents. For principal P, rate per period r and
// n payments: A = P * r / (1 - (1 + r)^-n). With no interest it's just P / n.
function paymentInCents({ principal, annualRate, years, periodsPerYear }) {
  checkAmount('principal', principal);
  checkRate(annualRate);
  checkFrequency(periodsPerYear);
  checkYears(years, periodsPerYear);

  const r = annualRate / 100 / periodsPerYear;
  const n = Math.round(years * periodsPerYear);
  const amount = r === 0 ? principal / n : (principal * r) / (1 - (1 + r) ** -n);
  const payment = Math.round(amount * 100);
  // €1 over 100 years would be 1,200 payments of €0.00.
  if (payment < 1) throw new LoanInputError('principal', 'That\'s too little to split into this many payments.');
  return { payment, r, n };
}

// The regular payment, rounded to the cent.
export function periodicPayment(loan) {
  return fromCents(paymentInCents(loan).payment);
}

// One row per payment. Every row is rounded to the cent, and the last payment is
// whatever clears the balance, so the loan ends at exactly 0.00.
export function amortizationSchedule(loan) {
  const { payment, r, n } = paymentInCents(loan);
  let balance = toCents(loan.principal);
  const rows = [];

  for (let number = 1; number <= n && balance > 0; number++) {
    const interest = Math.round(balance * r);
    let principalPart = payment - interest;
    if (number === n || principalPart > balance) principalPart = balance;
    balance -= principalPart;
    rows.push(makeRow(number, principalPart, interest, balance));
  }
  return rows;
}

function makeRow(number, principalCents, interestCents, balanceCents) {
  return {
    number,
    payment: fromCents(principalCents + interestCents),
    principal: fromCents(principalCents),
    interest: fromCents(interestCents),
    balance: fromCents(balanceCents),
  };
}

// The schedule in years: each year's payments plus its totals and the balance left
// at the end of it. Bi-weekly loans have 26 payments to a year. A last, shorter year
// holds whatever payments are left.
export function groupByYear(schedule, periodsPerYear) {
  checkFrequency(periodsPerYear);
  const years = [];
  for (let start = 0; start < schedule.length; start += periodsPerYear) {
    const payments = schedule.slice(start, start + periodsPerYear);
    let paid = 0;
    let principal = 0;
    let interest = 0;
    for (const row of payments) {
      paid += toCents(row.payment);
      principal += toCents(row.principal);
      interest += toCents(row.interest);
    }
    years.push({
      year: years.length + 1,
      payments,
      paid: fromCents(paid),
      principal: fromCents(principal),
      interest: fromCents(interest),
      balance: payments.at(-1).balance,
    });
  }
  return years;
}

// Totals for any schedule. Summed in cents so 360 rows don't drift.
export function summarize(schedule) {
  let paid = 0;
  let interest = 0;
  for (const row of schedule) {
    paid += toCents(row.payment);
    interest += toCents(row.interest);
  }
  return { totalPaid: fromCents(paid), totalInterest: fromCents(interest), payments: schedule.length };
}

// Both loans summarized, plus how loan B differs from loan A (B minus A).
// A negative difference means B is lower.
export function compareLoans(a, b) {
  const first = describeLoan(a, 'a');
  const second = describeLoan(b, 'b');
  const minus = (key) => fromCents(toCents(second[key]) - toCents(first[key]));

  return {
    a: first,
    b: second,
    difference: {
      payment: minus('payment'),
      totalInterest: minus('totalInterest'),
      totalPaid: minus('totalPaid'),
      years: second.years - first.years,
    },
  };
}

function describeLoan(loan, key) {
  try {
    const schedule = amortizationSchedule(loan);
    return {
      payment: periodicPayment(loan),
      ...summarize(schedule),
      years: schedule.length / loan.periodsPerYear,
    };
  } catch (error) {
    // Say which loan the bad field belongs to, e.g. "b.annualRate".
    if (error instanceof LoanInputError) error.field = `${key}.${error.field}`;
    throw error;
  }
}

// ---------------------------------------------------------------------------
// Paying off an existing balance faster

// Pays a fixed amount every period until the balance is gone. Throws instead of
// looping forever when the payment doesn't cover the interest.
function payDown(balanceCents, r, paymentCents, periodsPerYear) {
  const maxPayments = LIMITS.maxYears * periodsPerYear;
  const rows = [];
  let balance = balanceCents;

  for (let number = 1; balance > 0; number++) {
    const interest = Math.round(balance * r);
    if (paymentCents <= interest) {
      throw new LoanInputError('payment', 'This payment doesn\'t cover the interest. The balance would never reach zero.');
    }
    if (number > maxPayments) {
      throw new LoanInputError('payment', `At this payment the loan would run past ${LIMITS.maxYears} years.`);
    }
    const principalPart = Math.min(paymentCents - interest, balance);
    balance -= principalPart;
    rows.push(makeRow(number, principalPart, interest, balance));
  }
  return rows;
}

function describePlan(schedule, periodsPerYear) {
  return { schedule, ...summarize(schedule), years: schedule.length / periodsPerYear };
}

// The current plan next to the same plan with `extra` added to every payment.
export function payoffWithExtra({ balance, annualRate, payment, extra, periodsPerYear }) {
  checkAmount('balance', balance);
  checkRate(annualRate);
  checkAmount('payment', payment);
  checkExtra(extra);
  checkFrequency(periodsPerYear);

  const r = annualRate / 100 / periodsPerYear;
  const original = describePlan(payDown(toCents(balance), r, toCents(payment), periodsPerYear), periodsPerYear);
  const withExtra = extra === 0
    ? original
    : describePlan(payDown(toCents(balance), r, toCents(payment + extra), periodsPerYear), periodsPerYear);

  return {
    original,
    withExtra,
    paymentsSaved: original.payments - withExtra.payments,
    yearsSaved: original.years - withExtra.years,
    interestSaved: fromCents(toCents(original.totalInterest) - toCents(withExtra.totalInterest)),
  };
}

// Accelerated bi-weekly: instead of one monthly payment, pay half of it every two
// weeks. That's 26 halves a year, so 13 monthly payments instead of 12, and the
// extra month goes straight to the principal.
export function acceleratedBiweekly({ balance, annualRate, payment }) {
  checkAmount('balance', balance);
  checkRate(annualRate);
  checkAmount('payment', payment);

  const monthlyRate = annualRate / 100 / FREQUENCIES.monthly;
  const biweeklyRate = annualRate / 100 / FREQUENCIES.biweekly;
  const monthly = describePlan(
    payDown(toCents(balance), monthlyRate, toCents(payment), FREQUENCIES.monthly),
    FREQUENCIES.monthly,
  );
  const accelerated = describePlan(
    payDown(toCents(balance), biweeklyRate, Math.round(toCents(payment) / 2), FREQUENCIES.biweekly),
    FREQUENCIES.biweekly,
  );

  return {
    monthly,
    accelerated,
    yearsSaved: monthly.years - accelerated.years,
    interestSaved: fromCents(toCents(monthly.totalInterest) - toCents(accelerated.totalInterest)),
  };
}
