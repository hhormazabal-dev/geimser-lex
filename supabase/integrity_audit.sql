-- Integrity audit for Geimser Lex (Supabase/Postgres)
-- Purpose: detectar asociaciones rotas / cross-org / roles incorrectos.
-- Run with an admin connection (service_role / postgres).
-- Usage (psql): psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/integrity_audit.sql

select '== Geimser Lex · Integrity Audit ==' as _section;
select '' as _section;

select '-- 1) Cross-org inconsistencies (case-linked tables)' as _section;
select 'cases <- case_stages' as _check;
SELECT COUNT(*) AS mismatches
FROM public.case_stages s
JOIN public.cases c ON c.id = s.case_id
WHERE s.organization_id <> c.organization_id;

select 'cases <- notes' as _check;
SELECT COUNT(*) AS mismatches
FROM public.notes n
JOIN public.cases c ON c.id = n.case_id
WHERE n.organization_id <> c.organization_id;

select 'cases <- documents' as _check;
SELECT COUNT(*) AS mismatches
FROM public.documents d
JOIN public.cases c ON c.id = d.case_id
WHERE d.organization_id <> c.organization_id;

select 'cases <- info_requests' as _check;
SELECT COUNT(*) AS mismatches
FROM public.info_requests r
JOIN public.cases c ON c.id = r.case_id
WHERE r.organization_id <> c.organization_id;

select 'cases <- case_clients' as _check;
SELECT COUNT(*) AS mismatches
FROM public.case_clients cc
JOIN public.cases c ON c.id = cc.case_id
WHERE cc.organization_id <> c.organization_id;

select 'cases <- case_collaborators' as _check;
SELECT COUNT(*) AS mismatches
FROM public.case_collaborators coll
JOIN public.cases c ON c.id = coll.case_id
WHERE coll.organization_id <> c.organization_id;

select 'cases <- portal_tokens' as _check;
SELECT COUNT(*) AS mismatches
FROM public.portal_tokens pt
JOIN public.cases c ON c.id = pt.case_id
WHERE pt.organization_id <> c.organization_id;

select 'cases <- magic_links' as _check;
SELECT COUNT(*) AS mismatches
FROM public.magic_links ml
JOIN public.cases c ON c.id = ml.case_id
WHERE ml.organization_id <> c.organization_id;

select 'cases <- case_messages' as _check;
SELECT COUNT(*) AS mismatches
FROM public.case_messages m
JOIN public.cases c ON c.id = m.case_id
WHERE m.organization_id <> c.organization_id;

select 'cases <- case_counterparties' as _check;
SELECT COUNT(*) AS mismatches
FROM public.case_counterparties cp
JOIN public.cases c ON c.id = cp.case_id
WHERE cp.organization_id <> c.organization_id;

select 'cases <- case_lawyer_checklist_items' as _check;
SELECT COUNT(*) AS mismatches
FROM public.case_lawyer_checklist_items cli
JOIN public.cases c ON c.id = cli.case_id
WHERE cli.organization_id <> c.organization_id;

select '' as _section;
select '-- 2) Billing cross-org consistency' as _section;
select 'billing_accounts <- billing_payments' as _check;
SELECT COUNT(*) AS mismatches
FROM public.billing_payments p
JOIN public.billing_accounts a ON a.id = p.billing_account_id
WHERE p.organization_id <> a.organization_id;

select 'billing_accounts/cases <- billing_account_cases' as _check;
SELECT COUNT(*) AS mismatches
FROM public.billing_account_cases bac
JOIN public.billing_accounts a ON a.id = bac.billing_account_id
JOIN public.cases c ON c.id = bac.case_id
WHERE bac.organization_id <> a.organization_id
   OR bac.organization_id <> c.organization_id
   OR a.organization_id <> c.organization_id;

select '' as _section;
select '-- 3) Role/org correctness (high value checks)' as _section;
select 'cases: cliente_principal_id debe ser cliente y misma org' as _check;
SELECT COUNT(*) AS invalid
FROM public.cases c
JOIN public.profiles p ON p.id = c.cliente_principal_id
WHERE c.cliente_principal_id IS NOT NULL
  AND (p.role <> 'cliente' OR p.organization_id <> c.organization_id);

select 'cases: abogado_responsable debe ser abogado y miembro del org del caso' as _check;
SELECT COUNT(*) AS invalid
FROM public.cases c
JOIN public.profiles p ON p.id = c.abogado_responsable
LEFT JOIN public.org_members m
  ON m.organization_id = c.organization_id
 AND m.user_id = p.user_id
WHERE c.abogado_responsable IS NOT NULL
  AND (p.role <> 'abogado' OR m.id IS NULL);

select 'cases: analista_id debe ser analista y miembro del org del caso' as _check;
SELECT COUNT(*) AS invalid
FROM public.cases c
JOIN public.profiles p ON p.id = c.analista_id
LEFT JOIN public.org_members m
  ON m.organization_id = c.organization_id
 AND m.user_id = p.user_id
WHERE c.analista_id IS NOT NULL
  AND (p.role <> 'analista' OR m.id IS NULL);

select 'case_clients: client_profile_id debe ser cliente y misma org del caso' as _check;
SELECT COUNT(*) AS invalid
FROM public.case_clients cc
JOIN public.cases c ON c.id = cc.case_id
JOIN public.profiles p ON p.id = cc.client_profile_id
WHERE p.role <> 'cliente'
   OR p.organization_id <> c.organization_id;

select 'case_collaborators: abogado_id debe ser abogado y miembro del org del caso' as _check;
SELECT COUNT(*) AS invalid
FROM public.case_collaborators coll
JOIN public.cases c ON c.id = coll.case_id
JOIN public.profiles p ON p.id = coll.abogado_id
LEFT JOIN public.org_members m
  ON m.organization_id = c.organization_id
 AND m.user_id = p.user_id
WHERE p.role <> 'abogado'
   OR m.id IS NULL;

select '' as _section;
select '-- 4) Data-quality checks' as _section;
select 'case_clients: (case_id, client_profile_id) duplicados (no debería por UNIQUE, pero valida)' as _check;
SELECT COUNT(*) AS duplicates
FROM (
  SELECT case_id, client_profile_id, COUNT(*) AS n
  FROM public.case_clients
  GROUP BY case_id, client_profile_id
  HAVING COUNT(*) > 1
) t;

select 'case_stages: orden duplicado por caso (solo orden>0)' as _check;
SELECT COUNT(*) AS duplicates
FROM (
  SELECT case_id, orden, COUNT(*) AS n
  FROM public.case_stages
  WHERE orden > 0
  GROUP BY case_id, orden
  HAVING COUNT(*) > 1
) t;

select '' as _section;
select '== Fin Integrity Audit ==' as _section;
