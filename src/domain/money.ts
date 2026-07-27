/** Malaysian Ringgit amounts are stored as an exact, safe integer number of sen. */
export type Sen = number;

const RM_AMOUNT = /^RM(?:0|[1-9]\d*)\.\d{2}$/;

function assertNonnegativeSen(amount: Sen): void {
  if (!Number.isSafeInteger(amount) || amount < 0) {
    throw new Error('Sen amount must be a nonnegative integer');
  }
}

/** Parses a strict nonnegative `RM12.34` value into sen. */
export function parseRM(value: string): Sen {
  if (!RM_AMOUNT.test(value)) {
    throw new Error('Invalid RM amount');
  }

  const [ringgit, sen] = value.slice(2).split('.');
  const amount = Number(ringgit) * 100 + Number(sen);
  assertNonnegativeSen(amount);
  return amount;
}

/** Formats a nonnegative sen amount as a strict RM value. */
export function formatRM(amount: Sen): string {
  assertNonnegativeSen(amount);
  const ringgit = Math.floor(amount / 100);
  const sen = String(amount % 100).padStart(2, '0');
  return `RM${ringgit}.${sen}`;
}

/** Adds two nonnegative sen amounts, rejecting unsafe totals. */
export function addSen(left: Sen, right: Sen): Sen {
  assertNonnegativeSen(left);
  assertNonnegativeSen(right);
  const total = left + right;
  assertNonnegativeSen(total);
  return total;
}

/** Subtracts one nonnegative sen amount from another; the result may be negative. */
export function subtractSen(minuend: Sen, subtrahend: Sen): Sen {
  assertNonnegativeSen(minuend);
  assertNonnegativeSen(subtrahend);
  return minuend - subtrahend;
}
