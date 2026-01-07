'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeftRight, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { reassignCaseAcrossOrganizations } from '@/lib/actions/transicion';

type OrganizationRow = {
  id: string;
  name: string;
  status: string | null;
};

type LawyerRow = {
  id: string;
  nombre: string | null;
  email: string | null;
  activo: boolean | null;
  organization_id: string;
};

type CaseRow = {
  id: string;
  numero_causa: string | null;
  caratulado: string | null;
  nombre_cliente: string | null;
  estado: string | null;
  organization_id: string | null;
  abogado_responsable: string | null;
  org?: { id: string; name: string | null } | null;
  abogado?: { id: string; nombre: string | null; email: string | null; active_organization_id: string | null } | null;
};

interface TransitionClientProps {
  organizations: OrganizationRow[];
  lawyers: LawyerRow[];
  cases: CaseRow[];
}

function encodeSelection(lawyerId: string, organizationId: string) {
  return `${lawyerId}|${organizationId}`;
}

function decodeSelection(value: string) {
  const [lawyerId, organizationId] = value.split('|');
  return { lawyerId: lawyerId ?? '', organizationId: organizationId ?? '' };
}

export function TransitionClient({ organizations, lawyers, cases }: TransitionClientProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [search, setSearch] = useState('');
  const [selectedOrg, setSelectedOrg] = useState('all');
  const [selectionByCase, setSelectionByCase] = useState<Record<string, string>>({});
  const [pendingCaseId, setPendingCaseId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const orgMap = useMemo(() => new Map(organizations.map((org) => [org.id, org])), [organizations]);

  const lawyersByOrg = useMemo(() => {
    const map = new Map<string, LawyerRow[]>();
    for (const lawyer of lawyers) {
      const orgId = lawyer.organization_id;
      if (!map.has(orgId)) {
        map.set(orgId, []);
      }
      map.get(orgId)?.push(lawyer);
    }

    for (const [orgId, list] of map.entries()) {
      map.set(
        orgId,
        [...list].sort((a, b) => (a.nombre ?? '').localeCompare(b.nombre ?? '', 'es')),
      );
    }

    return map;
  }, [lawyers]);

  const lawyerSelectionMap = useMemo(
    () => new Map(lawyers.map((lawyer) => [encodeSelection(lawyer.id, lawyer.organization_id), lawyer])),
    [lawyers],
  );

  const filteredCases = useMemo(() => {
    const query = search.trim().toLowerCase();
    return cases.filter((row) => {
      if (selectedOrg !== 'all' && row.organization_id !== selectedOrg) return false;
      if (!query) return true;
      const haystack = [
        row.numero_causa,
        row.caratulado,
        row.nombre_cliente,
        row.org?.name,
        row.abogado?.nombre,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(query);
    });
  }, [cases, search, selectedOrg]);

  const statsByOrg = useMemo(() => {
    const stats = new Map<string, { lawyers: number; cases: number }>();
    for (const org of organizations) {
      stats.set(org.id, { lawyers: 0, cases: 0 });
    }

    for (const lawyer of lawyers) {
      if (lawyer.organization_id && stats.has(lawyer.organization_id)) {
        stats.get(lawyer.organization_id)!.lawyers += 1;
      }
    }

    for (const row of cases) {
      if (row.organization_id && stats.has(row.organization_id)) {
        stats.get(row.organization_id)!.cases += 1;
      }
    }

    return stats;
  }, [organizations, lawyers, cases]);

  const handleReassign = (caseRow: CaseRow, selectedId: string) => {
    const { lawyerId: targetLawyerId, organizationId: targetOrgId } = decodeSelection(selectedId);
    if (!targetLawyerId) {
      toast({
        title: 'Selecciona un abogado',
        description: 'Elige un abogado destino para continuar.',
        variant: 'destructive',
      });
      return;
    }

    if (targetLawyerId === caseRow.abogado?.id) {
      toast({
        title: 'Sin cambios',
        description: 'El caso ya esta asignado a ese abogado.',
      });
      return;
    }

    setPendingCaseId(caseRow.id);
    startTransition(async () => {
      try {
        const result = await reassignCaseAcrossOrganizations({
          case_id: caseRow.id,
          abogado_id: targetLawyerId,
          target_org_id: targetOrgId,
        });

        if (result.success) {
          const targetOrg = targetOrgId ? orgMap.get(targetOrgId)?.name : null;
          toast({
            title: 'Caso reasignado',
            description: result.moved
              ? `Se movio el caso a ${targetOrg ?? 'la empresa destino'}.`
              : 'Actualizamos el abogado responsable.',
          });
          setSelectionByCase((prev) => {
            const next = { ...prev };
            delete next[caseRow.id];
            return next;
          });
          router.refresh();
        } else {
          toast({
            title: 'No se pudo reasignar',
            description: result.error ?? 'Intenta nuevamente en unos minutos.',
            variant: 'destructive',
          });
        }
      } catch (error) {
        toast({
          title: 'Error inesperado',
          description: (error as Error).message ?? 'No fue posible reasignar el caso.',
          variant: 'destructive',
        });
      } finally {
        setPendingCaseId(null);
      }
    });
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
      <aside className="rounded-xl border bg-white p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold">Empresas</h2>
          <span className="text-xs text-muted-foreground">{organizations.length} total</span>
        </div>
        <div className="mt-4 space-y-4">
          {organizations.map((org) => {
            const stats = statsByOrg.get(org.id) ?? { lawyers: 0, cases: 0 };
            const orgLawyers = lawyersByOrg.get(org.id) ?? [];
            return (
              <div key={org.id} className="rounded-lg border bg-muted/30 p-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-foreground">{org.name}</p>
                    <p className="text-xs text-foreground/60">
                      {stats.lawyers} abogados - {stats.cases} casos
                    </p>
                  </div>
                  <span className="text-xs uppercase text-foreground/50">{org.status ?? 'activa'}</span>
                </div>
                <div className="mt-3 space-y-1">
                  {orgLawyers.length === 0 ? (
                    <p className="text-xs text-foreground/50">Sin abogados asignados.</p>
                  ) : (
                    orgLawyers.map((lawyer) => (
                      <p key={encodeSelection(lawyer.id, org.id)} className="text-xs text-foreground/70">
                        {lawyer.nombre ?? 'Sin nombre'}
                        {lawyer.email ? ` - ${lawyer.email}` : ''}
                        {lawyer.activo === false ? ' - Inactivo' : ''}
                      </p>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </aside>

      <section className="rounded-xl border bg-white p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold">Casos</h2>
            <p className="text-xs text-muted-foreground">{filteredCases.length} resultados</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Busca por causa, cliente o abogado"
              className="w-56"
            />
            <select
              className="input-field h-10 w-48"
              value={selectedOrg}
              onChange={(event) => setSelectedOrg(event.target.value)}
            >
              <option value="all">Todas las empresas</option>
              {organizations.map((org) => (
                <option key={org.id} value={org.id}>
                  {org.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs uppercase text-muted-foreground">
                <th className="py-2 pr-4">Empresa</th>
                <th className="py-2 pr-4">Caso</th>
                <th className="py-2 pr-4">Abogado actual</th>
                <th className="py-2 pr-4">Nuevo abogado</th>
                <th className="py-2 pr-4">Accion</th>
              </tr>
            </thead>
            <tbody>
              {filteredCases.map((row) => {
                const currentLawyerId = row.abogado?.id ?? '';
                const currentSelection =
                  currentLawyerId && row.organization_id ? encodeSelection(currentLawyerId, row.organization_id) : '';
                const hasCurrentOption = currentSelection && lawyerSelectionMap.has(currentSelection);
                const selectedId = selectionByCase[row.id] ?? (hasCurrentOption ? currentSelection : '');
                const decoded = selectedId ? decodeSelection(selectedId) : null;
                const targetOrgName = decoded?.organizationId ? orgMap.get(decoded.organizationId)?.name : null;
                const currentOrgName = row.org?.name ?? row.organization_id ?? 'Sin empresa';
                const willMove = decoded?.organizationId && row.organization_id !== decoded.organizationId;

                return (
                  <tr key={row.id} className="border-b last:border-b-0">
                    <td className="py-2 pr-4">
                      <p className="font-medium text-foreground">{currentOrgName}</p>
                    </td>
                    <td className="py-2 pr-4">
                      <p className="font-medium text-foreground">{row.caratulado ?? 'Sin caratulado'}</p>
                      <p className="text-xs text-foreground/60">{row.numero_causa ?? 'Sin numero'}</p>
                    </td>
                    <td className="py-2 pr-4">
                      <p className="text-foreground">{row.abogado?.nombre ?? 'Sin asignar'}</p>
                      {row.abogado?.email ? (
                        <p className="text-xs text-foreground/60">{row.abogado.email}</p>
                      ) : null}
                    </td>
                    <td className="py-2 pr-4">
                      <select
                        className="input-field w-64"
                        value={selectedId}
                        onChange={(event) =>
                          setSelectionByCase((prev) => ({
                            ...prev,
                            [row.id]: event.target.value,
                          }))
                        }
                      >
                        <option value="">Selecciona abogado</option>
                        {organizations.map((org) => {
                          const orgLawyers = lawyersByOrg.get(org.id) ?? [];
                          if (orgLawyers.length === 0) return null;
                          return (
                            <optgroup key={org.id} label={org.name}>
                              {orgLawyers.map((lawyer) => (
                                <option
                                  key={encodeSelection(lawyer.id, org.id)}
                                  value={encodeSelection(lawyer.id, org.id)}
                                  disabled={lawyer.activo === false}
                                >
                                  {lawyer.nombre ?? 'Sin nombre'}
                                  {lawyer.email ? ` - ${lawyer.email}` : ''}
                                  {lawyer.activo === false ? ' - Inactivo' : ''}
                                </option>
                              ))}
                            </optgroup>
                          );
                        })}
                      </select>
                      {willMove ? (
                        <p className="mt-1 text-xs text-amber-600">
                          Movera el caso a {targetOrgName ?? 'empresa destino'}.
                        </p>
                      ) : null}
                    </td>
                    <td className="py-2 pr-4">
                      <Button
                        size="sm"
                        className="rounded-full"
                        onClick={() => handleReassign(row, selectedId)}
                        disabled={
                          isPending ||
                          pendingCaseId === row.id ||
                          !selectedId ||
                          selectedId === currentSelection
                        }
                      >
                        {pendingCaseId === row.id ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Guardando
                          </>
                        ) : (
                          <>
                            <ArrowLeftRight className="mr-2 h-4 w-4" />
                            Reasignar
                          </>
                        )}
                      </Button>
                    </td>
                  </tr>
                );
              })}
              {filteredCases.length === 0 ? (
                <tr>
                  <td className="py-3 text-muted-foreground" colSpan={5}>
                    No hay casos que coincidan con los filtros.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
