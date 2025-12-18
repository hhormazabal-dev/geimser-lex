export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { getCurrentProfile } from '@/lib/auth/roles';
import { getClientPortfolioWithLawyers } from '@/lib/actions/analytics';
import { formatDate, getInitials, stringToColor } from '@/lib/utils';
import { ArrowUpRight, Users } from 'lucide-react';

function classifyClientType(name?: string | null) {
  const value = (name ?? '').toUpperCase();
  if (/\b(S\.?A\.?|SPA|LTDA|E\.?I\.?R\.?L\.?|S\.?P\.?A\.?|FUNDACION|CORPORACION)\b/.test(value)) {
    return 'Empresa';
  }
  return 'Persona';
}

export default async function AdminClientsPortfolioPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect('/login?redirectTo=/dashboard/admin/clients');
  if (profile.role !== 'admin_firma') redirect('/dashboard/admin');

  const result = await getClientPortfolioWithLawyers(250);
  const portfolio = result.success ? result.data ?? [] : [];

  const empresas = portfolio.filter((item) => classifyClientType(item.client.nombre) === 'Empresa');
  const personas = portfolio.filter((item) => classifyClientType(item.client.nombre) === 'Persona');

  return (
    <div className='min-h-screen bg-transparent text-slate-900'>
      <div className='mx-auto flex w-full max-w-[1600px] flex-col gap-8 px-4 pb-12 pt-6 sm:px-6 lg:px-8'>
        <header className='space-y-2'>
          <p className='text-[11px] uppercase tracking-[0.25em] text-slate-400'>Control administrativo</p>
          <div className='flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between'>
            <div>
              <h1 className='text-2xl font-semibold tracking-tight'>Cartera por cliente</h1>
              <p className='max-w-3xl text-sm leading-relaxed text-slate-600'>
                Visualiza cuántos casos tiene cada cliente y qué abogados patrocinantes los atienden.
              </p>
            </div>
            <Button asChild className='w-fit rounded-full bg-slate-900 text-white hover:bg-slate-800'>
              <Link href='/cases'>
                Ir a casos <ArrowUpRight className='ml-2 h-4 w-4' />
              </Link>
            </Button>
          </div>
        </header>

        {!result.success && (
          <Card className='rounded-3xl border border-red-200 bg-white/80 backdrop-blur-xl shadow-sm'>
            <CardHeader>
              <CardTitle className='text-red-700'>No se pudo cargar la cartera</CardTitle>
            </CardHeader>
            <CardContent>
              <p className='text-sm text-red-600/80'>{result.error ?? 'Intenta nuevamente en unos minutos.'}</p>
            </CardContent>
          </Card>
        )}

        <section className='grid grid-cols-1 gap-6 lg:grid-cols-2'>
          <Card className='rounded-3xl border border-slate-100 bg-white/80 backdrop-blur-xl shadow-sm'>
            <CardHeader>
              <div className='flex items-center justify-between gap-3'>
                <CardTitle className='flex items-center gap-2'>
                  <Users className='h-5 w-5 text-slate-600' />
                  Empresas
                </CardTitle>
                <Badge variant='outline' className='border-slate-200 text-slate-600'>
                  {empresas.length}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className='space-y-3'>
                {empresas.length === 0 ? (
                  <p className='text-sm text-slate-500'>Aún no hay clientes empresa con casos asociados.</p>
                ) : (
                  empresas.map((item) => (
                    <details
                      key={item.client.id}
                      className='group rounded-2xl border border-slate-100 bg-white/80 px-4 py-3'
                    >
                      <summary className='flex cursor-pointer list-none items-start justify-between gap-4'>
                        <div className='flex items-start gap-3'>
                          <div
                            className='flex h-10 w-10 items-center justify-center rounded-full text-white font-medium'
                            style={{ backgroundColor: stringToColor(item.client.nombre ?? 'Cliente') }}
                          >
                            {getInitials(item.client.nombre ?? 'CL')}
                          </div>
                          <div className='space-y-1'>
                            <p className='text-sm font-semibold text-slate-900'>
                              {item.client.nombre ?? 'Cliente sin nombre'}
                            </p>
                            <div className='flex flex-wrap items-center gap-2 text-xs text-slate-500'>
                              {item.client.rut && <span>{item.client.rut}</span>}
                              <Badge variant='outline' className='border-slate-200 text-slate-600'>
                                {item.activeCases} activos
                              </Badge>
                              <Badge variant='outline' className='border-slate-200 text-slate-600'>
                                {item.totalCases} total
                              </Badge>
                              {item.urgentCases > 0 && (
                                <Badge className='border border-red-100 bg-red-50 text-red-700'>
                                  {item.urgentCases} urgentes
                                </Badge>
                              )}
                              {item.inReviewCases > 0 && (
                                <Badge className='border border-amber-100 bg-amber-50 text-amber-700'>
                                  {item.inReviewCases} en revisión
                                </Badge>
                              )}
                            </div>
                          </div>
                        </div>
                        <span className='text-xs font-medium text-slate-400 group-open:hidden'>Ver detalle</span>
                        <span className='text-xs font-medium text-slate-400 hidden group-open:inline'>Ocultar</span>
                      </summary>

                      <div className='mt-4 space-y-4'>
                        <div className='space-y-2'>
                          <p className='text-xs font-semibold uppercase tracking-[0.18em] text-slate-500'>
                            Abogados patrocinantes
                          </p>
                          {item.lawyers && item.lawyers.length > 0 ? (
                            <div className='flex flex-wrap gap-2'>
                              {item.lawyers.map((lawyer) => (
                                <Badge
                                  key={lawyer.id}
                                  variant='outline'
                                  className='border-slate-200 bg-slate-50 text-slate-700'
                                >
                                  {lawyer.nombre ?? 'Abogado'} · {lawyer.totalCases}
                                </Badge>
                              ))}
                            </div>
                          ) : (
                            <p className='text-sm text-slate-500'>Sin abogado patrocinante asignado todavía.</p>
                          )}
                        </div>

                        <div className='space-y-2'>
                          <p className='text-xs font-semibold uppercase tracking-[0.18em] text-slate-500'>Casos</p>
                          <div className='space-y-2'>
                            {item.cases.slice(0, 10).map((caseItem) => (
                              <Link
                                key={caseItem.id}
                                href={`/cases/${caseItem.id}`}
                                className='flex items-center justify-between rounded-2xl border border-slate-100 bg-white px-4 py-3 transition hover:bg-slate-50'
                              >
                                <div className='space-y-1'>
                                  <p className='text-sm font-medium text-slate-900'>{caseItem.caratulado}</p>
                                  <p className='text-xs text-slate-500'>
                                    {caseItem.etapa_actual ?? 'Etapa sin definir'}
                                    {caseItem.fecha_inicio ? ` · Inicio ${formatDate(caseItem.fecha_inicio)}` : ''}
                                  </p>
                                </div>
                                <div className='flex items-center gap-2'>
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
                                </div>
                              </Link>
                            ))}
                            {item.cases.length > 10 && (
                              <p className='text-xs text-slate-500'>
                                Mostrando 10 de {item.cases.length} casos.
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    </details>
                  ))
                )}
              </div>
            </CardContent>
          </Card>

          <Card className='rounded-3xl border border-slate-100 bg-white/80 backdrop-blur-xl shadow-sm'>
            <CardHeader>
              <div className='flex items-center justify-between gap-3'>
                <CardTitle className='flex items-center gap-2'>
                  <Users className='h-5 w-5 text-slate-600' />
                  Personas
                </CardTitle>
                <Badge variant='outline' className='border-slate-200 text-slate-600'>
                  {personas.length}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className='space-y-3'>
                {personas.length === 0 ? (
                  <p className='text-sm text-slate-500'>Aún no hay clientes persona con casos asociados.</p>
                ) : (
                  personas.map((item) => (
                    <details
                      key={item.client.id}
                      className='group rounded-2xl border border-slate-100 bg-white/80 px-4 py-3'
                    >
                      <summary className='flex cursor-pointer list-none items-start justify-between gap-4'>
                        <div className='flex items-start gap-3'>
                          <div
                            className='flex h-10 w-10 items-center justify-center rounded-full text-white font-medium'
                            style={{ backgroundColor: stringToColor(item.client.nombre ?? 'Cliente') }}
                          >
                            {getInitials(item.client.nombre ?? 'CL')}
                          </div>
                          <div className='space-y-1'>
                            <p className='text-sm font-semibold text-slate-900'>
                              {item.client.nombre ?? 'Cliente sin nombre'}
                            </p>
                            <div className='flex flex-wrap items-center gap-2 text-xs text-slate-500'>
                              {item.client.rut && <span>{item.client.rut}</span>}
                              <Badge variant='outline' className='border-slate-200 text-slate-600'>
                                {item.activeCases} activos
                              </Badge>
                              <Badge variant='outline' className='border-slate-200 text-slate-600'>
                                {item.totalCases} total
                              </Badge>
                              {item.urgentCases > 0 && (
                                <Badge className='border border-red-100 bg-red-50 text-red-700'>
                                  {item.urgentCases} urgentes
                                </Badge>
                              )}
                              {item.inReviewCases > 0 && (
                                <Badge className='border border-amber-100 bg-amber-50 text-amber-700'>
                                  {item.inReviewCases} en revisión
                                </Badge>
                              )}
                            </div>
                          </div>
                        </div>
                        <span className='text-xs font-medium text-slate-400 group-open:hidden'>Ver detalle</span>
                        <span className='text-xs font-medium text-slate-400 hidden group-open:inline'>Ocultar</span>
                      </summary>

                      <div className='mt-4 space-y-4'>
                        <div className='space-y-2'>
                          <p className='text-xs font-semibold uppercase tracking-[0.18em] text-slate-500'>
                            Abogados patrocinantes
                          </p>
                          {item.lawyers && item.lawyers.length > 0 ? (
                            <div className='flex flex-wrap gap-2'>
                              {item.lawyers.map((lawyer) => (
                                <Badge
                                  key={lawyer.id}
                                  variant='outline'
                                  className='border-slate-200 bg-slate-50 text-slate-700'
                                >
                                  {lawyer.nombre ?? 'Abogado'} · {lawyer.totalCases}
                                </Badge>
                              ))}
                            </div>
                          ) : (
                            <p className='text-sm text-slate-500'>Sin abogado patrocinante asignado todavía.</p>
                          )}
                        </div>

                        <div className='space-y-2'>
                          <p className='text-xs font-semibold uppercase tracking-[0.18em] text-slate-500'>Casos</p>
                          <div className='space-y-2'>
                            {item.cases.slice(0, 10).map((caseItem) => (
                              <Link
                                key={caseItem.id}
                                href={`/cases/${caseItem.id}`}
                                className='flex items-center justify-between rounded-2xl border border-slate-100 bg-white px-4 py-3 transition hover:bg-slate-50'
                              >
                                <div className='space-y-1'>
                                  <p className='text-sm font-medium text-slate-900'>{caseItem.caratulado}</p>
                                  <p className='text-xs text-slate-500'>
                                    {caseItem.etapa_actual ?? 'Etapa sin definir'}
                                    {caseItem.fecha_inicio ? ` · Inicio ${formatDate(caseItem.fecha_inicio)}` : ''}
                                  </p>
                                </div>
                                <div className='flex items-center gap-2'>
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
                                </div>
                              </Link>
                            ))}
                            {item.cases.length > 10 && (
                              <p className='text-xs text-slate-500'>
                                Mostrando 10 de {item.cases.length} casos.
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    </details>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </section>
      </div>
    </div>
  );
}

