'use client';

import { useState } from 'react';

import { Field } from '../ui/page';
import type { ReportPeriodInput } from './queries';

const SUBMIT_CLASS = 'justify-self-start rounded-lg border border-hairline '
  + 'bg-transparent px-4 py-2.5 text-ink hover:border-hairline-strong';

type Range = ReportPeriodInput['kind'];

/**
 * Chooses the period a report covers, showing only the fields that period uses.
 *
 * All five used to sit on screen at once: pick "Specific month" and a month box, a
 * from date, a to date and a year were still there, with nothing to say which of
 * them counted. Reading the code you know the server ignores the rest. Using the
 * screen you do not, so the honest reading is that all four matter.
 */
export function RangePicker({
  selection,
  today,
}: {
  selection: ReportPeriodInput;
  /** Today in ISO form, for the defaults a first visit needs. */
  today: string;
}) {
  const [range, setRange] = useState<Range>(selection.kind);

  return (
    <form
      className="grid items-end gap-x-3 gap-y-6 rounded-xl border border-dashed border-hairline px-4 py-4 [grid-template-columns:repeat(auto-fit,minmax(220px,1fr))]"
      method="get"
    >
      <Field label="Range">
        <select
          name="range"
          value={range}
          onChange={(event) => setRange(event.target.value as Range)}
        >
          <option value="month">Specific month</option>
          <option value="custom">Custom date range</option>
          <option value="ytd">Year to date</option>
          <option value="year">Specific year</option>
        </select>
      </Field>

      {range === 'month' ? (
        <Field label="Month">
          <input
            name="month"
            type="month"
            defaultValue={selection.kind === 'month' ? selection.month : today.slice(0, 7)}
          />
        </Field>
      ) : null}

      {range === 'custom' ? (
        <>
          <Field label="From">
            <input
              name="from"
              type="date"
              defaultValue={selection.kind === 'custom' ? selection.from : today}
            />
          </Field>
          <Field label="To">
            <input
              name="to"
              type="date"
              defaultValue={selection.kind === 'custom' ? selection.to : today}
            />
          </Field>
        </>
      ) : null}

      {range === 'year' ? (
        <Field label="Year">
          <input
            name="year"
            type="number"
            inputMode="numeric"
            min="2000"
            max="9999"
            defaultValue={'year' in selection ? selection.year : today.slice(0, 4)}
          />
        </Field>
      ) : null}

      {/* Year to date needs nothing else, so it says so rather than showing gaps. */}
      {range === 'ytd' ? (
        <p className="self-center text-sm text-ink-muted">
          From 1 January {today.slice(0, 4)} until today.
        </p>
      ) : null}

      <button className={SUBMIT_CLASS} type="submit">View report</button>
    </form>
  );
}
