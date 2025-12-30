import { redirect } from 'next/navigation';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { PageHeader } from '@/components/layout/PageHeader';
import { getCurrentProfile } from '@/lib/auth/roles';
import { COMPLIANCE_SOURCES } from '@/lib/compliance/sources';
import { ComplianceDiscoveryClient } from '@/app/(platform)/compliance/ComplianceDiscoveryClient';
import { ShieldCheck } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function CompliancePage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect('/login');

  if (profile.role === 'cliente') {
    redirect('/dashboard/cliente');
  }

  const chileCompraConfigured = Boolean(process.env.CHILECOMPRA_TICKET?.trim());

  return (
    <div className="space-y-8 pb-12">
      <PageHeader
        eyebrow="Compliance"
        title="Monitoreo y Fuentes"
        description="Conectores, sujetos por RUT y snapshots para auditoría."
        actions={
          <Button asChild variant="outline">
            <Link href="/cases">Ir a casos</Link>
          </Button>
        }
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5" />
              Monitoreo por caso
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-foreground/60">
              Dentro de cada expediente tienes la tab <span className="font-medium text-foreground">Monitoreo</span> para
              consultar fuentes y guardar snapshots por RUT (clientes/contrapartes).
            </p>
            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary">RLS por organización</Badge>
              <Badge variant="secondary">Snapshots auditables</Badge>
              <Badge variant="secondary">Multi-fuente</Badge>
            </div>
            <Button asChild>
              <Link href="/cases">Abrir expedientes</Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Estado de conectores</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={chileCompraConfigured ? 'default' : 'outline'}>
                ChileCompra {chileCompraConfigured ? 'OK' : 'No configurado'}
              </Badge>
              {!chileCompraConfigured && (
                <span className="text-xs text-foreground/55">Configura `CHILECOMPRA_TICKET` para habilitarlo.</span>
              )}
            </div>
            <div className="space-y-2">
              {COMPLIANCE_SOURCES.map((s) => (
                <div key={s.id} className="rounded-2xl border border-white/20 bg-white/55 px-4 py-3">
                  <p className="text-sm font-semibold text-foreground">{s.name}</p>
                  <p className="mt-1 text-xs text-foreground/55">{s.description}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <ComplianceDiscoveryClient />
    </div>
  );
}

