import { describe, expect, it } from 'vitest';

import {
  clearDraft,
  draftKey,
  loadDraft,
  saveDraft,
  type DraftStorage,
} from './drafts';

function storage(): DraftStorage & { values: Map<string, string> } {
  const values = new Map<string, string>();
  return {
    values,
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => { values.set(key, value); },
    removeItem: (key) => { values.delete(key); },
  };
}

describe('draft storage', () => {
  it('isolates drafts by authenticated user and form', () => {
    const local = storage();
    saveDraft(local, 'owner-a', 'personal-expense', { amount: 'RM12.00' });
    saveDraft(local, 'owner-b', 'personal-expense', { amount: 'RM99.00' });
    saveDraft(local, 'owner-a', 'shared-bill', { amount: 'RM42.00' });

    expect(loadDraft(local, 'owner-a', 'personal-expense')).toEqual({
      amount: 'RM12.00',
    });
    expect(loadDraft(local, 'owner-b', 'personal-expense')).toEqual({
      amount: 'RM99.00',
    });
    expect(loadDraft(local, 'owner-a', 'shared-bill')).toEqual({
      amount: 'RM42.00',
    });
  });

  it('clears only the successful form draft', () => {
    const local = storage();
    saveDraft(local, 'owner-a', 'personal-expense', { amount: 'RM12.00' });
    saveDraft(local, 'owner-a', 'shared-bill', { amount: 'RM42.00' });

    clearDraft(local, 'owner-a', 'personal-expense');

    expect(loadDraft(local, 'owner-a', 'personal-expense')).toBeNull();
    expect(loadDraft(local, 'owner-a', 'shared-bill')).toEqual({
      amount: 'RM42.00',
    });
  });

  it('discards malformed or obsolete drafts', () => {
    const local = storage();
    local.setItem(draftKey('owner-a', 'personal-expense'), '{"version":0,"values":{}}');
    expect(loadDraft(local, 'owner-a', 'personal-expense')).toBeNull();

    local.setItem(draftKey('owner-a', 'personal-expense'), 'not json');
    expect(loadDraft(local, 'owner-a', 'personal-expense')).toBeNull();
    expect(local.values.size).toBe(0);
  });
});
