import { redirect } from 'next/navigation';

import { getCalendarMonth, type ISODate } from '../../src/domain/periods';
import { getDashboardSummary } from '../../src/features/dashboard/queries';
import { SummaryView } from '../../src/features/dashboard/summary-view';
import { createPlanRepository } from '../../src/features/plan/supabase-repository';
import { getCurrentUserId } from '../../src/lib/auth/current-user';
import { createClient } from '../../src/lib/supabase/server';

type HomePageProps = {
  searchParams?: Promise<{
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

export default async function HomePage({ searchParams }: HomePageProps = {}) {
  const params = await (searchParams ?? Promise.resolve<{
    month?: string | string[];
  }>({}));
  const periodStart = selectedMonthStart(params.month);
  const client = await createClient();
  const userId = await getCurrentUserId(() => client.auth.getClaims());
  if (!userId) {
    redirect('/auth/sign-in');
  }
  const summary = await getDashboardSummary(
    createPlanRepository(client),
    userId,
    periodStart,
  );

  return (
    <SummaryView periodStart={periodStart} summary={summary} />
  );
}
