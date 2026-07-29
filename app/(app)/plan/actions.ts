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
import { type FormResult, toFormResult } from '../../../src/features/forms/result';
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
    finalMonth: readString(formData, 'finalMonth'),
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

/** Reports the outcome in the form instead of throwing into the error boundary. */
async function submit(
  run: () => Promise<void>,
  revalidate: () => void,
  fallbackMessage: string,
): Promise<FormResult> {
  const result = await toFormResult(run, fallbackMessage);
  if (result.status === 'success') {
    revalidate();
  }
  return result;
}

export async function createTemplateAction(
  _previous: FormResult,
  formData: FormData,
): Promise<FormResult> {
  const { repository, userId } = await authorizedPlanContext();
  return submit(
    // The item starts applying from the month being viewed.
    () => createPlanTemplate(
      repository,
      userId,
      readTemplateInput(formData),
      readString(formData, 'periodStart'),
    ),
    () => revalidatePath('/plan'),
    'That recurring item could not be saved.',
  );
}

export async function updateTemplateAction(
  _previous: FormResult,
  formData: FormData,
): Promise<FormResult> {
  const { repository, userId } = await authorizedPlanContext();
  return submit(
    () => updatePlanTemplate(
      repository,
      userId,
      readString(formData, 'templateId'),
      readTemplateInput(formData),
    ),
    () => {
      revalidatePath('/plan');
      revalidatePath('/');
    },
    'That recurring item could not be saved.',
  );
}

export async function archiveTemplateAction(
  _previous: FormResult,
  formData: FormData,
): Promise<FormResult> {
  const { repository, userId } = await authorizedPlanContext();
  return submit(
    () => archivePlanTemplate(repository, userId, readString(formData, 'templateId')),
    () => revalidatePath('/plan'),
    'That item could not be archived.',
  );
}

export async function generateMonthAction(
  _previous: FormResult,
  formData: FormData,
): Promise<FormResult> {
  const { client } = await authorizedPlanContext();
  return submit(
    async () => {
      await generateMonthlyPlan(client, {
        periodStart: readString(formData, 'periodStart'),
      });
    },
    () => {
      revalidatePath('/plan');
      revalidatePath('/');
    },
    'That month could not be generated.',
  );
}

export async function updateEntryAction(
  _previous: FormResult,
  formData: FormData,
): Promise<FormResult> {
  const { repository, userId } = await authorizedPlanContext();
  return submit(
    () => updatePlanEntry(
      repository,
      userId,
      readString(formData, 'entryId'),
      readEntryInput(formData),
    ),
    () => {
      revalidatePath('/plan');
      revalidatePath('/');
      revalidatePath('/reports');
    },
    'That entry could not be saved.',
  );
}
