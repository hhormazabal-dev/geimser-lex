export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { getCurrentProfile } from '@/lib/auth/roles';
import { getClientDetail } from '@/lib/actions/analytics';
import { formatDate, getInitials, stringToColor } from '@/lib/utils';
import { ArrowLeft, ArrowUpRight, Briefcase, Calendar, Users } from 'lucide-react';

function classifyClientType(name?: string | null) {
  const value = (name ?? '').toUpperCase();
  if (/\b(S\.?A\.?|SPA|LTDA|E\.?I\.?R\.?L\.?|S\.?P\.?A\.?|FUNDACION|CORPORACION)\b/.test(value)) {
    return 'Empresa';
  }
  return 'Persona';
}

export default async function AdminClientDetailPage({
  params,
}: {
  params: Promise<{ clientId: string }>;
}) {
  const { clientId } = await params;
  const profile = await getCurrentProfile();

  if (!profile) {
    redirect(`/login?redirectTo=/dashboard/admin/clients/${encodeURIComponent(clientId)}`);
  }
  if (profile.role !== 'admin_firma') {
    redirect('/dashboard/admin');
  }

  const result = await getClientDetail(clientId);
  if (!result.success || !result.data) {
    notFound();
  }

  const { client, stats, lawyers, cases } = result.data;
  const clientType = classifyClientType(client.nombre);

  return (
    <div className='min-h-screen bg-transparent text-slate-900'>
      <div className='mx-auto flex w-full max-w-[1600px] flex-col gap-8 px-4 pb-12 pt-6 sm:px-6 lg:px-8'>
        <header className='space-y-3'>
          <div className='flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between'>
            <div className='flex items-center gap-3'>
              <Button asChild variant='outline' className='rounded-full border-slate-200 bg-white/80'>
                <Link href='/dashboard/admin/clients'>
                  <ArrowLeft className='mr-2 h-4 w-4' />
                  Volver
                </Link>
              </Button>
              <div className='flex items-center gap-3'>
                <div
                  className='flex h-11 w-11 items-center justify-center rounded-full text-white font-semibold'
                  style={{ backgroundColor: stringToColor(client.nombre ?? 'Cliente') }}
                >
                  {getInitials(client.nombre ?? 'CL')}
                </div>
                <div>
                  <p className='text-[11px] uppercase tracking-[0.25em] text-slate-400'>Cliente</p>
                  <div className='flex flex-wrap items-center gap-2'>
                    <h1 className='text-2xl font-semibold tracking-tight'>{client.nombre ?? 'Cliente sin nombre'}</h1>
                    <Badge variant='outline' className='border-slate-200 text-slate-600'>
                      {clientType}
                    </Badge>
                    {client.rut && (
                      <Badge variant='outline' className='border-slate-200 text-slate-600'>
                        {client.rut}
                      </Badge>
                    )}
                  </div>
                  <p className='text-sm text-slate-500'>
                    {client.email ?? 'Sin correo'} {client.telefono ? `· ${client.telefono}` : ''}
                  </p>
                </div>
              </div>
            </div>
            <Button asChild className='w-fit rounded-full bg-slate-900 text-white hover:bg-slate-800'>
              <Link href='/cases'>
                Ir a casos <ArrowUpRight className='ml-2 h-4 w-4' />
              </Link>
            </Button>
          </div>
        </header>

        <section className='grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4'>
          {[
            { label: 'Casos totales', value: stats.totalCases, icon: <Briefcase className='h-4 w-4' /> },
            { label: 'Casos activos', value: stats.activeCases, icon: <Briefcase className='h-4 w-4' /> },
            { label: 'Vencimientos atrasados', value: stats.overdueStages, icon: <Calendar className='h-4 w-4' /> },
            { label: 'Abogados patrocinantes', value: stats.totalLawyers, icon: <Users className='h-4 w-4' /> },
          ].map((item) => (
            <Card key={item.label} className='rounded-3xl border border-slate-100 bg-white/80 backdrop-blur-xl shadow-sm'>
              <CardContent className='p-6'>
                <p className='text-xs uppercase tracking-[0.18em] text-slate-500'>{item.label}</p>
                <div className='mt-3 flex items-center justify-between'>
                  <p className='text-3xl font-semibold text-slate-900'>{item.value}</p>
                  <div className='rounded-2xl border border-slate-100 bg-slate-50 p-2 text-slate-600'>{item.icon}</div>
                </div>
              </CardContent>
            </Card>
          ))}
        </section>

        <section className='grid grid-cols-1 gap-6 lg:grid-cols-3'>
          <Card className='rounded-3xl border border-slate-100 bg-white/80 backdrop-blur-xl shadow-sm lg:col-span-1'>
            <CardHeader>
              <CardTitle className='flex items-center justify-between gap-3'>
                <span className='flex items-center gap-2'>
                  <Users className='h-5 w-5 text-slate-600' />
                  Abogados
                </span>
                <Badge variant='outline' className='border-slate-200 text-slate-600'>
                  {lawyers.length}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {lawyers.length === 0 ? (
                <p className='text-sm text-slate-500'>Aún no hay abogados patrocinantes asignados a casos de este cliente.</p>
              ) : (
                <div className='space-y-2'>
                  {lawyers.map((lawyer) => (
                    <Link
                      key={lawyer.id}
                      href={`/dashboard/admin/lawyers/${lawyer.id}`}
                      className='flex items-center justify-between rounded-2xl border border-slate-100 bg-white px-4 py-3 transition hover:bg-slate-50'
                    >
                      <div className='space-y-1'>
                        <p className='text-sm font-semibold text-slate-900'>{lawyer.nombre ?? 'Abogado'}</p>
                        <p className='text-xs text-slate-500'>
                          {lawyer.activeCases} activos · {lawyer.totalCases} total
                        </p>
                      </div>
                      <ArrowUpRight className='h-4 w-4 text-slate-400' />
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className='rounded-3xl border border-slate-100 bg-white/80 backdrop-blur-xl shadow-sm lg:col-span-2'>
            <CardHeader>
              <CardTitle className='flex items-center justify-between gap-3'>
                <span className='flex items-center gap-2'>
                  <Briefcase className='h-5 w-5 text-slate-600' />
                  Casos
                </span>
                <Badge variant='outline' className='border-slate-200 text-slate-600'>
                  {cases.length}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {cases.length === 0 ? (
                <p className='text-sm text-slate-500'>Este cliente todavía no tiene casos asociados.</p>
              ) : (
                <div className='space-y-2'>
                  {cases.map((caseItem) => (
                    <Link
                      key={caseItem.id}
                      href={`/cases/${caseItem.id}`}
                      className='flex flex-col gap-2 rounded-2xl border border-slate-100 bg-white px-4 py-3 transition hover:bg-slate-50 sm:flex-row sm:items-center sm:justify-between'
                    >
                      <div className='space-y-1'>
                        <p className='text-sm font-semibold text-slate-900'>{caseItem.caratulado}</p>
                        <p className='text-xs text-slate-500'>
                          {caseItem.abogado_responsable?.nombre ?? 'Sin abogado'}
                          {' · '}
                          {caseItem.etapa_actual ?? 'Etapa sin definir'}
                          {caseItem.fecha_inicio ? ` · Inicio ${formatDate(caseItem.fecha_inicio)}` : ''}
                        </p>
                        {caseItem.nextStage ? (
                          <p className={`text-xs ${caseItem.nextStage.isOverdue ? 'text-red-600' : 'text-slate-500'}`}>
                            Próxima etapa: {caseItem.nextStage.etapa}
                            {caseItem.nextStage.fecha_programada ? ` · ${formatDate(caseItem.nextStage.fecha_programada)}` : ''}
                            {caseItem.nextStage.isOverdue ? ' (atrasada)' : ''}
                          </p>
                        ) : (
                          <p className='text-xs text-emerald-700'>No hay etapas pendientes</p>
                        )}
                      </div>
                      <div className='flex flex-wrap items-center gap-2'>
                        {caseItem.prioridad && (
                          <Badge variant='outline' className='border-slate-200 text-slate-600'>
                            {caseItem.prioridad}
                          </Badge>
                        )}
                        {caseItem.estado && (
                          <Badge variant='outline' className='border-slate-200 text-slate-600'>
                            {caseItem.estado}
                          </Badge>
                        )}
                        {caseItem.overdueStages > 0 && (
                          <Badge className='border border-red-100 bg-red-50 text-red-700'>
                            {caseItem.overdueStages} atrasada(s)
                          </Badge>
                        )}
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </section>
      </div>
    </div>
  );
}

