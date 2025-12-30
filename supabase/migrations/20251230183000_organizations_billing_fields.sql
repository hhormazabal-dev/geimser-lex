BEGIN;

-- ---------------------------------------------------------------------------
-- Organizations: SaaS billing/setup fields (for Admin Global dashboard)
-- ---------------------------------------------------------------------------

CREATE EXTENSION IF NOT EXISTS pg_trgm;

ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS billing_currency TEXT NOT NULL DEFAULT 'UF',
  ADD COLUMN IF NOT EXISTS billing_price_per_user NUMERIC(15,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS billing_user_seats INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS billing_monthly_base_fee NUMERIC(15,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS billing_setup_fee NUMERIC(15,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS billing_notes TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'organizations_billing_currency_check'
  ) THEN
    ALTER TABLE public.organizations
      ADD CONSTRAINT organizations_billing_currency_check
      CHECK (billing_currency IN ('UF', 'CLP', 'USD'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'organizations_billing_nonnegative_check'
  ) THEN
    ALTER TABLE public.organizations
      ADD CONSTRAINT organizations_billing_nonnegative_check
      CHECK (
        billing_price_per_user >= 0
        AND billing_user_seats >= 0
        AND billing_monthly_base_fee >= 0
        AND billing_setup_fee >= 0
      );
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS organizations_status_idx ON public.organizations(status);
CREATE INDEX IF NOT EXISTS organizations_name_trgm_idx ON public.organizations USING gin (name gin_trgm_ops);

COMMIT;
