export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

import { redirect } from 'next/navigation';
import { getCurrentProfile } from '@/lib/auth/roles';
import { createServerClient } from '@/lib/supabase/server';
import { getDeudaCeroLead } from '@/lib/actions/leads';
import { getAssignableLawyers } from '@/lib/actions/profiles';
import { DeudaCeroLeadDetail } from '@/components/admin/DeudaCeroLeadDetail';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface LeadDetailPageProps {
  params: { id: string };
}

export default async function DeudaCeroLeadDetailPage({ params }: LeadDetailPageProps) {
  const profile = await getCurrentProfile();
  if (!profile) redirect(`/login?redirectTo=/dashboard/admin/leads/${params.id}`);
  if (profile.role !== 'admin_firma') redirect('/dashboard/admin');

  const orgId = (profile as any)?.active_organization_id ?? null;
  if (!orgId) redirect('/select-org');

  const supabase = await createServerClient();
  const { data: orgRow } = await supabase
    .from('organizations')
    .select('id, name')
    .eq('id', orgId)
    .maybeSingle();

  if (!orgRow || String(orgRow.name ?? '').trim().toLowerCase() !== 'deuda cero') {
    redirect('/dashboard/admin');
  }

  const [leadResult, lawyers] = await Promise.all([
    getDeudaCeroLead(params.id),
    getAssignableLawyers(),
  ]);

  if (!leadResult.success || !leadResult.lead) {
    return (
      <Card className="rounded-3xl border border-red-200 bg-white/90 shadow-sm">
        <CardHeader>
          <CardTitle className="text-red-700">Lead no encontrado</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-red-600/80">{leadResult.error ?? 'No se pudo cargar el lead.'}</p>
        </CardContent>
      </Card>
    );
  }

  const lawyerOptions = (lawyers ?? []).map((lawyer) => ({
    id: lawyer.id,
    nombre: lawyer.nombre ?? null,
    email: lawyer.email ?? null,
  }));

  return (
    <div className="min-h-screen bg-transparent">
      <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-8 px-4 pb-12 pt-6 sm:px-6 lg:px-8">
        <DeudaCeroLeadDetail lead={leadResult.lead} lawyers={lawyerOptions} />
      </div>
    </div>
  );
}
