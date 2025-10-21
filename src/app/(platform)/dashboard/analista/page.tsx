export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

import Link from 'next/link';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getCurrentProfile } from '@/lib/auth/roles';
import { getCases } from '@/lib/actions/cases';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatDate } from '@/lib/utils';
import LogoutButton from '@/components/LogoutButton'; // <- default import
import type { Case } from '@/lib/supabase/types';

export const metadata: Metadata = {
  title: 'Panel de Analista - Xel Chile',
  description: 'Centraliza la información inicial de los casos y su asignación.',
};

export default async function AnalystDashboardPage() {
  const profile = await getCurrentProfile();
  if (!profile) {
    redirect('/login?redirectTo=/dashboard/analista');
  }

  if (profile.role === 'admin_firma') {
    redirect('/dashboard/admin');
  }
  if (profile.role !== 'analista') {
    redirect('/dashboard/abogado');
  }

  const casesResult = await getCases({ limit: 20, page: 1 });
  const cases: Case[] = casesResult.cases ?? [];
  const success = casesResult.success;

  return (
    <div className='min-h-screen bg-gray-50'>
      <div className='border-b bg-white'>
        <div className='max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between'>
          <div>
            <h1 className='text-2xl font-semibold text-gray-900'>Panel de analista</h1>
            <p className='text-sm text-gray-500'>Centraliza la información inicial de los casos y coordina su asignación.</p>
          </div>
          <div className='flex gap-2'>
            <Button asChild>
              <Link href='/cases/new'>Nuevo caso</Link>
            </Button>
            <Button variant='outline' asChild>
              <Link href='/cases'>Ver todos los casos</Link>
            </Button>
            <LogoutButton />
          </div>
        </div>
      </div>

      <div className='max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6'>
        <Card>
          <CardHeader>
            <CardTitle>Flujo de trabajo recomendado</CardTitle>
          </CardHeader>
          <CardContent className='space-y-3 text-sm text-gray-600'>
            <p>1. Recopila la información inicial solicitada y verifica documentación clave.</p>
            <p>2. Asigna el caso a un abogado responsable y vincula al cliente principal antes de validar.</p>
            <p>3. Al validar, se notifica automáticamente al abogado y al cliente con el timeline civil sugerido.</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className='flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between'>
            <CardTitle>Casos en preparación</CardTitle>
            <Badge variant='secondary'>Total: {cases.length}</Badge>
          </CardHeader>
          <CardContent>
            {success && cases.length > 0 ? (
              <ul className='divide-y divide-gray-200'>
                {cases.map((caseItem) => (
                  <li key={caseItem.id} className='py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3'>
                    <div>
                      <p className='font-medium text-gray-900'>{caseItem.caratulado}</p>
                      <p className='text-sm text-gray-500'>Cliente: {caseItem.nombre_cliente}</p>
                      <div className='mt-1 flex flex-wrap items-center gap-2 text-xs'>
                        {caseItem.materia && <Badge variant='outline'>{caseItem.materia}</Badge>}
                        <Badge variant={caseItem.workflow_state === 'preparacion' ? 'secondary' : 'default'}>
                          {caseItem.workflow_state ? caseItem.workflow_state.replace('_', ' ') : 'preparación'}
                        </Badge>
                        {caseItem.created_at && (
                          <span className='text-gray-400'>Creado el {formatDate(caseItem.created_at)}</span>
                        )}
                      </div>
                    </div>
                    <div className='flex items-center gap-2'>
                      <Button variant='outline' size='sm' asChild>
                        <Link href={`/cases/${caseItem.id}`}>Ver detalle</Link>
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <div className='text-center py-10 text-gray-500'>
                <p className='font-medium text-gray-600'>No tienes casos pendientes de validación.</p>
                <p className='text-sm'>Crea un nuevo caso para iniciar la revisión y generar el timeline.</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}