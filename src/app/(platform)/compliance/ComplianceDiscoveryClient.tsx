'use client';

import { useMemo, useState, useTransition } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Loader2, Search } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import Link from 'next/link';

type CkanResource = {
  id: string;
  name: string | null;
  format: string | null;
  url: string | null;
  datastore_active: boolean;
  last_modified: string | null;
};

type CkanPackage = {
  name: string;
  title: string | null;
  notes: string | null;
  organization: { title: string | null; name: string | null } | null;
  metadata_modified: string | null;
  resources: CkanResource[];
};

export function ComplianceDiscoveryClient() {
  const { toast } = useToast();
  const [q, setQ] = useState('rut');
  const [isPending, startTransition] = useTransition();
  const [results, setResults] = useState<CkanPackage[]>([]);

  const datasetLinks = useMemo(
    () =>
      results.map((p) => ({
        name: p.name,
        url: `https://datos.gob.cl/dataset/${encodeURIComponent(p.name)}`,
      })),
    [results],
  );

  const onSearch = () => {
    const query = q.trim();
    if (!query) return;

    startTransition(async () => {
      try {
        const url = new URL('/api/compliance/datosgob/search', window.location.origin);
        url.searchParams.set('q', query);
        url.searchParams.set('rows', '12');
        const res = await fetch(url.toString(), { method: 'GET' });
        const json = await res.json().catch(() => null);
        if (!res.ok || !json?.ok) throw new Error(json?.error ?? `Error (${res.status}).`);
        setResults((json.results ?? []) as CkanPackage[]);
      } catch (e: any) {
        console.error('[ComplianceDiscoveryClient] search error', e);
        toast({ title: 'Discovery', description: e?.message ?? 'No se pudo buscar.', variant: 'destructive' });
      }
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Discovery (datos.gob.cl)</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="flex-1">
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar datasets (ej: rut, proveedor, sanciones)" />
          </div>
          <Button onClick={onSearch} disabled={isPending}>
            {isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Buscando…
              </>
            ) : (
              <>
                <Search className="mr-2 h-4 w-4" />
                Buscar
              </>
            )}
          </Button>
        </div>

        {results.length === 0 ? (
          <p className="text-sm text-foreground/60">
            Esto sirve para descubrir fuentes públicas. No todos los datasets permiten consulta directa por RUT.
          </p>
        ) : (
          <div className="space-y-2">
            {results.map((p, idx) => {
              const link = datasetLinks[idx] ?? { name: p.name, url: `https://datos.gob.cl/dataset/${encodeURIComponent(p.name)}` };
              const hasDatastore = (p.resources ?? []).some((r) => r.datastore_active);
              return (
                <div key={p.name} className="rounded-2xl border border-white/20 bg-white/55 px-4 py-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-foreground">{p.title ?? p.name}</p>
                      <p className="mt-1 text-xs text-foreground/55">
                        {p.organization?.title ?? p.organization?.name ?? '—'} · {p.resources?.length ?? 0} recurso(s)
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant={hasDatastore ? 'default' : 'outline'}>{hasDatastore ? 'Datastore' : 'Sin Datastore'}</Badge>
                      <Button asChild size="sm" variant="outline">
                        <Link href={link.url} target="_blank" rel="noreferrer">
                          Abrir
                        </Link>
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
