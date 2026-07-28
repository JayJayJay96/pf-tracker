export type DraftValues = Record<string, string>;

export type DraftStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

const DRAFT_VERSION = 1;

export function draftKey(userId: string, formId: string): string {
  return `pf-tracker:draft:v${DRAFT_VERSION}:${encodeURIComponent(userId)}:${encodeURIComponent(formId)}`;
}

export function saveDraft(
  storage: DraftStorage,
  userId: string,
  formId: string,
  values: DraftValues,
): void {
  storage.setItem(draftKey(userId, formId), JSON.stringify({
    version: DRAFT_VERSION,
    values,
  }));
}

export function loadDraft(
  storage: DraftStorage,
  userId: string,
  formId: string,
): DraftValues | null {
  const key = draftKey(userId, formId);
  const stored = storage.getItem(key);
  if (!stored) return null;
  try {
    const parsed = JSON.parse(stored) as {
      version?: unknown;
      values?: unknown;
    };
    if (
      parsed.version !== DRAFT_VERSION
      || !parsed.values
      || typeof parsed.values !== 'object'
      || Object.values(parsed.values).some((value) => typeof value !== 'string')
    ) throw new Error('Invalid draft');
    return parsed.values as DraftValues;
  } catch {
    storage.removeItem(key);
    return null;
  }
}

export function clearDraft(
  storage: DraftStorage,
  userId: string,
  formId: string,
): void {
  storage.removeItem(draftKey(userId, formId));
}
