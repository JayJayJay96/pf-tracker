import type { PaymentMethod } from './types';

type ReadResult<T> = {
  data: T | null;
  error: { message: string } | null;
};

export type EntryDefaultsRepository = {
  /** The owner's configured default payment method. */
  getProfileDefaults(userId: string): Promise<ReadResult<{
    default_payment_method: string;
  }>>;
  /** Category of the owner's most recently recorded personal expense. */
  getLastExpenseCategoryId(userId: string): Promise<ReadResult<{
    category_id: string | null;
  }>>;
};

export type EntryDefaults = {
  paymentMethod: PaymentMethod;
  categoryId?: string;
};

function asPaymentMethod(value: string | undefined): PaymentMethod {
  return value === 'cash' ? 'cash' : 'tng';
}

/**
 * Values to pre-fill the add-expense form with, so recording a repeat purchase
 * costs two typed fields rather than six.
 *
 * `profiles.default_payment_method` already exists and is covered by the database
 * tests; nothing read it before, so the form hardcoded 'tng'. A missing or
 * unreadable value falls back to 'tng' rather than blocking entry — a default is
 * a convenience, never a precondition for saving.
 */
export async function getEntryDefaults(
  repository: EntryDefaultsRepository,
  userId: string,
): Promise<EntryDefaults> {
  const [profile, lastExpense] = await Promise.all([
    repository.getProfileDefaults(userId),
    repository.getLastExpenseCategoryId(userId),
  ]);

  return {
    paymentMethod: asPaymentMethod(
      profile.error ? undefined : profile.data?.default_payment_method,
    ),
    categoryId: lastExpense.error
      ? undefined
      : lastExpense.data?.category_id ?? undefined,
  };
}
