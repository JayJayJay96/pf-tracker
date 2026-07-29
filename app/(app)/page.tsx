import { redirect } from 'next/navigation';

import { getCalendarMonth, type ISODate } from '../../src/domain/periods';
import { getDashboardSummary } from '../../src/features/dashboard/queries';
import { createDashboardRepository } from '../../src/features/dashboard/supabase-repository';
import { SummaryView } from '../../src/features/dashboard/summary-view';
import { getCurrentUserId } from '../../src/lib/auth/current-user';
import { ensureMonthlyPlan } from '../../src/lib/supabase/monthly-plan';
import { createClient } from '../../src/lib/supabase/server';

export const metadata = {
  title: 'Dashboard',
};

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

function currentDate(): ISODate {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kuala_Lumpur',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date()) as ISODate;
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
  // Recurring items must exist as entries for this month before the summary is
  // read, or a freshly opened month reports RM0.00 until Generate is pressed.
  await ensureMonthlyPlan(client, periodStart);
  const summary = await getDashboardSummary(
    createDashboardRepository(client),
    userId,
    periodStart,
    currentDate(),
  );

  return (
    <SummaryView
      periodStart={periodStart}
      summary={summary}
      snapshotCount={summary.snapshotCount}
      hasSnapshots={summary.hasSnapshots}
    />
  );
}
