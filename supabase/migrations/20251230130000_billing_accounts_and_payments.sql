BEGIN;

-- ---------------------------------------------------------------------------
-- Cobros / honorarios separados del expediente.
-- Objetivo: gestionar cobros en una entidad independiente y vinculable a uno o varios casos.
-- ---------------------------------------------------------------------------

CREATE TYPE public.billing_status AS ENUM ('pendiente', 'parcial', 'pagado', 'vencido');

CREATE TABLE IF NOT EXISTS public.billing_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  currency TEXT NOT NULL DEFAULT 'UF',
  amount_total NUMERIC(15,2) NOT NULL DEFAULT 0,
  amount_paid NUMERIC(15,2) NOT NULL DEFAULT 0,
  status public.billing_status NOT NULL DEFAULT 'pendiente',
  due_date DATE,
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT billing_accounts_currency_check CHECK (currency IN ('UF', 'CLP', 'USD')),
  CONSTRAINT billing_accounts_amount_total_nonnegative CHECK (amount_total >= 0),
  CONSTRAINT billing_accounts_amount_paid_nonnegative CHECK (amount_paid >= 0)
);

CREATE TABLE IF NOT EXISTS public.billing_account_cases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  billing_account_id UUID NOT NULL REFERENCES public.billing_accounts(id) ON DELETE CASCADE,
  case_id UUID NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
  case_amount NUMERIC(15,2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT billing_account_cases_unique UNIQUE (billing_account_id, case_id),
  CONSTRAINT billing_account_cases_amount_nonnegative CHECK (case_amount IS NULL OR case_amount >= 0)
);

CREATE INDEX IF NOT EXISTS billing_account_cases_account_idx ON public.billing_account_cases(billing_account_id);
CREATE INDEX IF NOT EXISTS billing_account_cases_case_idx ON public.billing_account_cases(case_id);

CREATE TABLE IF NOT EXISTS public.billing_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  billing_account_id UUID NOT NULL REFERENCES public.billing_accounts(id) ON DELETE CASCADE,
  amount NUMERIC(15,2) NOT NULL,
  paid_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  method TEXT,
  notes TEXT,
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT billing_payments_amount_positive CHECK (amount > 0)
);

CREATE INDEX IF NOT EXISTS billing_payments_account_idx ON public.billing_payments(billing_account_id);
CREATE INDEX IF NOT EXISTS billing_payments_paid_at_idx ON public.billing_payments(paid_at DESC);

-- Recalcula monto pagado y estado en base a pagos + vencimiento.
CREATE OR REPLACE FUNCTION public.recompute_billing_account_totals(account_uuid UUID)
RETURNS VOID AS $$
DECLARE
  total_paid NUMERIC(15,2);
  total_amount NUMERIC(15,2);
  due DATE;
BEGIN
  SELECT COALESCE(SUM(p.amount), 0) INTO total_paid
  FROM public.billing_payments p
  WHERE p.billing_account_id = account_uuid;

  SELECT a.amount_total, a.due_date INTO total_amount, due
  FROM public.billing_accounts a
  WHERE a.id = account_uuid;

  UPDATE public.billing_accounts
    SET amount_paid = total_paid,
        status = CASE
          WHEN total_amount IS NULL OR total_amount <= 0 THEN 'pendiente'::public.billing_status
          WHEN due IS NOT NULL AND due < CURRENT_DATE AND total_paid < total_amount THEN 'vencido'::public.billing_status
          WHEN total_paid >= total_amount THEN 'pagado'::public.billing_status
          WHEN total_paid > 0 THEN 'parcial'::public.billing_status
          ELSE 'pendiente'::public.billing_status
        END,
        updated_at = NOW()
  WHERE id = account_uuid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.trg_billing_payments_recompute()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM public.recompute_billing_account_totals(COALESCE(NEW.billing_account_id, OLD.billing_account_id));
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_billing_payments_recompute ON public.billing_payments;
CREATE TRIGGER trg_billing_payments_recompute
  AFTER INSERT OR UPDATE OR DELETE ON public.billing_payments
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_billing_payments_recompute();

