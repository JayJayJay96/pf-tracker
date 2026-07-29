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

/**
 * Result of reading a human-typed amount. `parseRM` above stays the strict
 * storage contract; the helpers below are the lenient boundary between a
 * person's keystrokes and that contract, so the UI never asks anyone to type
 * the `RM` prefix or pad their own decimals.
 */
export type AmountInputResult =
  | { ok: true; sen: Sen }
  | { ok: false; error: string };

const NUMERIC_AMOUNT = /^(?:\d+(?:\.\d*)?|\.\d+)$/;

function stripPrefixAndSeparators(value: string): string {
  const trimmed = value.trim();
  const withoutPrefix = trimmed.toLowerCase().startsWith('rm')
    ? trimmed.slice(2).trim()
    : trimmed;
  return withoutPrefix.replace(/,/g, '');
}

/**
 * Reads an amount the way a person types it: `5`, `5.5`, `12.50`, `.5`, `5.`,
 * `1,250.75`, `RM12.50`, `rm 12.50`, with surrounding whitespace. Returns sen,
 * or a message addressed to the person who typed it.
 */
export function parseAmountInput(value: string): AmountInputResult {
  const candidate = stripPrefixAndSeparators(value);

  if (candidate === '') {
    return { ok: false, error: 'Enter an amount' };
  }
  if (!NUMERIC_AMOUNT.test(candidate)) {
    return { ok: false, error: 'Enter a number, like 12.50' };
  }

  const [whole, fraction = ''] = candidate.split('.');
  if (fraction.length > 2) {
    return { ok: false, error: 'Use at most 2 decimal places, like 12.50' };
  }

  const ringgit = whole === '' ? 0 : Number(whole);
  const total = ringgit * 100 + Number(fraction.padEnd(2, '0'));

  if (!Number.isSafeInteger(total)) {
    return { ok: false, error: 'That amount is too large' };
  }

  return { ok: true, sen: total };
}

/**
 * Reads an amount allowed to be negative, for signed corrections such as a
 * rounding adjustment. An explicit `+` is accepted and ignored.
 */
export function parseSignedAmountInput(value: string): AmountInputResult {
  const trimmed = value.trim();
  const negative = trimmed.startsWith('-');
  const unsigned = negative || trimmed.startsWith('+') ? trimmed.slice(1) : trimmed;
  const result = parseAmountInput(unsigned);

  if (!result.ok) {
    return result;
  }
  return { ok: true, sen: negative ? -result.sen : result.sen };
}

/** Rejection of a human-typed amount, carrying a message written for that person. */
export class AmountInputError extends Error {}

/** Reads a typed amount, raising the user-facing message on rejection. */
export function requireAmountInput(value: string): Sen {
  const result = parseAmountInput(value);
  if (!result.ok) {
    throw new AmountInputError(result.error);
  }
  return result.sen;
}

/** Reads a typed amount that may be negative, raising the user-facing message. */
export function requireSignedAmountInput(value: string): Sen {
  const result = parseSignedAmountInput(value);
  if (!result.ok) {
    throw new AmountInputError(result.error);
  }
  return result.sen;
}

/** Formats sen as a bare editable value (`12.50`), without the RM prefix. */
export function formatAmountInput(amount: Sen): string {
  const magnitude = Math.abs(amount);
  assertNonnegativeSen(magnitude);
  const ringgit = Math.floor(magnitude / 100);
  const sen = String(magnitude % 100).padStart(2, '0');
  return `${amount < 0 ? '-' : ''}${ringgit}.${sen}`;
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
