import { redirect } from 'next/navigation';

import { getCalendarMonth, type ISODate } from '../../../src/domain/periods';
import { MonthlyPlanView } from '../../../src/features/plan/monthly-plan-view';
import { getMonthlyPlan } from '../../../src/features/plan/queries';
import { createPlanRepository } from '../../../src/features/plan/supabase-repository';
import { getCurrentUserId } from '../../../src/lib/auth/current-user';
import { createClient } from '../../../src/lib/supabase/server';

import {
  archiveTemplateAction,
  createTemplateAction,
  generateMonthAction,
  updateTemplateAction,
  updateEntryAction,
} from './actions';

export const metadata = {
  title: 'Income & Commitments',
};

type MonthlyPlanPageProps = {
  searchParams: Promise<{
    month?: string | string[];
  }>;
};

function currentMonthStart(): ISODate {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kuala_Lumpur',
    year: 'numeric',
    month: '2-digit',
  }).formatToParts(new Date());
  const year = parts.find((part) => part.type === 'year')?.value;
  const month = parts.find((part) => part.type === 'month')?.value;
  return `${year}-${month}-01`;
}

function selectedMonthStart(value: string | string[] | undefined): ISODate {
  const month = Array.isArray(value) ? value[0] : value;
  const candidate = month && /^\d{4}-\d{2}$/.test(month)
    ? `${month}-01`
    : currentMonthStart();
  return getCalendarMonth(candidate).startDate;
}

export default async function MonthlyPlanPage({ searchParams }: MonthlyPlanPageProps) {
  const params = await searchParams;
  const periodStart = selectedMonthStart(params.month);
  const client = await createClient();
  const userId = await getCurrentUserId(() => client.auth.getClaims());
  if (!userId) {
    redirect('/auth/sign-in');
  }
  const plan = await getMonthlyPlan(createPlanRepository(client), userId, periodStart);

  return (
    <MonthlyPlanView
      periodStart={periodStart}
      templates={plan.templates}
      entries={plan.entries}
      actions={{
        create: createTemplateAction,
        update: updateTemplateAction,
        archive: archiveTemplateAction,
        generate: generateMonthAction,
        updateEntry: updateEntryAction,
      }}
    />
  );
}
