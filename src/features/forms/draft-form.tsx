'use client';

import {
  type FormEvent,
  type ReactNode,
  useEffect,
  useRef,
} from 'react';

import { clearDraft, loadDraft, saveDraft } from '../../lib/drafts';

type FormAction = (formData: FormData) => void | Promise<void>;

function formValues(form: HTMLFormElement): Record<string, string> {
  const values: Record<string, string> = {};
  new FormData(form).forEach((value, name) => {
    if (typeof value === 'string') values[name] = value;
  });
  return values;
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

export function DraftForm({
  userId,
  formId,
  action,
  children,
}: {
  userId: string;
  formId: string;
  action?: FormAction;
  children: ReactNode;
}) {
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    const values = loadDraft(window.localStorage, userId, formId);
    if (values && formRef.current) restore(formRef.current, values);
  }, [formId, userId]);

  function persist(event: FormEvent<HTMLFormElement>): void {
    saveDraft(window.localStorage, userId, formId, formValues(event.currentTarget));
  }

  async function submit(formData: FormData): Promise<void> {
    if (!action) return;
    await action(formData);
    clearDraft(window.localStorage, userId, formId);
    formRef.current?.reset();
  }

  return (
    <form ref={formRef} action={action ? submit : undefined} onInput={persist}>
      {children}
    </form>
  );
}
