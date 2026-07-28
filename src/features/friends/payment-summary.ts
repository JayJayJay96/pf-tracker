import { formatRM } from '../../domain/money';

export type PaymentSummaryItem = {
  description: string;
  transactionDate: string;
  amountSen: number;
};

type PaymentSummary = {
  friendName: string;
  items: PaymentSummaryItem[];
  totalSen: number;
};

const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

function formatDate(value: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) throw new Error('Invalid payment request snapshot');
  const month = Number(match[2]);
  if (month < 1 || month > 12) {
    throw new Error('Invalid payment request snapshot');
  }
  return `${Number(match[3])} ${MONTHS[month - 1]} ${match[1]}`;
}

export function buildPaymentSummary({
  friendName,
  items,
  totalSen,
}: PaymentSummary): string {
  if (
    friendName.trim() === ''
    || items.length === 0
    || !Number.isSafeInteger(totalSen)
    || totalSen <= 0
    || items.some((item) => (
      item.description.trim() === ''
      || !Number.isSafeInteger(item.amountSen)
      || item.amountSen <= 0
    ))
  ) {
    throw new Error('Invalid payment request snapshot');
  }
  const itemTotal = items.reduce((total, item) => total + item.amountSen, 0);
  if (itemTotal !== totalSen) {
    throw new Error('Payment request snapshots do not match the total');
  }
  return [
    `Hey ${friendName.trim()}, these are the pending amounts:`,
    '',
    ...items.map((item) => (
      `${formatDate(item.transactionDate)} — ${item.description}: ${formatRM(item.amountSen)}`
    )),
    '',
    `Total: ${formatRM(totalSen)}`,
  ].join('\n');
}
