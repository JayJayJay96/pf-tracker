'use client';

import { useState } from 'react';

import { allocateBill } from '../../domain/bills/allocation';
import type { AdjustmentDistribution, BillAdjustment } from '../../domain/bills/types';
import {
  formatAmountInput,
  formatRM,
  requireAmountInput,
  requireSignedAmountInput,
} from '../../domain/money';
import { ActionForm } from '../forms/action-form';
import { MoneyInput } from '../forms/money-input';
import type { FormResult } from '../forms/result';
import type { ConfiguredResolutionInput } from './actions';
import type { Friend } from './queries';

type FormAction = (
  previous: FormResult,
  formData: FormData,
) => Promise<FormResult>;
type ItemDraft = {
  key: number;
  description: string;
  amount: string;
  discount: string;
  participantIds: string[];
};
type AdjustmentDraft = {
  key: number;
  kind: BillAdjustment['kind'];
  amount: string;
  method: AdjustmentDistribution['method'];
  participantIds: string[];
  manualAmounts: Record<string, string>;
};

export function ResolutionEditor({
  billId,
  totalSen,
  friends,
  action,
}: {
  billId: string;
  totalSen: number;
  friends: Friend[];
  action?: FormAction;
}) {
  const [friendIds, setFriendIds] = useState<string[]>([]);
  const [items, setItems] = useState<ItemDraft[]>([{
    key: 0,
    description: '',
    amount: formatAmountInput(totalSen),
    discount: '0.00',
    participantIds: ['user'],
  }]);
  const [adjustments, setAdjustments] = useState<AdjustmentDraft[]>([]);
  const [confirmed, setConfirmed] = useState(false);
  const people = [
    { id: 'user', name: 'You' },
    ...friends.filter(({ id }) => friendIds.includes(id)),
  ];

  const configuration: ConfiguredResolutionInput = {
    billId,
    confirmed,
    friendIds,
    items: items.map((item) => ({
      description: item.description,
      amount: item.amount,
      discount: item.discount,
      participantIds: item.participantIds.filter((id) => (
        people.some((person) => person.id === id)
      )),
    })),
    adjustments: adjustments.map((adjustment) => ({
      kind: adjustment.kind,
      amount: adjustment.amount,
      method: adjustment.method,
      participantIds: adjustment.participantIds.filter((id) => (
        people.some((person) => person.id === id)
      )),
      manualAmounts: Object.fromEntries(
        people.map(({ id }) => [id, adjustment.manualAmounts[id] ?? '0.00']),
      ),
    })),
  };

  const review = (() => {
    try {
      const allocation = allocateBill({
        totalSen,
        participants: people.map(({ id }) => ({
          id,
          kind: id === 'user' ? 'user' as const : 'friend' as const,
        })),
        items: configuration.items.map((item, index) => ({
          id: String(index),
          amountSen: requireAmountInput(item.amount),
          discountSen: requireAmountInput(item.discount),
          participantIds: item.participantIds,
        })),
        adjustments: configuration.adjustments.map((adjustment, index) => {
          const kind = adjustment.kind as BillAdjustment['kind'];
          let distribution: AdjustmentDistribution;
          switch (adjustment.method) {
            case 'proportional':
              distribution = { method: 'proportional' };
              break;
            case 'equal':
              distribution = adjustment.participantIds.length
                ? { method: 'equal', participantIds: adjustment.participantIds }
                : { method: 'equal' };
              break;
            case 'selected':
              distribution = {
                method: 'selected',
                participantIds: adjustment.participantIds,
              };
              break;
            case 'user':
              distribution = { method: 'user' };
              break;
            case 'manual':
              distribution = {
                method: 'manual',
                amountsSen: Object.fromEntries(
                  Object.entries(adjustment.manualAmounts).map(([id, amount]) => (
                    [id, requireAmountInput(amount)]
                  )),
                ),
              };
              break;
            default:
              throw new Error('Invalid adjustment distribution');
          }
          return {
            id: String(index),
            kind,
            amountSen: kind === 'rounding'
              ? requireSignedAmountInput(adjustment.amount)
              : requireAmountInput(adjustment.amount),
            distribution,
          };
        }),
      });
      return { allocation, error: null };
    } catch (error) {
      return {
        allocation: null,
        error: error instanceof Error ? error.message : 'Invalid allocation',
      };
    }
  })();

  function updateItem(key: number, update: Partial<ItemDraft>) {
    setConfirmed(false);
    setItems((current) => current.map((item) => (
      item.key === key ? { ...item, ...update } : item
    )));
  }

  function updateAdjustment(key: number, update: Partial<AdjustmentDraft>) {
    setConfirmed(false);
    setAdjustments((current) => current.map((adjustment) => (
      adjustment.key === key ? { ...adjustment, ...update } : adjustment
    )));
  }

  return (
    <ActionForm action={action} resetOnSuccess={false}>
      <fieldset>
        <legend>People</legend>
        <p>You are always included.</p>
        {friends.map((friend) => (
          <label key={friend.id}>
            <input
              type="checkbox"
              checked={friendIds.includes(friend.id)}
              onChange={(event) => {
                setConfirmed(false);
                setFriendIds((current) => event.target.checked
                  ? [...current, friend.id]
                  : current.filter((id) => id !== friend.id));
              }}
            />
            Include {friend.name}
          </label>
        ))}
      </fieldset>

      <fieldset>
        <legend>Items</legend>
        {items.map((item, index) => (
          <fieldset key={item.key}>
            <legend>Item {index + 1}</legend>
            <label>
              Item {index + 1} description
              <input
                value={item.description}
                onChange={(event) => updateItem(item.key, {
                  description: event.target.value,
                })}
                required
              />
            </label>
            <MoneyInput
              name={`item-${item.key}-amount`}
              label={`Item ${index + 1} amount`}
              value={item.amount}
              onValueChange={(amount) => updateItem(item.key, { amount })}
              required
            />
            <MoneyInput
              name={`item-${item.key}-discount`}
              label={`Item ${index + 1} discount`}
              value={item.discount}
              onValueChange={(discount) => updateItem(item.key, { discount })}
              required
            />
            {people.map((person) => (
              <label key={person.id}>
                <input
                  type="checkbox"
                  checked={item.participantIds.includes(person.id)}
                  onChange={(event) => updateItem(item.key, {
                    participantIds: event.target.checked
                      ? [...item.participantIds, person.id]
                      : item.participantIds.filter((id) => id !== person.id),
                  })}
                />
                Item {index + 1} assign {person.name}
              </label>
            ))}
          </fieldset>
        ))}
        <button
          type="button"
          onClick={() => {
            setConfirmed(false);
            setItems((current) => [...current, {
              key: Math.max(...current.map(({ key }) => key), 0) + 1,
              description: '',
              amount: '0.00',
              discount: '0.00',
              participantIds: ['user'],
            }]);
          }}
        >
          Add item
        </button>
      </fieldset>

      <fieldset>
        <legend>Adjustments</legend>
        {adjustments.map((adjustment, index) => (
          <fieldset key={adjustment.key}>
            <legend>Adjustment {index + 1}</legend>
            <label>
              Adjustment {index + 1} type
              <select
                value={adjustment.kind}
                onChange={(event) => updateAdjustment(adjustment.key, {
                  kind: event.target.value as BillAdjustment['kind'],
                })}
              >
                <option value="discount">Bill discount</option>
                <option value="service">Service charge</option>
                <option value="tax">Tax</option>
                <option value="rounding">Signed rounding</option>
              </select>
            </label>
            <MoneyInput
              name={`adjustment-${adjustment.key}-amount`}
              label={`Adjustment ${index + 1} amount`}
              value={adjustment.amount}
              onValueChange={(amount) => updateAdjustment(adjustment.key, { amount })}
              allowNegative={adjustment.kind === 'rounding'}
              required
            />
            <label>
              Adjustment {index + 1} distribution
              <select
                value={adjustment.method}
                onChange={(event) => updateAdjustment(adjustment.key, {
                  method: event.target.value as AdjustmentDistribution['method'],
                })}
              >
                <option value="proportional">Proportional</option>
                <option value="equal">Equal</option>
                <option value="selected">Selected people</option>
                <option value="user">User only</option>
                <option value="manual">Manual</option>
              </select>
            </label>
            {people.map((person) => (
              <div key={person.id}>
                <label>
                  <input
                    type="checkbox"
                    checked={adjustment.participantIds.includes(person.id)}
                    onChange={(event) => updateAdjustment(adjustment.key, {
                      participantIds: event.target.checked
                        ? [...adjustment.participantIds, person.id]
                        : adjustment.participantIds.filter((id) => id !== person.id),
                    })}
                  />
                  Adjustment {index + 1} include {person.name}
                </label>
                <MoneyInput
                  name={`adjustment-${adjustment.key}-manual-${person.id}`}
                  label={`Adjustment ${index + 1} ${person.name} manual amount`}
                  value={adjustment.manualAmounts[person.id] ?? '0.00'}
                  onValueChange={(amount) => updateAdjustment(adjustment.key, {
                    manualAmounts: { ...adjustment.manualAmounts, [person.id]: amount },
                  })}
                />
              </div>
            ))}
          </fieldset>
        ))}
        <button
          type="button"
          onClick={() => {
            setConfirmed(false);
            setAdjustments((current) => [...current, {
              key: Math.max(...current.map(({ key }) => key), 0) + 1,
              kind: 'discount',
              amount: '0.00',
              method: 'proportional',
              participantIds: [],
              manualAmounts: {},
            }]);
          }}
        >
          Add adjustment
        </button>
      </fieldset>

      <section aria-labelledby={`review-${billId}`}>
        <h4 id={`review-${billId}`}>Allocation review</h4>
        {review.error ? <p role="alert">{review.error}</p> : (
          <ul>
            {review.allocation?.portions.map((portion) => (
              <li key={portion.participantId}>
                {people.find(({ id }) => id === portion.participantId)?.name}:{' '}
                {formatRM(portion.amountSen)}
              </li>
            ))}
          </ul>
        )}
        <label>
          <input
            type="checkbox"
            checked={confirmed}
            disabled={Boolean(review.error)}
            onChange={(event) => setConfirmed(event.target.checked)}
          />
          Confirm reviewed allocation
        </label>
      </section>
      <input
        type="hidden"
        name="configuration"
        value={JSON.stringify(configuration)}
      />
      <button type="submit" disabled={Boolean(review.error) || !confirmed}>
        Resolve shared bill
      </button>
    </ActionForm>
  );
}
