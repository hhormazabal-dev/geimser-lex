'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatCurrency, formatDate, formatRelativeTime, getInitials, stringToColor } from '@/lib/utils';
import LogoutButton from '@/components/LogoutButton';
import type { Profile, Case, CaseStage, LegalTemplate, QuickLink } from '@/lib/supabase/types';
import type { DashboardStats, CasesByStatus, CasesByPriority } from '@/lib/actions/analytics';
import { QuickLinksPanel } from '@/components/QuickLinksPanel';
import { TemplateLibrary } from '@/components/TemplateLibrary';
import Link from 'next/link';
import {
  Calendar,
  Clock,
  Briefcase,
  FileText,
  AlertTriangle,
  ArrowRight,
  Target,
} from 'lucide-react';

interface LawyerDashboardProps {
  profile: Profile;
  data: {
    stats: DashboardStats | null;
    casesByStatus: CasesByStatus[];
    casesByPriority: CasesByPriority[];
    upcomingDeadlines: any[];
  };
  cases: (Case & { case_stages?: Pick<CaseStage, 'id' | 'etapa' | 'estado' | 'fecha_programada'>[] })[];
  quickLinks: QuickLink[];
  templates: LegalTemplate[];
}

const statusColors: Record<string, string> = {
  activo: 'bg-emerald-500',
  suspendido: 'bg-amber-500',
  archivado: 'bg-slate-500',
  terminado: 'bg-blue-500',
};

const priorityTone: Record<string, string> = {
  baja: 'text-emerald-400',
  media: 'text-blue-400',
  alta: 'text-orange-400',
  urgente: 'text-red-400',
};

