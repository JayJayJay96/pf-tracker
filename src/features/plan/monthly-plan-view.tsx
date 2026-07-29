import Link from 'next/link';

import { formatRM } from '../../domain/money';
import type { ISODate } from '../../domain/periods';
import type { PlanEntry, PlanTemplate } from './types';

type FormAction = (formData: FormData) => void | Promise<void>;

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

function TemplateFields({
  template,
  fixedEntryType,
}: {
  template?: PlanTemplate;
  fixedEntryType?: PlanTemplate['entryType'];
}) {
  const entryType = fixedEntryType ?? template?.entryType ?? 'income';
  return (
    <>
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
            <option value="income">Income</option>
            <option value="commitment">Commitment</option>
            <option value="savings">Savings</option>
            <option value="investment">Investment</option>
          </select>
        </label>
      )}
      <label>
        Amount
        <input
          name="amount"
          inputMode="decimal"
          pattern="RM(?:0|[1-9][0-9]*)\.[0-9]{2}"
          placeholder="RM0.00"
          required
          defaultValue={template ? formatRM(template.amountSen) : undefined}
        />
      </label>
      <label>
        Money-in or due day
        <input
          name="day"
          type="number"
          min="1"
          max="31"
          required
          defaultValue={template?.day ?? 1}
        />
      </label>
      <label>
        Status
        <select
          name="status"
          required
          defaultValue={template?.status ?? defaultStatus(entryType)}
        >
          <option value="confirmed">Confirmed income</option>
          <option value="pending">Pending income</option>
          <option value="active">Active commitment</option>
          <option value="inactive">Inactive commitment</option>
          <option value="planned">Planned allocation</option>
        </select>
      </label>
      <label>
        Effective start
        <input
          name="effectiveStart"
          type="date"
          required
          defaultValue={template?.effectiveStart}
        />
      </label>
      <label>
        Effective end
        <input name="effectiveEnd" type="date" defaultValue={template?.effectiveEnd ?? ''} />
      </label>
    </>
  );
}

function TemplateList({
  templates,
  emptyMessage,
  actions,
  fixedEntryType,
}: {
  templates: PlanTemplate[];
  emptyMessage: string;
  actions?: MonthlyPlanViewProps['actions'];
  fixedEntryType?: PlanTemplate['entryType'];
}) {
  return templates.length === 0 ? <p>{emptyMessage}</p> : (
    <ul>
      {templates.map((template) => (
        <li key={template.id}>
          <strong>{template.name}</strong>{' '}
          <span>{formatRM(template.amountSen)}</span>{' '}
          <span>day {template.day}</span>{' '}
          <span>{template.isActive ? 'Active' : 'Archived'}</span>
          {template.isActive ? (
            <>
              <details>
                <summary>Edit {template.name}</summary>
                <form action={actions?.update}>
                  <input type="hidden" name="templateId" value={template.id} />
                  <TemplateFields
                    template={template}
                    fixedEntryType={fixedEntryType}
                  />
                  <button type="submit">Save recurring item</button>
                </form>
              </details>
              <form action={actions?.archive}>
                <input type="hidden" name="templateId" value={template.id} />
                <button type="submit">Archive</button>
              </form>
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
          fixedEntryType="income"
        />
        <form action={actions?.create}>
          <TemplateFields fixedEntryType="income" />
          <button type="submit">Add income</button>
        </form>
      </section>

      <section aria-labelledby="commitments-heading">
        <h2 id="commitments-heading">Recurring commitments</h2>
        <TemplateList
          templates={commitmentTemplates}
          emptyMessage="No recurring commitments yet."
          actions={actions}
          fixedEntryType="commitment"
        />
        <form action={actions?.create}>
          <TemplateFields fixedEntryType="commitment" />
          <button type="submit">Add commitment</button>
        </form>
      </section>

      <section aria-labelledby="allocations-heading">
        <h2 id="allocations-heading">Other monthly allocations</h2>
        <TemplateList
          templates={otherTemplates}
          emptyMessage="No savings or investment allocations yet."
          actions={actions}
        />
        <form action={actions?.create}>
          <TemplateFields />
          <button type="submit">Add allocation</button>
        </form>
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
        <form action={actions?.generate}>
          <input type="hidden" name="periodStart" value={periodStart} />
          <button type="submit">Generate {label}</button>
        </form>
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
                    <form action={actions?.updateEntry}>
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
                      <label>
                        Actual amount
                        <input
                          name="actualAmount"
                          inputMode="decimal"
                          pattern="RM(?:0|[1-9][0-9]*)\.[0-9]{2}"
                          placeholder="RM0.00"
                          defaultValue={entry.actualAmountSen === null
                            ? ''
                            : formatRM(entry.actualAmountSen)}
                        />
                      </label>
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
                    </form>
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
