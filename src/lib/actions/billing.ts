'use server';

import { revalidatePath } from 'next/cache';
import { createServerClient } from '@/lib/supabase/server';
import { requireAuth } from '@/lib/auth/roles';
import {
  addBillingPaymentSchema,
  createBillingAccountSchema,
  type AddBillingPaymentInput,
  type CreateBillingAccountInput,
} from '@/lib/validators/billing';

export type BillingAccountSummary = {
  id: string;
  title: string;
  currency: string;
  amount_total: number;
  amount_paid: number;
  status: string;
  due_date: string | null;
  updated_at: string;
  cases: Array<{ id: string; caratulado: string; numero_causa: string | null; case_amount: number | null }>;
};

export type BillingAccountDetail = BillingAccountSummary & {
  description: string | null;
  payments: Array<{
    id: string;
    amount: number;
    paid_at: string;
    method: string | null;
    notes: string | null;
    created_at: string;
  }>;
};

const toNumber = (value: unknown) => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return 0;
};

export async function listBillingAccounts(): Promise<{ success: boolean; accounts: BillingAccountSummary[]; error?: string }> {
  try {
    await requireAuth();
    const supabase = await createServerClient();

    const { data, error } = await supabase
      .from('billing_accounts')
      .select(
        `
          id,
          title,
          currency,
          amount_total,
          amount_paid,
          status,
          due_date,
          updated_at,
          links:billing_account_cases(
            case_id,
            case_amount,
            case:cases(id, caratulado, numero_causa)
          )
        `,
      )
      .order('updated_at', { ascending: false });

    if (error) throw error;

    const accounts: BillingAccountSummary[] = (data ?? []).map((row: any) => ({
      id: row.id,
      title: row.title,
      currency: row.currency ?? 'UF',
      amount_total: toNumber(row.amount_total),
      amount_paid: toNumber(row.amount_paid),
      status: row.status ?? 'pendiente',
      due_date: row.due_date ?? null,
      updated_at: row.updated_at ?? row.created_at ?? new Date().toISOString(),
      cases: (row.links ?? [])
        .map((link: any) => {
          const caseRow = link.case ?? null;
          if (!caseRow?.id) return null;
          return {
            id: caseRow.id,
            caratulado: caseRow.caratulado ?? 'Caso',
            numero_causa: caseRow.numero_causa ?? null,
            case_amount: link.case_amount ?? null,
          };
        })
        .filter(Boolean),
    }));

    return { success: true, accounts };
  } catch (error) {
    console.error('[billing] listBillingAccounts error', error);
    return { success: false, accounts: [], error: (error as Error).message };
  }
}

export async function getBillingAccountById(
  billingAccountId: string,
): Promise<{ success: boolean; account?: BillingAccountDetail; error?: string }> {
  try {
    await requireAuth();
    const supabase = await createServerClient();

    const { data, error } = await supabase
      .from('billing_accounts')
      .select(
        `
          id,
          title,
          description,
          currency,
          amount_total,
          amount_paid,
          status,
          due_date,
          updated_at,
          links:billing_account_cases(
            case_id,
            case_amount,
            case:cases(id, caratulado, numero_causa)
          ),
          payments:billing_payments(
            id,
            amount,
            paid_at,
            method,
            notes,
            created_at
          )
        `,
      )
      .eq('id', billingAccountId)
      .single();

    if (error) throw error;

    const payments = (data as any)?.payments ?? [];
    payments.sort((a: any, b: any) => String(b.paid_at ?? '').localeCompare(String(a.paid_at ?? '')));

    const account: BillingAccountDetail = {
      id: (data as any).id,
      title: (data as any).title,
      description: (data as any).description ?? null,
      currency: (data as any).currency ?? 'UF',
      amount_total: toNumber((data as any).amount_total),
      amount_paid: toNumber((data as any).amount_paid),
      status: (data as any).status ?? 'pendiente',
      due_date: (data as any).due_date ?? null,
      updated_at: (data as any).updated_at ?? new Date().toISOString(),
      cases: ((data as any).links ?? [])
        .map((link: any) => {
          const caseRow = link.case ?? null;
          if (!caseRow?.id) return null;
          return {
            id: caseRow.id,
            caratulado: caseRow.caratulado ?? 'Caso',
            numero_causa: caseRow.numero_causa ?? null,
            case_amount: link.case_amount ?? null,
          };
        })
        .filter(Boolean),
      payments: payments.map((p: any) => ({
        id: p.id,
        amount: toNumber(p.amount),
        paid_at: p.paid_at,
        method: p.method ?? null,
        notes: p.notes ?? null,
        created_at: p.created_at ?? p.paid_at ?? new Date().toISOString(),
      })),
    };

    return { success: true, account };
  } catch (error) {
    console.error('[billing] getBillingAccountById error', error);
    return { success: false, error: (error as Error).message };
  }
}

export async function createBillingAccount(input: CreateBillingAccountInput) {
  try {
    const profile = await requireAuth(['admin_firma', 'abogado', 'analista']);
    const validated = createBillingAccountSchema.parse(input);
    const supabase = await createServerClient();

    const { data: account, error: accountError } = await supabase
      .from('billing_accounts')
      .insert({
        title: validated.title,
        description: validated.description?.trim() ? validated.description.trim() : null,
        currency: validated.currency,
        amount_total: validated.amount_total,
        due_date: validated.due_date ?? null,
        created_by: profile.id,
      })
      .select('id')
      .single();

    if (accountError) throw accountError;
    if (!account?.id) throw new Error('No se pudo crear el cobro.');

    const allocations = validated.allocations ?? {};
    const links = validated.case_ids.map((caseId) => ({
      billing_account_id: account.id,
      case_id: caseId,
      case_amount: allocations[caseId] ?? null,
    }));

    const { error: linksError } = await supabase.from('billing_account_cases').insert(links);
    if (linksError) throw linksError;

    revalidatePath('/billing');
    for (const caseId of validated.case_ids) revalidatePath(`/cases/${caseId}`);

    return { success: true as const, id: account.id as string };
  } catch (error) {
    console.error('[billing] createBillingAccount error', error);
    return { success: false as const, error: (error as Error).message };
  }
}

export async function addBillingPayment(input: AddBillingPaymentInput) {
  try {
    const profile = await requireAuth(['admin_firma', 'abogado', 'analista']);
    const validated = addBillingPaymentSchema.parse(input);
    const supabase = await createServerClient();

    const { data: payment, error } = await supabase
      .from('billing_payments')
      .insert({
        billing_account_id: validated.billing_account_id,
        amount: validated.amount,
        paid_at: validated.paid_at ?? new Date().toISOString(),
        method: validated.method?.trim() ? validated.method.trim() : null,
        notes: validated.notes?.trim() ? validated.notes.trim() : null,
        created_by: profile.id,
      })
      .select('id')
      .single();

    if (error) throw error;

    revalidatePath('/billing');
    revalidatePath(`/billing/${validated.billing_account_id}`);

    return { success: true as const, id: payment?.id as string };
  } catch (error) {
    console.error('[billing] addBillingPayment error', error);
    return { success: false as const, error: (error as Error).message };
  }
}

