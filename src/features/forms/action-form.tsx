'use client';

import {
  createContext,
  type FormEvent,
  type ReactNode,
  useActionState,
  useContext,
  useEffect,
  useRef,
} from 'react';

import { clearDraft, loadDraft, saveDraft } from '../../lib/drafts';
import { type FormFieldErrors, type FormResult, idleFormResult } from './result';

type ServerFormAction = (
  previous: FormResult,
  formData: FormData,
) => Promise<FormResult>;

const FieldErrorContext = createContext<FormFieldErrors>({});

/** Reads the server-side error for a field, by its form field name. */
export function useFieldError(name: string | undefined): string | undefined {
  const errors = useContext(FieldErrorContext);
  return name ? errors[name] : undefined;
}

function formValues(form: HTMLFormElement): Record<string, string> {
  const values: Record<string, string> = {};
  new FormData(form).forEach((value, name) => {
    if (typeof value === 'string') values[name] = value;
  });
  return values;
}

function clear(form: HTMLFormElement, names: string[]): void {
  for (const name of names) {
    const field = form.elements.namedItem(name);
    if (
      field instanceof HTMLInputElement
      || field instanceof HTMLTextAreaElement
    ) {
      field.value = '';
    }
  }
}

function restore(form: HTMLFormElement, values: Record<string, string>): void {
  for (const [name, value] of Object.entries(values)) {
    const field = form.elements.namedItem(name);
    if (
      field instanceof HTMLInputElement
      || field instanceof HTMLSelectElement
      || field instanceof HTMLTextAreaElement
    ) {
      field.value = value;
    }
  }
}

/**
 * Form that reports validation failures in place instead of throwing.
 *
 * Field-level messages reach each input through context, keyed by field name, so
 * a rejected submission keeps every value the person already typed. Unsaved
 * values are mirrored to local storage when `userId` and `formId` are given, and
 * cleared once the submission succeeds.
 */
export function ActionForm({
  action,
  children,
  userId,
  formId,
  resetOnSuccess = true,
  clearOnSuccess,
  keepOnSuccess,
  successMessage,
}: {
  action?: ServerFormAction;
  children: ReactNode;
  /** Enables draft persistence together with `formId`. */
  userId?: string;
  formId?: string;
  resetOnSuccess?: boolean;
  /**
   * Field names to clear on success, instead of resetting the whole form.
   *
   * `form.reset()` restores the values rendered when the page loaded, which
   * would discard a sticky choice such as the category just used. Naming the
   * fields to clear keeps everything else as the person left it, so recording a
   * second expense starts from the first one.
   */
  clearOnSuccess?: string[];
  /**
   * Field names whose value should survive a submission.
   *
   * React resets a form once its action resolves - a real `reset` event, measured
   * rather than assumed. For the fields being cleared anyway that is invisible,
   * which is why it went unnoticed. For a remembered choice it is not: picking
   * Food, saving, and finding "Select category" again is worse than never
   * remembering, because the form looks ready when it is not.
   *
   * `defaultValue` cannot cover it. The remembered category is derived from the
   * most recent expense, so on a first visit there is nothing to default to, and
   * the reset returns the field to exactly that empty default.
   */
  keepOnSuccess?: string[];
  successMessage?: string;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [result, submit, isPending] = useActionState(
    action ?? (async () => idleFormResult),
    idleFormResult,
  );
  const draftUserId = userId;
  const draftFormId = formId;
  const persistsDraft = draftUserId !== undefined && draftFormId !== undefined;
  // Joined so the effect below depends on a stable value, not a fresh array.
  const clearFields = clearOnSuccess?.join(',');
  const keepFields = keepOnSuccess?.join(',');
  const kept = useRef<Record<string, string>>({});

  useEffect(() => {
    if (draftUserId === undefined || draftFormId === undefined) return;
    const form = formRef.current;
    if (!form) return;
    const values = loadDraft(window.localStorage, draftUserId, draftFormId);
    if (values) restore(form, values);
  }, [draftFormId, draftUserId]);

  useEffect(() => {
    if (result.status !== 'success') return;
    if (draftUserId !== undefined && draftFormId !== undefined) {
      clearDraft(window.localStorage, draftUserId, draftFormId);
    }
    const form = formRef.current;
    if (!form) return;
    if (clearFields !== undefined) {
      clear(form, clearFields.split(','));
      return;
    }
    if (resetOnSuccess) form.reset();
  }, [clearFields, draftFormId, draftUserId, resetOnSuccess, result]);

  /*
   * Puts the kept fields back after the reset.
   *
   * The values are read from the form as they are typed, because by the time the
   * reset happens the form no longer holds them. Restoring has to be deferred: a
   * `reset` event fires *before* the controls are cleared, so assigning inside the
   * handler would simply be overwritten. A microtask lands just after.
   */
  function restoreKept(event: FormEvent<HTMLFormElement>): void {
    if (keepFields === undefined) return;
    const form = event.currentTarget;
    const values = { ...kept.current };
    queueMicrotask(() => restore(form, values));
  }

  function remember(form: HTMLFormElement): void {
    if (keepFields === undefined) return;
    for (const name of keepFields.split(',')) {
      const field = form.elements.namedItem(name);
      if (
        field instanceof HTMLInputElement
        || field instanceof HTMLSelectElement
        || field instanceof HTMLTextAreaElement
      ) {
        kept.current[name] = field.value;
      }
    }
  }

  function persist(event: FormEvent<HTMLFormElement>): void {
    remember(event.currentTarget);
    if (draftUserId === undefined || draftFormId === undefined) return;
    saveDraft(
      window.localStorage,
      draftUserId,
      draftFormId,
      formValues(event.currentTarget),
    );
  }

  const fieldErrors = result.status === 'error' ? result.fieldErrors ?? {} : {};
  const notice = result.status === 'success'
    ? successMessage ?? result.message
    : undefined;

  return (
    <FieldErrorContext.Provider value={fieldErrors}>
      {/*
        Native validation stays on: `required` gives instant feedback, and the
        misleading RM `pattern` that made those messages useless is gone. The
        server remains the authority and reports through `fieldErrors`.
      */}
      {/*
        The form owns its own layout. It previously relied on a global `form` rule
        that only applied inside one route group, so the same form was laid out or
        not depending on where it was rendered. auto-fit stops a one-field form
        from stretching a lone control across the whole width.

        The row gap is wider than the column gap on purpose: a field's validation
        message is positioned into that gap rather than taking part in the layout,
        so the gap has to be tall enough to hold one line of it.
      */}
      <form
        className="grid items-end gap-x-3 gap-y-6 [grid-template-columns:repeat(auto-fit,minmax(220px,1fr))]"
        ref={formRef}
        action={submit}
        onInput={persistsDraft || keepFields !== undefined ? persist : undefined}
        onReset={keepFields !== undefined ? restoreKept : undefined}
      >
        <div aria-live="polite" className="form-status">
          {result.status === 'error' ? (
            <p className="form-error-summary">{result.message}</p>
          ) : null}
          {notice ? <p className="form-success-summary">{notice}</p> : null}
          {isPending ? <p className="field-hint">Saving…</p> : null}
        </div>
        {children}
      </form>
    </FieldErrorContext.Provider>
  );
}
