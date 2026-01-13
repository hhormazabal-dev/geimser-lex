import { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getCurrentProfile } from '@/lib/auth/roles';
import { getCaseEditLogs, type CaseEditLog } from '@/lib/actions/audit';
import { formatDateTime } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export const metadata: Metadata = {
  title: 'Ediciones de casos - Xel Chile',
  description: 'Historial de cambios en expedientes por empresa',
};

const IGNORE_FIELDS = new Set(['updated_at', 'created_at']);

const formatValue = (value: unknown) => {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed.length > 120 ? `${trimmed.slice(0, 117)}…` : trimmed;
  }
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  const json = JSON.stringify(value);
  return json.length > 120 ? `${json.slice(0, 117)}…` : json;
};

const resolveChanges = (log: CaseEditLog) => {
  const diff = log.diff_json as any;
  const from = diff?.from ?? null;
  const to = diff?.to ?? null;
  if (!from || !to || typeof from !== 'object' || typeof to !== 'object') return [];

  const keys = new Set([...Object.keys(from), ...Object.keys(to)]);
  const changes: Array<{ field: string; from: string; to: string }> = [];
  keys.forEach((key) => {
    if (IGNORE_FIELDS.has(key)) return;
    const prev = from[key];
    const next = to[key];
    if (JSON.stringify(prev) === JSON.stringify(next)) return;
    changes.push({ field: key, from: formatValue(prev), to: formatValue(next) });
  });
  return changes;
};

export default async function CaseEditLogsPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect('/login');
  if (profile.role !== 'admin_firma') redirect('/dashboard');

  const logsResult = await getCaseEditLogs({ limit: 200, actions: ['UPDATE'] });
  const logs = logsResult.success ? logsResult.logs ?? [] : [];

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-6 space-y-2">
          <h1 className="text-2xl font-semibold text-slate-900">Ediciones de casos</h1>
          <p className="text-sm text-slate-500">
            Historial de cambios en expedientes dentro de tu empresa.
          </p>
        </div>

        {logs.length === 0 ? (
          <Card className="border-slate-200">
            <CardContent className="p-6 text-sm text-slate-500">
              No hay ediciones recientes registradas.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {logs.map((log) => {
              const changes = resolveChanges(log);
              return (
                <Card key={log.id} className="border-slate-200">
                  <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="space-y-1">
                      <CardTitle className="text-base text-slate-900">
                        {log.case?.caratulado ?? 'Caso sin título'}
                      </CardTitle>
                      <p className="text-xs text-slate-500">
                        {log.case?.numero_causa ? `Causa ${log.case.numero_causa}` : 'Sin número de causa'}
                      </p>
                    </div>
                    <div className="flex flex-col items-start gap-2 text-xs text-slate-500 sm:items-end">
                      <Badge variant="outline" className="text-[10px] uppercase tracking-widest">
                        {log.action ?? 'UPDATE'}
                      </Badge>
                      <span>{formatDateTime(log.created_at)}</span>
                      <span className="font-medium text-slate-700">
                        {log.actor?.nombre ?? log.actor?.email ?? 'Usuario'}
                      </span>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3 text-sm text-slate-700">
                    {changes.length === 0 ? (
                      <p className="text-xs text-slate-500">Sin detalle de cambios disponible.</p>
                    ) : (
                      <div className="divide-y divide-slate-100 rounded-lg border border-slate-100">
                        {changes.slice(0, 8).map((change) => (
                          <div key={change.field} className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:gap-4">
                            <span className="w-full text-xs font-semibold uppercase tracking-[0.16em] text-slate-500 sm:w-40">
                              {change.field}
                            </span>
                            <div className="flex-1 text-xs text-slate-600">
                              <span className="font-medium text-slate-700">{change.from}</span>
                              <span className="px-2 text-slate-400">→</span>
                              <span className="font-semibold text-slate-900">{change.to}</span>
                            </div>
                          </div>
                        ))}
                        {changes.length > 8 && (
                          <div className="px-4 py-2 text-xs text-slate-500">
                            +{changes.length - 8} cambios adicionales
                          </div>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