CREATE OR REPLACE FUNCTION public.trg_billing_accounts_recompute()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM public.recompute_billing_account_totals(NEW.id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_billing_accounts_recompute ON public.billing_accounts;
CREATE TRIGGER trg_billing_accounts_recompute
  AFTER INSERT OR UPDATE OF amount_total, due_date ON public.billing_accounts
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_billing_accounts_recompute();

-- ------------------------------- RLS Policies ------------------------------
ALTER TABLE public.billing_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_account_cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_payments ENABLE ROW LEVEL SECURITY;

-- billing_accounts: visible si está vinculado a un caso accesible (admin ve todo).
CREATE POLICY "Billing accounts: select for linked cases" ON public.billing_accounts
  FOR SELECT USING (
    is_admin() OR EXISTS (
      SELECT 1
      FROM public.billing_account_cases bac
      WHERE bac.billing_account_id = billing_accounts.id
        AND has_case_access(bac.case_id)
    )
  );

CREATE POLICY "Billing accounts: staff can insert" ON public.billing_accounts
  FOR INSERT WITH CHECK (is_admin() OR is_abogado() OR is_analista());

CREATE POLICY "Billing accounts: staff can update linked" ON public.billing_accounts
  FOR UPDATE USING (
    is_admin() OR EXISTS (
      SELECT 1
      FROM public.billing_account_cases bac
      WHERE bac.billing_account_id = billing_accounts.id
        AND has_case_access(bac.case_id)
    )
  );

CREATE POLICY "Billing accounts: staff can delete linked" ON public.billing_accounts
  FOR DELETE USING (
    is_admin() OR EXISTS (
      SELECT 1
      FROM public.billing_account_cases bac
      WHERE bac.billing_account_id = billing_accounts.id
        AND has_case_access(bac.case_id)
    )
  );

-- billing_account_cases: staff gestiona solo en casos accesibles.
CREATE POLICY "Billing links: select for case access" ON public.billing_account_cases
  FOR SELECT USING (has_case_access(case_id));

CREATE POLICY "Billing links: staff insert for case access" ON public.billing_account_cases
  FOR INSERT WITH CHECK ((is_admin() OR is_abogado() OR is_analista()) AND has_case_access(case_id));

CREATE POLICY "Billing links: staff update for case access" ON public.billing_account_cases
  FOR UPDATE USING ((is_admin() OR is_abogado() OR is_analista()) AND has_case_access(case_id));

CREATE POLICY "Billing links: staff delete for case access" ON public.billing_account_cases
  FOR DELETE USING ((is_admin() OR is_abogado() OR is_analista()) AND has_case_access(case_id));

-- billing_payments: visible y editable si el usuario tiene acceso a algún caso vinculado al cobro.
CREATE POLICY "Billing payments: select for linked cases" ON public.billing_payments
  FOR SELECT USING (
    is_admin() OR EXISTS (
      SELECT 1
      FROM public.billing_account_cases bac
      WHERE bac.billing_account_id = billing_payments.billing_account_id
        AND has_case_access(bac.case_id)
    )
  );

CREATE POLICY "Billing payments: staff insert for linked cases" ON public.billing_payments
  FOR INSERT WITH CHECK (
    (is_admin() OR is_abogado() OR is_analista()) AND EXISTS (
      SELECT 1
      FROM public.billing_account_cases bac
      WHERE bac.billing_account_id = billing_payments.billing_account_id
        AND has_case_access(bac.case_id)
    )
  );

CREATE POLICY "Billing payments: staff update for linked cases" ON public.billing_payments
  FOR UPDATE USING (
    (is_admin() OR is_abogado() OR is_analista()) AND EXISTS (
      SELECT 1
      FROM public.billing_account_cases bac
      WHERE bac.billing_account_id = billing_payments.billing_account_id
        AND has_case_access(bac.case_id)
    )
  );

CREATE POLICY "Billing payments: staff delete for linked cases" ON public.billing_payments
  FOR DELETE USING (
    (is_admin() OR is_abogado() OR is_analista()) AND EXISTS (
      SELECT 1
      FROM public.billing_account_cases bac
      WHERE bac.billing_account_id = billing_payments.billing_account_id
        AND has_case_access(bac.case_id)
    )
  );

COMMIT;

