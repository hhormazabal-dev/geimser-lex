'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn, formatDate, formatRelativeTime } from '@/lib/utils';
import type { CaseMilestone } from '@/lib/cases/milestones';
import { Calendar, Clock } from 'lucide-react';

function statusFor(dateIso: string): { label: string; tone: 'danger' | 'info' } {
  const today = new Date().toISOString().slice(0, 10);
  if (dateIso < today) return { label: 'Vencida', tone: 'danger' };
  return { label: 'Próxima', tone: 'info' };
}

export function CaseMilestonesTimeline({
  milestones,
  title = 'Timeline del caso',
}: {
  milestones: CaseMilestone[];
  title?: string;
}) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Calendar className="h-5 w-5" />
          {title}
          <Badge variant="outline" className="ml-1">
            {milestones.length}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {milestones.length === 0 ? (
          <p className="text-sm text-foreground/60">No hay hitos con fecha registrados en este caso.</p>
        ) : (
          <div className="space-y-2">
            {milestones.map((item) => {
              const status = statusFor(item.date);
              return (
                <div
                  key={item.key}
                  className="flex flex-col gap-2 rounded-2xl border border-white/20 bg-white/55 px-4 py-3 sm:flex-row sm:items-start sm:justify-between"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-foreground">{item.label}</p>
                    {item.detail ? <p className="text-xs text-foreground/55">{item.detail}</p> : null}
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-foreground/55">
                      <span className="font-medium text-foreground">{formatDate(item.date)}</span>
                      <span className="inline-flex items-center gap-1">
                        <Clock className="h-3.5 w-3.5" />
                        {formatRelativeTime(item.date)}
                      </span>
                    </div>
                  </div>
                  <Badge
                    variant="outline"
                    className={cn(
                      'w-fit',
                      status.tone === 'danger'
                        ? 'border-rose-200 bg-rose-50 text-rose-700'
                        : 'border-sky-200 bg-sky-50 text-sky-700',
                    )}
                  >
                    {status.label}
                  </Badge>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

