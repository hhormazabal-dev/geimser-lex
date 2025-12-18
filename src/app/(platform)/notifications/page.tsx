export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { getCurrentProfile } from '@/lib/auth/roles';
import { createServerClient } from '@/lib/supabase/server';
import { formatRelativeTime } from '@/lib/utils';

export default async function NotificationsPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect('/login?redirectTo=/notifications');

  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from('notification_logs')
    .select('id, type, template, subject, status, recipient, created_at, sent_at, error_message')
    .eq('recipient', profile.email)
    .order('created_at', { ascending: false })
    .limit(50);

  const notifications = data ?? [];

  return (
    <div className='min-h-screen bg-transparent text-slate-900'>
      <div className='mx-auto flex w-full max-w-[1600px] flex-col gap-8 px-4 pb-12 pt-6 sm:px-6 lg:px-8'>
        <header className='space-y-2'>
          <p className='text-[11px] uppercase tracking-[0.25em] text-slate-400'>Centro</p>
          <h1 className='text-2xl font-semibold tracking-tight'>Notificaciones</h1>
          <p className='max-w-3xl text-sm leading-relaxed text-slate-600'>
            Historial de correos y alertas enviadas (vencimientos, recordatorios y avisos del sistema).
          </p>
        </header>

        {error && (
          <Card className='rounded-3xl border border-red-200 bg-white/80 backdrop-blur-xl shadow-sm'>
            <CardHeader>
              <CardTitle className='text-red-700'>No se pudo cargar el historial</CardTitle>
            </CardHeader>
            <CardContent>
              <p className='text-sm text-red-600/80'>{error.message}</p>
            </CardContent>
          </Card>
        )}

        <Card className='rounded-3xl border border-slate-100 bg-white/80 backdrop-blur-xl shadow-sm'>
          <CardHeader>
            <CardTitle className='flex items-center justify-between gap-3'>
              <span>Últimas 50</span>
              <Badge variant='outline' className='border-slate-200 text-slate-600'>
                {notifications.length}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {notifications.length === 0 ? (
              <p className='text-sm text-slate-500'>Aún no hay notificaciones registradas para tu correo.</p>
            ) : (
              <div className='space-y-2'>
                {notifications.map((n) => (
                  <div
                    key={n.id}
                    className='flex flex-col gap-2 rounded-2xl border border-slate-100 bg-white px-4 py-3'
                  >
                    <div className='flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between'>
                      <div className='space-y-1'>
                        <p className='text-sm font-semibold text-slate-900'>
                          {n.subject ?? n.template}
                        </p>
                        <p className='text-xs text-slate-500'>
                          {n.template} · {n.type} · {n.sent_at ? `enviada ${formatRelativeTime(n.sent_at)}` : 'pendiente'}
                        </p>
                      </div>
                      <div className='flex flex-wrap items-center gap-2'>
                        <Badge
                          variant='outline'
                          className={`border-slate-200 ${
                            n.status === 'sent'
                              ? 'bg-emerald-50 text-emerald-700'
                              : n.status === 'failed'
                                ? 'bg-red-50 text-red-700'
                                : 'bg-slate-50 text-slate-600'
                          }`}
                        >
                          {n.status}
                        </Badge>
                      </div>
                    </div>
                    {n.error_message && (
                      <p className='text-xs text-red-600'>{n.error_message}</p>
                    )}
                    <div className='text-xs text-slate-500'>
                      Consejo: revisa tu bandeja y spam. También puedes ir a <Link className='underline' href='/dashboard'>dashboard</Link>.
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

