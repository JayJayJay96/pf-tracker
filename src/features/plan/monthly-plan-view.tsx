import Link from 'next/link';

import { formatRM } from '../../domain/money';
import { MoneyInput } from '../forms/money-input';
import type { FormResult } from '../forms/result';
import { ActionForm } from '../forms/action-form';
import { ConfirmSubmit } from '../forms/confirm-submit';
import { type ISODate, monthsRemaining, toMonthValue } from '../../domain/periods';
import type { PlanEntry, PlanTemplate } from './types';

type FormAction = (
  previous: FormResult,
  formData: FormData,
) => Promise<FormResult>;

type MonthlyPlanViewProps = {
  periodStart: ISODate;
  templates: PlanTemplate[];
  entries: PlanEntry[];
  actions?: {
    create: FormAction;
    update: FormAction;
    archive: FormAction;
    generate: FormAction;
    updateEntry: FormAction;
  };
};

function monthLabel(periodStart: ISODate): string {
  return new Intl.DateTimeFormat('en-MY', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${periodStart}T00:00:00Z`));
}

function defaultStatus(entryType: PlanTemplate['entryType']): PlanTemplate['status'] {
  switch (entryType) {
    case 'income':
      return 'confirmed';
    case 'commitment':
      return 'active';
    default:
      return 'planned';
  }
}

/** Wording for the day-of-month field, which differs by what the item is. */
const DAY_LABEL: Record<PlanTemplate['entryType'], string> = {
  income: 'Paid on day',
  commitment: 'Charged on day',
  savings: 'Transferred on day',
  investment: 'Transferred on day',
};

/** Wording for the optional final month. */
const FINAL_MONTH_LABEL: Record<PlanTemplate['entryType'], string> = {
  income: 'Last month received (optional)',
  commitment: 'Final payment month (optional)',
  savings: 'Final month (optional)',
  investment: 'Final month (optional)',
};

/**
 * Only the statuses the database actually permits for each type. The form used
 * to offer all five regardless, then silently substitute a valid one.
 */
const STATUS_OPTIONS: Record<PlanTemplate['entryType'], Array<[string, string]>> = {
  income: [['confirmed', 'Confirmed'], ['pending', 'Not confirmed yet']],
  commitment: [['active', 'Active'], ['inactive', 'Paused']],
  savings: [['planned', 'Planned']],
  investment: [['planned', 'Planned']],
};

function TemplateFields({
  template,
  fixedEntryType,
  periodStart,
}: {
  template?: PlanTemplate;
  fixedEntryType?: PlanTemplate['entryType'];
  periodStart: ISODate;
}) {
  const entryType = fixedEntryType ?? template?.entryType ?? 'savings';
  const statuses = STATUS_OPTIONS[entryType];
  return (
    <>
      {/* Recurring items start applying from the month being viewed. */}
      <input type="hidden" name="periodStart" value={periodStart} />
      <label>
        Name
        <input name="name" required defaultValue={template?.name} />
      </label>
      {fixedEntryType ? (
        <input type="hidden" name="entryType" value={fixedEntryType} />
      ) : (
        <label>
          Type
          <select name="entryType" required defaultValue={entryType}>
            <option value="savings">Savings</option>
            <option value="investment">Investment</option>
          </select>
        </label>
      )}
      <MoneyInput
        name="amount"
        label="Amount"
        defaultSen={template ? template.amountSen : null}
        required
      />
      <label>
        {DAY_LABEL[entryType]}
        <input
          name="day"
          type="number"
          inputMode="numeric"
          min="1"
          max="31"
          required
          defaultValue={template?.day ?? 1}
        />
      </label>
      {statuses.length === 1 ? (
        <input type="hidden" name="status" value={statuses[0][0]} />
      ) : (
        <label>
          Status
          <select
            name="status"
            required
            defaultValue={template?.status ?? defaultStatus(entryType)}
          >
            {statuses.map(([value, text]) => (
              <option key={value} value={value}>{text}</option>
            ))}
          </select>
        </label>
      )}
      <label>
        {FINAL_MONTH_LABEL[entryType]}
        <input
          name="finalMonth"
          type="month"
          defaultValue={template?.effectiveEnd ? toMonthValue(template.effectiveEnd) : ''}
        />
      </label>
    </>
  );
}

/** "8 payments left", derived from the final month rather than a stored counter. */
function PaymentsLeft({
  template,
  periodStart,
}: {
  template: PlanTemplate;
  periodStart: ISODate;
}) {
  if (!template.effectiveEnd) {
    return null;
  }
  const left = monthsRemaining(template.effectiveEnd, periodStart);
  return (
    <span>
      {left === 0 ? 'Final payment passed' : `${left} payment${left === 1 ? '' : 's'} left`}
    </span>
  );
}

function TemplateList({
  templates,
  emptyMessage,
  actions,
  fixedEntryType,
  periodStart,
}: {
  templates: PlanTemplate[];
  emptyMessage: string;
  actions?: MonthlyPlanViewProps['actions'];
  fixedEntryType?: PlanTemplate['entryType'];
  periodStart: ISODate;
}) {
  return templates.length === 0 ? <p>{emptyMessage}</p> : (
    <ul>
      {templates.map((template) => (
        <li key={template.id}>
          <strong>{template.name}</strong>{' '}
          <span>{formatRM(template.amountSen)}</span>{' '}
          <span>day {template.day}</span>{' '}
          <span>{template.isActive ? 'Active' : 'Archived'}</span>{' '}
          <PaymentsLeft template={template} periodStart={periodStart} />
          {template.isActive ? (
            <>
              <details>
                <summary>Edit {template.name}</summary>
                <ActionForm action={actions?.update}>
                  <input type="hidden" name="templateId" value={template.id} />
                  <TemplateFields
                    template={template}
                    fixedEntryType={fixedEntryType}
                    periodStart={periodStart}
                  />
                  <button type="submit">Save recurring item</button>
                </ActionForm>
              </details>
              <ActionForm action={actions?.archive} resetOnSuccess={false}>
                <input type="hidden" name="templateId" value={template.id} />
                <ConfirmSubmit
                  label={`Archive ${template.name}`}
                  description={'This stops the item carrying into future months. '
                    + 'Past months keep their generated entries.'}
                  confirmLabel="Yes, archive it"
                />
              </ActionForm>
            </>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

export function MonthlyPlanView({
  periodStart,
  templates,
  entries,
  actions,
}: MonthlyPlanViewProps) {
  const label = monthLabel(periodStart);
  const incomeTemplates = templates.filter((template) => template.entryType === 'income');
  const commitmentTemplates = templates.filter((template) => template.entryType === 'commitment');
  const otherTemplates = templates.filter((template) => (
    template.entryType === 'savings' || template.entryType === 'investment'
  ));

  return (
    <main>
      <nav aria-label="Primary">
        <Link href="/">Dashboard</Link>{' '}
        <Link href="/reports">Reports</Link>
      </nav>
      <h1>Income &amp; Commitments</h1>
      <p>These fixed items carry forward into future months.</p>

      <section aria-labelledby="income-heading">
        <h2 id="income-heading">Recurring income</h2>
        <TemplateList
          templates={incomeTemplates}
          emptyMessage="No recurring income yet."
          actions={actions}
          periodStart={periodStart}
          fixedEntryType="income"
        />
        <ActionForm action={actions?.create}>
          <TemplateFields fixedEntryType="income" periodStart={periodStart} />
          <button type="submit">Add income</button>
        </ActionForm>
      </section>

      <section aria-labelledby="commitments-heading">
        <h2 id="commitments-heading">Recurring commitments</h2>
        <TemplateList
          templates={commitmentTemplates}
          emptyMessage="No recurring commitments yet."
          actions={actions}
          periodStart={periodStart}
          fixedEntryType="commitment"
        />
        <ActionForm action={actions?.create}>
          <TemplateFields fixedEntryType="commitment" periodStart={periodStart} />
          <button type="submit">Add commitment</button>
        </ActionForm>
      </section>

      <section aria-labelledby="allocations-heading">
        <h2 id="allocations-heading">Other monthly allocations</h2>
        <TemplateList
          templates={otherTemplates}
          emptyMessage="No savings or investment allocations yet."
          actions={actions}
          periodStart={periodStart}
        />
        <ActionForm action={actions?.create}>
          <TemplateFields periodStart={periodStart} />
          <button type="submit">Add allocation</button>
        </ActionForm>
      </section>

      <section aria-labelledby="month-heading">
        <h2 id="month-heading">Generate selected month</h2>
        <form method="get">
          <label>
            Month
            <input
              name="month"
              type="month"
              required
              defaultValue={periodStart.slice(0, 7)}
            />
          </label>
          <button type="submit">View month</button>
        </form>
        <ActionForm action={actions?.generate}>
          <input type="hidden" name="periodStart" value={periodStart} />
          <button type="submit">Generate {label}</button>
        </ActionForm>
      </section>

      <section aria-labelledby="snapshots-heading">
        <h2 id="snapshots-heading">Generated monthly entries for {label}</h2>
        {entries.length === 0 ? <p>No generated entries for {label}.</p> : (
          <ul>
            {entries.map((entry) => (
              <li key={entry.id}>
                <strong>{entry.name}</strong>{' '}
                <span>Planned {formatRM(entry.amountSen)}</span>{' '}
                {entry.actualAmountSen === null
                  ? <span>Actual not recorded</span>
                  : <span>Actual {formatRM(entry.actualAmountSen)}</span>}{' '}
                <time dateTime={entry.entryDate}>{entry.entryDate}</time>{' '}
                <span>{entry.status}</span>
                {entry.paidDate ? (
                  <> paid <time dateTime={entry.paidDate}>{entry.paidDate}</time></>
                ) : null}
                {entry.notes ? <p>{entry.notes}</p> : null}
                {entry.entryType === 'income' || entry.entryType === 'commitment' ? (
                  <details>
                    <summary>Update actual</summary>
                    <ActionForm action={actions?.updateEntry}>
                      <input type="hidden" name="entryId" value={entry.id} />
                      <input type="hidden" name="entryType" value={entry.entryType} />
                      <label>
                        Status
                        <select
                          name="status"
                          required
                          defaultValue={entry.entryType === 'commitment'
                            ? (entry.status === 'paid' ? 'paid' : 'pending')
                            : entry.status}
                        >
                          {entry.entryType === 'income' ? (
                            <>
                              <option value="pending">Pending income</option>
                              <option value="confirmed">Confirmed income</option>
                            </>
                          ) : (
                            <>
                              <option value="pending">Pending commitment</option>
                              <option value="paid">Paid commitment</option>
                            </>
                          )}
                        </select>
                      </label>
                      <MoneyInput
                        name="actualAmount"
                        label="Actual amount"
                        defaultSen={entry.actualAmountSen}
                      />
                      {entry.entryType === 'commitment' ? (
                        <label>
                          Paid date
                          <input
                            name="paidDate"
                            type="date"
                            defaultValue={entry.paidDate ?? ''}
                          />
                        </label>
                      ) : <input type="hidden" name="paidDate" value="" />}
                      <label>
                        Notes
                        <textarea name="notes" defaultValue={entry.notes ?? ''} />
                      </label>
                      <button type="submit">Save entry actual</button>
                    </ActionForm>
                  </details>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
