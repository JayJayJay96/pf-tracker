'use client';

import { type ChangeEvent, type FocusEvent, useId, useState } from 'react';

import {
  formatAmountInput,
  parseAmountInput,
  parseSignedAmountInput,
  type Sen,
} from '../../domain/money';
import { useFieldError } from './action-form';

type MoneyInputProps = {
  /** Field name submitted with the form. */
  name: string;
  /** Visible label text, e.g. "Amount". */
  label: string;
  /** Starting value for an uncontrolled field, in sen. */
  defaultSen?: Sen | null;
  /** Current value for a controlled field, as bare editable text. */
  value?: string;
  /** Required for a controlled field; receives the bare editable text. */
  onValueChange?: (value: string) => void;
  /** Server-side error for this field. Takes precedence over local parsing. */
  error?: string;
  required?: boolean;
  /** Allows a leading minus, for signed corrections such as rounding. */
  allowNegative?: boolean;
  autoFocus?: boolean;
};

function readAmount(raw: string, allowNegative: boolean) {
  return allowNegative ? parseSignedAmountInput(raw) : parseAmountInput(raw);
}

/**
 * Money entry that accepts what a person actually types.
 *
 * The `RM` prefix is rendered beside the field rather than living inside the
 * value, so a phone's decimal keypad is enough to complete the field. The value
 * is normalized to two decimals on blur. Strict `RM12.34` formatting stays
 * where it belongs, at the storage boundary in `src/domain/money.ts`.
 */
export function MoneyInput({
  name,
  label,
  defaultSen,
  value,
  onValueChange,
  error,
  required,
  allowNegative = false,
  autoFocus,
}: MoneyInputProps) {
  const generatedId = useId();
  const inputId = `${generatedId}-input`;
  const hintId = `${generatedId}-hint`;
  const errorId = `${generatedId}-error`;
  const [localError, setLocalError] = useState<string>();

  const serverError = useFieldError(name);
  const isControlled = value !== undefined;
  const message = error ?? serverError ?? localError;

  function normalize(raw: string): string | undefined {
    if (raw.trim() === '') {
      setLocalError(undefined);
      return undefined;
    }

    const result = readAmount(raw, allowNegative);
    if (!result.ok) {
      setLocalError(result.error);
      return undefined;
    }

    setLocalError(undefined);
    return formatAmountInput(result.sen);
  }

  function handleBlur(event: FocusEvent<HTMLInputElement>): void {
    const normalized = normalize(event.currentTarget.value);
    if (normalized === undefined) {
      return;
    }

    if (isControlled) {
      onValueChange?.(normalized);
      return;
    }
    event.currentTarget.value = normalized;
  }

  function handleChange(event: ChangeEvent<HTMLInputElement>): void {
    if (localError) {
      setLocalError(undefined);
    }
    onValueChange?.(event.currentTarget.value);
  }

  return (
    <div className="field">
      <label className="field-label" htmlFor={inputId}>{label}</label>
      <span className="money-field">
        <span className="money-prefix" aria-hidden="true">RM</span>
        <input
          id={inputId}
          name={name}
          type="text"
          inputMode="decimal"
          autoComplete="off"
          enterKeyHint="next"
          required={required}
          autoFocus={autoFocus}
          aria-invalid={message ? true : undefined}
          aria-describedby={message ? errorId : hintId}
          onBlur={handleBlur}
          onChange={handleChange}
          {...(isControlled
            ? { value }
            : { defaultValue: defaultSen == null ? '' : formatAmountInput(defaultSen) })}
        />
      </span>
      {message ? (
        <span className="field-error" id={errorId}>{message}</span>
      ) : (
        <span className="field-hint" id={hintId}>
          {allowNegative ? 'For example 1.50, or -0.05 to subtract' : 'For example 12.50'}
        </span>
      )}
    </div>
  );
}
