import { formatMoney } from '../../domain/money';
import { type ISODate, monthsRemaining, toMonthValue } from '../../domain/periods';
import { ActionForm } from '../forms/action-form';
import { ConfirmSubmit } from '../forms/confirm-submit';
import { MoneyInput } from '../forms/money-input';
import type { FormResult } from '../forms/result';
import {
  Disclosure,
  Empty,
  Field,
  FilterForm,
  PageShell,
  Record,
  RecordList,
  Section,
} from '../ui/page';
import type { PlanEntry, PlanTemplate } from './types';

type FormAction = (
  previous: FormResult,
  formData: FormData,
) => Promise<FormResult>;

const SUBMIT_CLASS = 'justify-self-start rounded-lg border border-hairline-strong '
  + 'bg-accent-soft px-4 py-2.5 font-semibold text-ink hover:border-accent '
  + 'hover:bg-accent/20';
const QUIET_SUBMIT_CLASS = 'justify-self-start rounded-lg border border-hairline '
  + 'bg-transparent px-4 py-2.5 text-ink hover:border-hairline-strong';

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
 * Only the statuses the database actually permits for each type. The form used to
 * offer all five regardless, then silently substitute a valid one.
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
      <Field label="Name">
        <input name="name" required defaultValue={template?.name} />
      </Field>
      {fixedEntryType ? (
        <input type="hidden" name="entryType" value={fixedEntryType} />
      ) : (
        <Field label="Type">
          <select name="entryType" required defaultValue={entryType}>
            <option value="savings">Savings</option>
            <option value="investment">Investment</option>
          </select>
        </Field>
      )}
      <MoneyInput
        name="amount"
        label="Amount"
        defaultSen={template ? template.amountSen : null}
        required
      />
      <Field label={DAY_LABEL[entryType]}>
        <input
          name="day"
          type="number"
          inputMode="numeric"
          min="1"
          max="31"
          required
          defaultValue={template?.day ?? 1}
        />
      </Field>
      {statuses.length === 1 ? (
        <input type="hidden" name="status" value={statuses[0][0]} />
      ) : (
        <Field label="Status">
          <select
            name="status"
            required
            defaultValue={template?.status ?? defaultStatus(entryType)}
          >
            {statuses.map(([value, text]) => (
              <option key={value} value={value}>{text}</option>
            ))}
          </select>
        </Field>
      )}
      <Field label={FINAL_MONTH_LABEL[entryType]}>
        <input
          name="finalMonth"
          type="month"
          defaultValue={template?.effectiveEnd ? toMonthValue(template.effectiveEnd) : ''}
        />
      </Field>
    </>
  );
}

