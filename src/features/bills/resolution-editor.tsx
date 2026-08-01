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
import { Field } from '../ui/page';
import type { ConfiguredResolutionInput } from './actions';
import type { Friend } from './queries';

/**
 * This editor renders inside a bill in a list, so it cannot use PageShell or
 * Section. These carry the same treatment one level further down instead.
 */
const GROUP = 'col-span-full grid gap-3.5 rounded-xl border border-hairline '
  + 'bg-black/20 px-4 py-3.5';
const SUBGROUP = 'grid gap-x-3 gap-y-6 rounded-lg border border-hairline/60 px-3.5 py-3 '
  + '[grid-template-columns:repeat(auto-fit,minmax(200px,1fr))]';
const LEGEND = 'px-1 text-sm font-semibold text-ink-muted';
const CHECK_ROW = 'flex min-h-9 items-center gap-2 text-sm text-ink';
const ADD_BUTTON = 'justify-self-start bg-transparent px-3.5 py-2 text-sm';
const SUBMIT = 'justify-self-start rounded-lg border border-hairline-strong '
  + 'bg-accent-soft px-4 py-2.5 font-semibold text-ink hover:border-accent '
  + 'hover:bg-accent/20';

/** The distribution methods that actually read a list of people. */
const NEEDS_PEOPLE = new Set<AdjustmentDistribution['method']>(['equal', 'selected']);

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
      <fieldset className={GROUP}>
        <legend className={LEGEND}>People</legend>
        <p className="text-sm text-ink-muted">You are always included.</p>
        <div className="grid gap-1">
          {friends.map((friend) => (
            <label className={CHECK_ROW} key={friend.id}>
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
        </div>
      </fieldset>

      <fieldset className={GROUP}>
        <legend className={LEGEND}>Items</legend>
        {items.map((item, index) => (
          <fieldset className={SUBGROUP} key={item.key}>
            <legend className={LEGEND}>Item {index + 1}</legend>
            <Field label={`Item ${index + 1} description`}>
              <input
                value={item.description}
                onChange={(event) => updateItem(item.key, {
                  description: event.target.value,
                })}
                required
              />
            </Field>
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
            <div className="col-span-full grid gap-1">
              {people.map((person) => (
                <label className={CHECK_ROW} key={person.id}>
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
            </div>
          </fieldset>
        ))}
        <button
          className={ADD_BUTTON}
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

      <fieldset className={GROUP}>
        <legend className={LEGEND}>Adjustments</legend>
        {adjustments.map((adjustment, index) => (
          <fieldset className={SUBGROUP} key={adjustment.key}>
            <legend className={LEGEND}>Adjustment {index + 1}</legend>
            <Field label={`Adjustment ${index + 1} type`}>
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
            </Field>
            <MoneyInput
              name={`adjustment-${adjustment.key}-amount`}
              label={`Adjustment ${index + 1} amount`}
              value={adjustment.amount}
              onValueChange={(amount) => updateAdjustment(adjustment.key, { amount })}
              allowNegative={adjustment.kind === 'rounding'}
              required
            />
            <Field label={`Adjustment ${index + 1} distribution`}>
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
            </Field>
            {/*
              Only the controls the chosen method reads. Every adjustment used to
              render an include checkbox and a manual amount for every person
              whatever the method was, so five adjustments and three people meant
              thirty controls, of which at most a handful did anything. The state
              behind them is kept either way, so switching method and back does
              not lose what was already entered.
            */}
            {NEEDS_PEOPLE.has(adjustment.method) ? (
              <div className="col-span-full grid gap-1">
                {people.map((person) => (
                  <label className={CHECK_ROW} key={person.id}>
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
                ))}
              </div>
            ) : null}
            {adjustment.method === 'manual'
              ? people.map((person) => (
                <MoneyInput
                  key={person.id}
                  name={`adjustment-${adjustment.key}-manual-${person.id}`}
                  label={`Adjustment ${index + 1} ${person.name} manual amount`}
                  value={adjustment.manualAmounts[person.id] ?? '0.00'}
                  onValueChange={(amount) => updateAdjustment(adjustment.key, {
                    manualAmounts: { ...adjustment.manualAmounts, [person.id]: amount },
                  })}
                />
              ))
              : null}
          </fieldset>
        ))}
        <button
          className={ADD_BUTTON}
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

      {/*
        h3, not h4. This sits under the "Shared bill history" h2, so an h4 skipped
        a level, once per unresolved bill on the page.
      */}
      <section aria-labelledby={`review-${billId}`} className={GROUP}>
        <h3 className="text-sm font-semibold text-ink-muted" id={`review-${billId}`}>
          Check the split
        </h3>
        {review.error ? (
          <p className="text-sm font-bold text-negative" role="alert">{review.error}</p>
        ) : (
          <ul className="grid list-none gap-1 p-0">
            {review.allocation?.portions.map((portion) => (
              <li className="text-sm text-ink tabular-nums" key={portion.participantId}>
                {people.find(({ id }) => id === portion.participantId)?.name}:{' '}
                {formatRM(portion.amountSen)}
              </li>
            ))}
          </ul>
        )}
        <label className={CHECK_ROW}>
          <input
            type="checkbox"
            checked={confirmed}
            disabled={Boolean(review.error)}
            onChange={(event) => setConfirmed(event.target.checked)}
          />
          These amounts look right
        </label>
      </section>
      <input
        type="hidden"
        name="configuration"
        value={JSON.stringify(configuration)}
      />
      <button
        className={SUBMIT}
        type="submit"
        disabled={Boolean(review.error) || !confirmed}
      >
        Save this split
      </button>
    </ActionForm>
  );
}