export function LawyerDashboard({ profile, data, cases, quickLinks, templates }: LawyerDashboardProps) {
  const stats = data.stats;

  if (!stats) {
    return (
      <div className="min-h-screen bg-lexser-gray-900 text-white flex items-center justify-center">
        <div className="text-center space-y-3">
          <AlertTriangle className="mx-auto h-12 w-12 text-red-400" />
          <h2 className="text-xl font-semibold">No pudimos cargar tu panel</h2>
          <p className="text-sm text-lexser-gray-300">Intenta refrescar la página o vuelve más tarde.</p>
        </div>
      </div>
    );
  }

  const activeCases = cases.filter((c) => c.estado === 'activo');
  const recentCases = [...cases]
    .sort((a, b) => (b.fecha_inicio || '').localeCompare(a.fecha_inicio || ''))
    .slice(0, 5);
  const deadlines = (data.upcomingDeadlines || []).slice(0, 5);
  const totalStatus = data.casesByStatus.reduce((acc, item) => acc + item.count, 0);

  return (
    <div className="min-h-screen bg-lexser-gray-950 text-white">
      {/* HERO */}
      <section className="bg-gradient-to-br from-lexser-blue-700 via-lexser-blue-800 to-lexser-blue-950">
        <div className="max-w-6xl mx-auto px-6 py-12">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-3">
              <p className="text-sm uppercase tracking-widest text-lexser-blue-200">Bienvenido de vuelta</p>
              <h1 className="text-3xl sm:text-4xl font-semibold">Hola, {profile.nombre.split(' ')[0]}.</h1>
              <p className="text-lexser-blue-100 text-sm sm:text-base max-w-xl">
                Mantén el control de tus casos activos, próximas etapas y solicitudes de tus clientes desde este panel
                simplificado para tu práctica diaria.
              </p>
            </div>

            <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center">
              <div className="flex items-center gap-3 bg-white/10 backdrop-blur-md rounded-2xl px-5 py-4 shadow-lg">
                <div
                  className="h-12 w-12 rounded-full flex items-center justify-center text-white font-semibold"
                  style={{ backgroundColor: stringToColor(profile.nombre) }}
                >
                  {getInitials(profile.nombre)}
                </div>
                <div>
                  <p className="text-sm text-lexser-blue-100">Perfil profesional</p>
                  <p className="text-base font-semibold capitalize">{profile.role.replace('_', ' ')}</p>
                </div>
              </div>

              <LogoutButton />
            </div>
          </div>

          {/* Stats */}
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-2xl border border-white/10 bg-white/10 p-5 shadow-lg">
              <p className="text-xs uppercase tracking-wider text-lexser-blue-100">Casos Activos</p>
              <p className="mt-2 text-3xl font-semibold">{stats.activeCases}</p>
              <span className="mt-2 inline-flex items-center gap-1 text-xs text-lexser-blue-100">
                <Briefcase className="h-4 w-4" />
                Total de {stats.totalCases} casos
              </span>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/10 p-5 shadow-lg">
              <p className="text-xs uppercase tracking-wider text-lexser-blue-100">Solicitudes pendientes</p>
              <p className="mt-2 text-3xl font-semibold">{stats.pendingRequests}</p>
              <span className="mt-2 inline-flex items-center gap-1 text-xs text-lexser-blue-100">
                <Target className="h-4 w-4" />
                Coordina respuestas con tus clientes
              </span>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/10 p-5 shadow-lg">
              <p className="text-xs uppercase tracking-wider text-lexser-blue-100">Etapas próximas</p>
              <p className="mt-2 text-3xl font-semibold">{deadlines.length}</p>
              <span className="mt-2 inline-flex items-center gap-1 text-xs text-lexser-blue-100">
                <Calendar className="h-4 w-4" />
                Próximos 30 días
              </span>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/10 p-5 shadow-lg">
              <p className="text-xs uppercase tracking-wider text-lexser-blue-100">Notas y documentos</p>
              <p className="mt-2 text-3xl font-semibold">{stats.totalDocuments}</p>
              <span className="mt-2 inline-flex items-center gap-1 text-xs text-lexser-blue-100">
                <FileText className="h-4 w-4" />
                {stats.totalNotes} notas recientes
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* MAIN GRID */}
      <section className="max-w-6xl mx-auto px-6 pb-12 -mt-12 space-y-8">
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Casos bajo responsabilidad */}
          <Card className="lg:col-span-2 border-0 shadow-2xl bg-white">
            <CardHeader className="border-b border-lexser-gray-100">
              <CardTitle className="text-lg font-semibold text-lexser-gray-900">
                Casos bajo tu responsabilidad
              </CardTitle>
            </CardHeader>

            <CardContent className="p-6 space-y-4">
              {recentCases.length === 0 ? (
                <div className="text-sm text-lexser-gray-500">No tienes casos asignados aún.</div>
              ) : (
                recentCases.map((caseItem) => {
                  // estado puede ser string | null, por eso comparamos con coalescencia
                  const nextStage = caseItem.case_stages?.find((stage) => (stage.estado ?? '') === 'pendiente');

                  return (
                    <div
                      key={caseItem.id}
                      className="rounded-xl border border-lexser-gray-100 p-4 hover:border-lexser-blue-200 transition-colors"
                    >
                      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <h3 className="text-base font-semibold text-lexser-gray-900">
                              {caseItem.caratulado}
                            </h3>
                            <Badge
                              variant="outline"
                              className="capitalize border-transparent bg-lexser-blue-100 text-lexser-blue-700"
                            >
                              {caseItem.materia || 'General'}
                            </Badge>
                          </div>

                          <p className="text-sm text-lexser-gray-500">
                            Cliente: {caseItem.nombre_cliente}
                          </p>

                          <div className="flex flex-wrap items-center gap-3 text-xs text-lexser-gray-500">
                            <span className="inline-flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {formatDate(caseItem.fecha_inicio || new Date())}
                            </span>

                            <span className="inline-flex items-center gap-1 capitalize">
                              <span
                                className={`block h-2 w-2 rounded-full ${
                                  statusColors[caseItem.estado || ''] || 'bg-lexser-gray-400'
                                }`}
                              />
                              {caseItem.estado || 'sin estado'}
                            </span>

                            <span
                              className={`uppercase tracking-wide font-medium ${
                                priorityTone[caseItem.prioridad || 'media']
                              }`}
                            >
                              {caseItem.prioridad || 'media'}
                            </span>
                          </div>
                        </div>

                        <div className="flex flex-col items-start gap-2 text-sm text-lexser-gray-500">
                          {caseItem.valor_estimado && (
                            <span className="font-medium text-lexser-gray-900">
                              {formatCurrency(caseItem.valor_estimado)}
                            </span>
                          )}
                          <Link
                            href={`/cases/${caseItem.id}`}
                            className="inline-flex items-center gap-1 text-lexser-blue-600 hover:text-lexser-blue-700 text-sm"
                          >
                            Ver detalle
                            <ArrowRight className="h-4 w-4" />
                          </Link>
                        </div>
                      </div>

                      {nextStage && (
                        <div className="mt-3 rounded-lg bg-lexser-blue-50 p-3 text-sm text-lexser-blue-800">
                          Próxima etapa: <strong>{nextStage.etapa}</strong>
                          {nextStage.fecha_programada && (
                            <span className="ml-2 text-xs text-lexser-blue-600">
                              Programada para {formatDate(nextStage.fecha_programada)}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>

          {/* Columna derecha */}
          <div className="space-y-6">
            {/* Panorama de casos */}
            <Card className="border-0 bg-lexser-gray-900 text-white shadow-xl">
              <CardHeader>
                <CardTitle className="text-sm font-semibold text-lexser-blue-100">
                  Panorama de tus casos
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {data.casesByStatus.length === 0 ? (
                  <p className="text-xs text-lexser-gray-400">Aún no hay datos suficientes.</p>
                ) : (
                  data.casesByStatus.map((item) => (
                    <div key={item.status}>
                      <div className="flex items-center justify-between text-xs uppercase tracking-wide text-lexser-blue-100">
                        <span>{item.status.replace('_', ' ')}</span>
                        <span>{item.count}</span>
                      </div>
                      <div className="mt-2 h-2 rounded-full bg-white/10">
                        <div
                          className={`h-2 rounded-full ${
                            statusColors[item.status] || 'bg-lexser-blue-400'
                          }`}
                          style={{ width: totalStatus === 0 ? '0%' : `${item.percentage}%` }}
                        />
                      </div>
                    </div>
                  ))
                )}

                {data.casesByPriority.length > 0 && (
                  <div className="mt-6 border-t border-white/10 pt-4">
                    <p className="text-xs uppercase tracking-wide text-lexser-blue-100 mb-3">Prioridad</p>
                    <div className="grid grid-cols-2 gap-3">
                      {data.casesByPriority.map((item: CasesByPriority) => (
                        <div key={item.priority} className="rounded-lg bg-white/5 p-3 text-xs">
                          <p className="uppercase tracking-wide text-lexser-blue-100">{item.priority}</p>
                          <p className="mt-1 text-lg font-semibold">{item.count}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Próximas etapas */}
            <Card className="border-0 bg-white shadow-xl">
              <CardHeader>
                <CardTitle className="text-sm font-semibold text-lexser-gray-900 flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-lexser-blue-600" />
                  Próximas etapas
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {deadlines.length === 0 ? (
                  <p className="text-sm text-lexser-gray-500">No hay etapas agendadas en los próximos 30 días.</p>
                ) : (
                  deadlines.map((deadline: any) => (
                    <div key={deadline.id} className="rounded-lg border border-lexser-gray-100 p-3">
                      <p className="text-sm font-medium text-lexser-gray-900">
                        {deadline.case?.caratulado || 'Caso sin título'}
                      </p>
                      <p className="text-xs text-lexser-gray-500">Etapa: {deadline.etapa}</p>
                      <div className="mt-2 flex items-center justify-between text-xs text-lexser-gray-500">
                        <span>{deadline.fecha_programada ? formatDate(deadline.fecha_programada) : 'Sin fecha'}</span>
                        {deadline.fecha_programada && (
                          <span className="inline-flex items-center gap-1 text-lexser-blue-600">
                            <Clock className="h-3 w-3" />
                            {formatRelativeTime(deadline.fecha_programada)}
                          </span>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>

            {/* Alertas por vencidos */}
            {stats.overdueStages > 0 && (
              <Card className="border border-red-200 bg-red-50 text-red-800">
                <CardHeader>
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4" />
                    Etapas vencidas
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm">
                    Tienes {stats.overdueStages} etapas que necesitan tu atención inmediata.
                  </p>
                </CardContent>
              </Card>
            )}

            <QuickLinksPanel links={quickLinks} />
            <TemplateLibrary templates={templates} />
          </div>
        </div>
      </section>
    </div>
  );
}
