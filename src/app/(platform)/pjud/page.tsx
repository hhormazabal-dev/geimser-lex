import { redirect } from 'next/navigation';
import { getCurrentProfile } from '@/lib/auth/roles';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PjudCausesLookup } from '@/components/pjud/PjudCausesLookup';

export default async function PjudPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect('/login');

  if (profile.role === 'cliente') {
    redirect('/dashboard/cliente');
  }

  return (
    <div className="space-y-6">
      <Card className="border-white/20 bg-white/60">
        <CardHeader>
          <CardTitle>PJUD · Causas por RUT</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-foreground/70">
            Consulta las causas asociadas a un RUT usando el buscador de la Oficina Judicial Virtual.
          </p>
        </CardContent>
      </Card>

      <PjudCausesLookup />
    </div>
  );
}