/** "8 payments left", derived from the final month rather than a stored counter. */
function paymentsLeftLabel(
  template: PlanTemplate,
  periodStart: ISODate,
): string | null {
  if (!template.effectiveEnd) {
    return null;
  }
  const left = monthsRemaining(template.effectiveEnd, periodStart);
  return left === 0
    ? 'Final payment passed'
    : `${left} payment${left === 1 ? '' : 's'} left`;
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
  if (templates.length === 0) {
    return <Empty>{emptyMessage}</Empty>;
  }
  return (
    <RecordList>
      {templates.map((template) => {
        const paymentsLeft = paymentsLeftLabel(template, periodStart);
        return (
          <Record key={template.id}>
            <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
              <strong className="text-ink">{template.name}</strong>
              <span className="font-semibold text-ink tabular-nums">
                {formatMoney(template.amountSen)}
              </span>
            </div>
            <p className="text-sm text-ink-muted">
              day {template.day}
              {' · '}
              {template.isActive ? 'Active' : 'Archived'}
              {paymentsLeft ? ` · ${paymentsLeft}` : ''}
            </p>
            {template.isActive ? (
              <>
                <Disclosure summary={`Edit ${template.name}`}>
                  <ActionForm action={actions?.update} resetOnSuccess={false}>
                    <input type="hidden" name="templateId" value={template.id} />
                    <TemplateFields
                      template={template}
                      fixedEntryType={fixedEntryType}
                      periodStart={periodStart}
                    />
                    <button className={QUIET_SUBMIT_CLASS} type="submit">
                      Save recurring item
                    </button>
                  </ActionForm>
                </Disclosure>
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
          </Record>
        );
      })}
    </RecordList>
  );
}

function EntryActualForm({
  entry,
  action,
}: {
  entry: PlanEntry;
  action?: FormAction;
}) {
  return (
    <ActionForm action={action} resetOnSuccess={false} successMessage="Entry saved.">
      <input type="hidden" name="entryId" value={entry.id} />
      <input type="hidden" name="entryType" value={entry.entryType} />
      <Field label="Status">
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
      </Field>
      <MoneyInput
        name="actualAmount"
        label="Actual amount"
        defaultSen={entry.actualAmountSen}
      />
      {entry.entryType === 'commitment' ? (
        <Field label="Paid date">
          <input name="paidDate" type="date" defaultValue={entry.paidDate ?? ''} />
        </Field>
      ) : <input type="hidden" name="paidDate" value="" />}
      <Field label="Notes">
        <textarea name="notes" defaultValue={entry.notes ?? ''} />
      </Field>
      <button className={QUIET_SUBMIT_CLASS} type="submit">Save entry actual</button>
    </ActionForm>
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
  const commitmentTemplates = templates.filter((template) => (
    template.entryType === 'commitment'
  ));
  const otherTemplates = templates.filter((template) => (
    template.entryType === 'savings' || template.entryType === 'investment'
  ));

  return (
    <PageShell
      intro="These fixed items carry forward into future months."
      title="Income & Commitments"
    >
      <Section id="income" title="Recurring income">
        <TemplateList
          templates={incomeTemplates}
          emptyMessage="No recurring income yet."
          actions={actions}
          periodStart={periodStart}
          fixedEntryType="income"
        />
        <ActionForm action={actions?.create} successMessage="Income saved.">
          <TemplateFields fixedEntryType="income" periodStart={periodStart} />
          <button className={SUBMIT_CLASS} type="submit">Add income</button>
        </ActionForm>
      </Section>

      <Section id="commitments" title="Recurring commitments">
        <TemplateList
          templates={commitmentTemplates}
          emptyMessage="No recurring commitments yet."
          actions={actions}
          periodStart={periodStart}
          fixedEntryType="commitment"
        />
        <ActionForm action={actions?.create} successMessage="Commitment saved.">
          <TemplateFields fixedEntryType="commitment" periodStart={periodStart} />
          <button className={SUBMIT_CLASS} type="submit">Add commitment</button>
        </ActionForm>
      </Section>

      <Section id="allocations" title="Other monthly allocations">
        <TemplateList
          templates={otherTemplates}
          emptyMessage="No savings or investment allocations yet."
          actions={actions}
          periodStart={periodStart}
        />
        <ActionForm action={actions?.create} successMessage="Allocation saved.">
          <TemplateFields periodStart={periodStart} />
          <button className={SUBMIT_CLASS} type="submit">Add allocation</button>
        </ActionForm>
      </Section>

      <Section id="month" title="Generate selected month">
        <FilterForm>
          <Field label="Month">
            <input
              name="month"
              type="month"
              required
              defaultValue={periodStart.slice(0, 7)}
            />
          </Field>
          <button className={QUIET_SUBMIT_CLASS} type="submit">View month</button>
        </FilterForm>
        <ActionForm action={actions?.generate} resetOnSuccess={false}>
          <input type="hidden" name="periodStart" value={periodStart} />
          <button className={QUIET_SUBMIT_CLASS} type="submit">Generate {label}</button>
        </ActionForm>
      </Section>

      <Section id="snapshots" title={`Generated monthly entries for ${label}`}>
        {entries.length === 0 ? (
          <Empty>No generated entries for {label}.</Empty>
        ) : (
          <RecordList>
            {entries.map((entry) => (
              <Record key={entry.id}>
                <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                  <strong className="text-ink">{entry.name}</strong>
                  <span className="font-semibold text-ink tabular-nums">
                    Planned {formatMoney(entry.amountSen)}
                  </span>
                </div>
                <p className="text-sm text-ink-muted">
                  {entry.actualAmountSen === null
                    ? 'Actual not recorded'
                    : `Actual ${formatMoney(entry.actualAmountSen)}`}
                  {' · '}
                  <time dateTime={entry.entryDate}>{entry.entryDate}</time>
                  {' · '}
                  {entry.status}
                  {entry.paidDate ? (
                    <> paid <time dateTime={entry.paidDate}>{entry.paidDate}</time></>
                  ) : null}
                </p>
                {entry.notes ? (
                  <p className="text-sm text-ink-muted">{entry.notes}</p>
                ) : null}
                {entry.entryType === 'income' || entry.entryType === 'commitment' ? (
                  <Disclosure summary="Update actual">
                    <EntryActualForm action={actions?.updateEntry} entry={entry} />
                  </Disclosure>
                ) : null}
              </Record>
            ))}
          </RecordList>
        )}
      </Section>
    </PageShell>
  );
}
