export type PaymentRequestStatus =
  | 'pending'
  | 'paid'
  | 'cancelled'
  | 'forgiven';

type PaymentRequestTransition = {
  currentStatus: PaymentRequestStatus;
  nextStatus: Exclude<PaymentRequestStatus, 'pending'>;
  totalSen: number;
  paidAmountSen?: number;
};

export function transitionPaymentRequest({
  currentStatus,
  nextStatus,
  totalSen,
  paidAmountSen,
}: PaymentRequestTransition): PaymentRequestStatus {
  if (currentStatus !== 'pending') {
    throw new Error('Payment request is already settled');
  }
  if (
    !Number.isSafeInteger(totalSen)
    || totalSen <= 0
    || (
      nextStatus === 'paid'
      && paidAmountSen !== totalSen
    )
  ) {
    throw new Error(
      nextStatus === 'paid'
        ? 'Payment must match the full requested amount'
        : 'Invalid payment request transition',
    );
  }
  return nextStatus;
}
