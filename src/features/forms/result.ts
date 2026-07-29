/**
 * Outcome of a form submission.
 *
 * Validation failures are values, not exceptions. Throwing from a server action
 * reaches the route error boundary, which replaces the whole screen and discards
 * everything the person typed — the wrong response to a mistyped amount.
 */
export type FormFieldErrors = Record<string, string>;

export type FormResult =
  | { status: 'idle' }
  | { status: 'success'; message?: string }
  | {
    status: 'error';
    /** Summary shown once at the top of the form. */
    message: string;
    /** Keyed by form field name, so each field can render its own message. */
    fieldErrors?: FormFieldErrors;
  };

export const idleFormResult: FormResult = { status: 'idle' };

/** Builds a rejection carrying per-field messages. */
export function invalid(
  fieldErrors: FormFieldErrors,
  message = 'Check the highlighted fields.',
): FormResult {
  return { status: 'error', message, fieldErrors };
}

/** Builds a rejection that belongs to the form as a whole. */
export function failed(message: string): FormResult {
  return { status: 'error', message };
}

export function succeeded(message?: string): FormResult {
  return { status: 'success', message };
}

function isFrameworkSignal(error: unknown): boolean {
  const digest = (error as { digest?: unknown } | null)?.digest;
  return typeof digest === 'string'
    && (digest.startsWith('NEXT_REDIRECT') || digest === 'NEXT_NOT_FOUND');
}

/**
 * Wraps a server-side mutation so an unexpected failure becomes a form-level
 * message instead of a thrown error. Next.js redirect/notFound signals must
 * still propagate, so they are rethrown untouched.
 */
export async function toFormResult(
  run: () => Promise<void>,
  fallbackMessage: string,
): Promise<FormResult> {
  try {
    await run();
    return succeeded();
  } catch (error) {
    if (isFrameworkSignal(error)) {
      throw error;
    }
    return failed(error instanceof Error && error.message !== ''
      ? error.message
      : fallbackMessage);
  }
}
