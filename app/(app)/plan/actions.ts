'use server';

import { revalidatePath } from 'next/cache';

import {
  archivePlanTemplate,
  createPlanTemplate,
  updatePlanEntry,
  updatePlanTemplate,
  type PlanEntryInput,
  type PlanTemplateInput,
} from '../../../src/features/plan/actions';
import { createPlanRepository } from '../../../src/features/plan/supabase-repository';
import { requireCurrentUserId } from '../../../src/lib/auth/current-user';
import { generateMonthlyPlan } from '../../../src/lib/supabase/monthly-plan';
import { createClient } from '../../../src/lib/supabase/server';

function readString(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === 'string' ? value : '';
}

function readTemplateInput(formData: FormData): PlanTemplateInput {
  return {
    name: readString(formData, 'name'),
    entryType: readString(formData, 'entryType'),
    amount: readString(formData, 'amount'),
    day: readString(formData, 'day'),
    status: readString(formData, 'status'),
    effectiveStart: readString(formData, 'effectiveStart'),
    effectiveEnd: readString(formData, 'effectiveEnd'),
  };
}

function readEntryInput(formData: FormData): PlanEntryInput {
  return {
    entryType: readString(formData, 'entryType'),
    status: readString(formData, 'status'),
    actualAmount: readString(formData, 'actualAmount'),
    paidDate: readString(formData, 'paidDate'),
    notes: readString(formData, 'notes'),
  };
}

async function authorizedPlanContext() {
  const client = await createClient();
  const userId = await requireCurrentUserId(() => client.auth.getClaims());
  return { client, userId, repository: createPlanRepository(client) };
}

export async function createTemplateAction(formData: FormData): Promise<void> {
  const { repository, userId } = await authorizedPlanContext();
  await createPlanTemplate(repository, userId, readTemplateInput(formData));
  revalidatePath('/plan');
}

export async function updateTemplateAction(formData: FormData): Promise<void> {
  const { repository, userId } = await authorizedPlanContext();
  await updatePlanTemplate(
    repository,
    userId,
    readString(formData, 'templateId'),
    readTemplateInput(formData),
  );
  revalidatePath('/plan');
  revalidatePath('/');
}

export async function archiveTemplateAction(formData: FormData): Promise<void> {
  const { repository, userId } = await authorizedPlanContext();
  await archivePlanTemplate(repository, userId, readString(formData, 'templateId'));
  revalidatePath('/plan');
}

export async function generateMonthAction(formData: FormData): Promise<void> {
  const { client } = await authorizedPlanContext();
  await generateMonthlyPlan(client, {
    periodStart: readString(formData, 'periodStart'),
  });
  revalidatePath('/plan');
  revalidatePath('/');
}

export async function updateEntryAction(formData: FormData): Promise<void> {
  const { repository, userId } = await authorizedPlanContext();
  await updatePlanEntry(
    repository,
    userId,
    readString(formData, 'entryId'),
    readEntryInput(formData),
  );
  revalidatePath('/plan');
  revalidatePath('/');
  revalidatePath('/reports');
}
