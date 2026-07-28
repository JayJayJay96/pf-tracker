import { redirect } from 'next/navigation';

import { ReportView } from '../../../src/features/reports/report-view';
import {
  getReport,
  previousMonthPeriod,
  resolveReportPeriod,
  type ReportPeriodInput,
} from '../../../src/features/reports/queries';
import { createReportRepository } from '../../../src/features/reports/supabase-repository';
import { getCurrentUserId } from '../../../src/lib/auth/current-user';
import { createClient } from '../../../src/lib/supabase/server';

type ReportsPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function first(value: string | string[] | undefined): string | undefined {
  const selected = Array.isArray(value) ? value[0] : value;
  return selected || undefined;
}

function todayInMalaysia(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kuala_Lumpur',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

function selectionFrom(
  params: Record<string, string | string[] | undefined>,
  today: string,
): ReportPeriodInput {
  const kind = first(params.range);
  if (kind === 'custom') {
    return {
      kind,
      from: first(params.from) ?? today,
      to: first(params.to) ?? today,
    };
  }
  if (kind === 'ytd' || kind === 'year') {
    return { kind, year: first(params.year) ?? today.slice(0, 4) };
  }
  return {
    kind: 'month',
    month: first(params.month) ?? today.slice(0, 7),
  };
}

export default async function ReportsPage({ searchParams }: ReportsPageProps) {
  const params = await searchParams;
  const today = todayInMalaysia();
  const selection = selectionFrom(params, today);
  let period;
  try {
    period = resolveReportPeriod(selection, today);
  } catch {
    period = resolveReportPeriod({ kind: 'month', month: today.slice(0, 7) }, today);
  }
  const client = await createClient();
  const userId = await getCurrentUserId(() => client.auth.getClaims());
  if (!userId) redirect('/auth/sign-in');
  const report = await getReport(
    createReportRepository(client),
    userId,
    period,
    selection.kind === 'month' ? previousMonthPeriod(period) : undefined,
  );
  return <ReportView report={report} selection={selection} today={today} />;
}
