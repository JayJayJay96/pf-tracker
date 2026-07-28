import type {
  AdjustmentDistribution,
  BillAdjustment,
  BillAllocation,
  BillAllocationInput,
  BillPortion,
} from './types';

export type BillAllocationErrorCode =
  | 'INVALID_BILL'
  | 'RECONCILIATION_MISMATCH';

export class BillAllocationError extends Error {
  constructor(
    public readonly code: BillAllocationErrorCode,
    message: string,
    public readonly differenceSen?: number,
  ) {
    super(message);
    this.name = 'BillAllocationError';
  }
}

function invalid(message: string): never {
  throw new BillAllocationError('INVALID_BILL', message);
}

function requireSen(value: number, label: string): void {
  if (!Number.isSafeInteger(value) || value < 0) invalid(`Invalid ${label}`);
}

function addSafe(left: number, right: number): number {
  const result = left + right;
  if (!Number.isSafeInteger(result)) invalid('Bill amount exceeds safe integer range');
  return result;
}

function distribute(
  amountSen: number,
  participantIds: string[],
  weights: Map<string, number>,
  userId: string,
): Map<string, number> {
  if (participantIds.length === 0) invalid('An allocation has no participants');
  const weightTotal = participantIds.reduce(
    (total, id) => addSafe(total, weights.get(id) ?? 0),
    0,
  );
  if (weightTotal <= 0) invalid('A proportional allocation has no positive weight');

  const shares = new Map<string, number>();
  let allocated = 0;
  participantIds.forEach((id) => {
    const weight = weights.get(id) ?? 0;
    const share = Number(
      (BigInt(amountSen) * BigInt(weight)) / BigInt(weightTotal),
    );
    shares.set(id, share);
    allocated = addSafe(allocated, share);
  });
  const residualRecipient = participantIds.includes(userId)
    ? userId
    : participantIds[0];
  shares.set(
    residualRecipient,
    addSafe(shares.get(residualRecipient) ?? 0, amountSen - allocated),
  );
  return shares;
}

function equalWeights(ids: string[]): Map<string, number> {
  return new Map(ids.map((id) => [id, 1]));
}

function distributionShares(
  amountSen: number,
  distribution: AdjustmentDistribution,
  portions: Map<string, number>,
  participantIds: string[],
  userId: string,
): Map<string, number> {
  switch (distribution.method) {
    case 'proportional':
      return distribute(amountSen, participantIds, portions, userId);
    case 'equal': {
      const ids = distribution.participantIds ?? participantIds;
      return distribute(amountSen, ids, equalWeights(ids), userId);
    }
    case 'selected':
      return distribute(
        amountSen,
        distribution.participantIds,
        equalWeights(distribution.participantIds),
        userId,
      );
    case 'user':
      return new Map([[userId, amountSen]]);
    case 'manual': {
      const shares = new Map(Object.entries(distribution.amountsSen));
      let total = 0;
      shares.forEach((share, id) => {
        if (!participantIds.includes(id)) invalid('Manual allocation names a non-participant');
        requireSen(share, 'manual allocation');
        total = addSafe(total, share);
      });
      if (total !== amountSen) invalid('Manual allocation does not match adjustment amount');
      return shares;
    }
  }
}

const adjustmentOrder: Record<BillAdjustment['kind'], number> = {
  discount: 0,
  service: 1,
  tax: 2,
  rounding: 3,
};

/** Allocates a shared bill using integer sen and reconciles the final total exactly. */
export function allocateBill(input: BillAllocationInput): BillAllocation {
  requireSen(input.totalSen, 'bill total');
  if (input.participants.length === 0) invalid('A bill must have participants');

  const participantIds = input.participants.map(({ id }) => id);
  if (
    participantIds.some((id) => id.trim() === '')
    || new Set(participantIds).size !== participantIds.length
  ) {
    invalid('Bill participants must have unique identifiers');
  }
  const users = input.participants.filter(({ kind }) => kind === 'user');
  if (users.length !== 1) invalid('A bill must have exactly one user participant');
  const userId = users[0].id;
  const portions = new Map(participantIds.map((id) => [id, 0]));

  input.items.forEach((item) => {
    requireSen(item.amountSen, 'item amount');
    requireSen(item.discountSen ?? 0, 'item discount');
    if ((item.discountSen ?? 0) > item.amountSen) {
      invalid('Item discount exceeds item amount');
    }
    if (
      item.participantIds.some((id) => !portions.has(id))
      || new Set(item.participantIds).size !== item.participantIds.length
    ) {
      invalid('Item assignments must name unique bill participants');
    }
    const weights = equalWeights(item.participantIds);
    const grossShares = distribute(
      item.amountSen,
      item.participantIds,
      weights,
      userId,
    );
    const discountShares = distribute(
      item.discountSen ?? 0,
      item.participantIds,
      weights,
      userId,
    );
    item.participantIds.forEach((id) => {
      portions.set(
        id,
        addSafe(
          portions.get(id) ?? 0,
          (grossShares.get(id) ?? 0) - (discountShares.get(id) ?? 0),
        ),
      );
    });
  });

  input.adjustments
    .map((adjustment, index) => ({ adjustment, index }))
    .sort((left, right) => (
      adjustmentOrder[left.adjustment.kind] - adjustmentOrder[right.adjustment.kind]
      || left.index - right.index
    ))
    .forEach(({ adjustment }) => {
      requireSen(adjustment.amountSen, 'adjustment amount');
      const shares = distributionShares(
        adjustment.amountSen,
        adjustment.distribution,
        portions,
        participantIds,
        userId,
      );
      shares.forEach((share, id) => {
        const signedShare = adjustment.kind === 'discount' ? -share : share;
        const next = addSafe(portions.get(id) ?? 0, signedShare);
        if (next < 0) invalid('Adjustment makes a participant portion negative');
        portions.set(id, next);
      });
    });

  const computedTotal = [...portions.values()].reduce(addSafe, 0);
  if (computedTotal !== input.totalSen) {
    const differenceSen = input.totalSen - computedTotal;
    throw new BillAllocationError(
      'RECONCILIATION_MISMATCH',
      `Bill does not reconcile by ${differenceSen} sen`,
      differenceSen,
    );
  }

  const billPortions: BillPortion[] = participantIds.map((participantId) => ({
    participantId,
    amountSen: portions.get(participantId) ?? 0,
  }));
  return { portions: billPortions, totalSen: computedTotal };
}
