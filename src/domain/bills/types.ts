export type BillParticipant = {
  id: string;
  kind: 'user' | 'friend';
};

export type BillItem = {
  id: string;
  amountSen: number;
  discountSen?: number;
  participantIds: string[];
};

export type AdjustmentDistribution =
  | { method: 'proportional' }
  | { method: 'equal'; participantIds?: string[] }
  | { method: 'selected'; participantIds: string[] }
  | { method: 'user' }
  | { method: 'manual'; amountsSen: Record<string, number> };

export type BillAdjustment = {
  id: string;
  kind: 'discount' | 'service' | 'tax' | 'rounding';
  amountSen: number;
  distribution: AdjustmentDistribution;
};

export type BillAllocationInput = {
  totalSen: number;
  participants: BillParticipant[];
  items: BillItem[];
  adjustments: BillAdjustment[];
};

export type BillPortion = {
  participantId: string;
  amountSen: number;
};

export type BillAllocation = {
  portions: BillPortion[];
  totalSen: number;
};
