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

function TemplateFields({ template }: { template?: PlanTemplate }) {
  const entryType = template?.entryType ?? 'income';
  return (
    <>
      <label>
        Name
        <input name="name" required defaultValue={template?.name} />
      </label>
      <label>
        Type
        <select name="entryType" required defaultValue={entryType}>
          <option value="income">Income</option>
          <option value="commitment">Commitment</option>
          <option value="savings">Savings</option>
          <option value="investment">Investment</option>
        </select>
      </label>
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
        Expected or due day
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

export function MonthlyPlanView({
  periodStart,
  templates,
  entries,
  actions,
}: MonthlyPlanViewProps) {
  const label = monthLabel(periodStart);

  return (
    <main>
      <nav aria-label="Primary">
        <Link href="/">Dashboard</Link>{' '}
        <Link href="/reports">Reports</Link>
      </nav>
      <h1>Monthly Plan</h1>
      <p>Template edits apply only to months generated afterward.</p>

      <section aria-labelledby="month-heading">
        <h2 id="month-heading">Selected month</h2>
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

      <section aria-labelledby="new-template-heading">
        <h2 id="new-template-heading">Add template</h2>
        <form action={actions?.create}>
          <TemplateFields />
          <button type="submit">Add template</button>
        </form>
      </section>

      <section aria-labelledby="templates-heading">
        <h2 id="templates-heading">Templates</h2>
        {templates.length === 0 ? <p>No templates yet.</p> : (
          <ul>
            {templates.map((template) => (
              <li key={template.id}>
                <strong>{template.name}</strong>{' '}
                <span>{formatRM(template.amountSen)}</span>{' '}
                <span>{template.entryType}</span>{' '}
                <span>{template.isActive ? 'Active' : 'Archived'}</span>
                {template.isActive ? (
                  <>
                    <details>
                      <summary>Edit {template.name}</summary>
                      <form action={actions?.update}>
                        <input type="hidden" name="templateId" value={template.id} />
                        <TemplateFields template={template} />
                        <button type="submit">Save future template</button>
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
        )}
      </section>

      <section aria-labelledby="snapshots-heading">
        <h2 id="snapshots-heading">Generated snapshots for {label}</h2>
        {entries.length === 0 ? <p>No snapshots generated for {label}.</p> : (
          <ul>
            {entries.map((entry) => (
              <li key={entry.id}>
                <strong>{entry.name}</strong>{' '}
                <span>{formatRM(entry.amountSen)}</span>{' '}
                <time dateTime={entry.entryDate}>{entry.entryDate}</time>{' '}
                <span>{entry.status}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
