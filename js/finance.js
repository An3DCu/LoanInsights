// Loan math. Pure functions: no DOM and no jQuery, so it runs (and is tested) in Node.
//
// Money is handled in whole cents inside this file. Floating point can't store 0.1
// exactly, so adding up hundreds of rows in euros drifts by fractions of a cent.
// Integers don't drift. Results go back out as ordinary amounts (188.71).

export const FREQUENCIES = { monthly: 12, biweekly: 26 };

// Upper bounds keep every loop finite and every number inside safe integer range.
export const LIMITS = { maxAmount: 1e12, maxRate: 100, maxYears: 100 };

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

function requireNumber(field, value) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new LoanInputError(field, 'Enter a number.');
  }
}

function checkAmount(field, value) {
  requireNumber(field, value);
  if (value <= 0) throw new LoanInputError(field, 'Enter an amount above zero.');
  if (value > LIMITS.maxAmount) throw new LoanInputError(field, 'That amount is too large.');
}

function checkRate(value) {
  requireNumber('annualRate', value);
  if (value < 0) throw new LoanInputError('annualRate', 'The rate can\'t be negative.');
  if (value > LIMITS.maxRate) throw new LoanInputError('annualRate', `The rate can't be above ${LIMITS.maxRate}%.`);
}

function checkFrequency(periodsPerYear) {
  if (!Object.values(FREQUENCIES).includes(periodsPerYear)) {
    throw new LoanInputError('periodsPerYear', 'Choose monthly or bi-weekly payments.');
  }
}

function checkYears(years, periodsPerYear) {
  requireNumber('years', years);
  if (years > LIMITS.maxYears) throw new LoanInputError('years', `The term can't be longer than ${LIMITS.maxYears} years.`);
  if (Math.round(years * periodsPerYear) < 1) throw new LoanInputError('years', 'The term is too short for even one payment.');
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
  return { payment: Math.round(amount * 100), r, n };
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
      throw new LoanInputError('payment', 'This payment doesn\'t cover the interest, so the loan would never be paid off.');
    }
    if (number > maxPayments) {
      throw new LoanInputError('payment', `At this payment the loan takes more than ${LIMITS.maxYears} years to pay off.`);
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
  requireNumber('extra', extra);
  if (extra < 0) throw new LoanInputError('extra', 'The extra payment can\'t be negative.');
  if (extra > LIMITS.maxAmount) throw new LoanInputError('extra', 'That amount is too large.');
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
