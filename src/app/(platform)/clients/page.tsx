'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  listClients,
  createClientProfile,
  getClientCases,
  assignClientToCase,
  type ClientCaseSummary,
} from '@/lib/actions/clients';
import { getCases } from '@/lib/actions/cases';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { formatRUT } from '@/lib/utils';
import { FileText, Loader2, PlusCircle, Users } from 'lucide-react';

interface ClientFormState {
  nombre: string;
  email: string;
  rut: string;
  telefono: string;
}

type ClientRecord = {
  id: string;
  nombre: string;
  email: string;
  telefono: string | null;
  rut: string | null;
  created_at: string | null;
};

type ClientCaseState = {
  isLoading: boolean;
  cases: ClientCaseSummary[];
  error?: string;
};

type AssignUIState = {
  clientId: string | null;
  open: boolean;
  search: string;
  setAsPrincipal: boolean;
  isSearching: boolean;
  results: ClientCaseSummary[];
  assigningCaseId: string | null;
};

const EMPTY_ASSIGN_STATE: AssignUIState = {
  clientId: null,
  open: false,
  search: '',
  setAsPrincipal: true,
  isSearching: false,
  results: [],
  assigningCaseId: null,
};

export default function ClientsPage() {
  const [clients, setClients] = useState<ClientRecord[]>([]);
  const [isLoadingClients, setIsLoadingClients] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [search, setSearch] = useState('');
  const [expandedClientId, setExpandedClientId] = useState<string | null>(null);
  const [clientCaseMap, setClientCaseMap] = useState<Record<string, ClientCaseState>>({});
  const [assignState, setAssignState] = useState<AssignUIState>(EMPTY_ASSIGN_STATE);
  const [form, setForm] = useState<ClientFormState>({
    nombre: '',
    email: '',
    rut: '',
    telefono: '',
  });
  const { toast } = useToast();

  const loadClients = useCallback(
    async (term?: string) => {
      setIsLoadingClients(true);
      try {
        const params: { search?: string } = term ? { search: term } : {};
        const result = await listClients(params);
        if (result.success) {
          setClients(result.clients);
        } else {
          toast({
            title: 'No se pudieron cargar los clientes',
            description: result.error,
            variant: 'destructive',
          });
        }
      } catch (error) {
        console.error('Error loading clients directory', error);
        toast({
          title: 'Error inesperado',
          description: 'No fue posible obtener la lista de clientes.',
          variant: 'destructive',
        });
      } finally {
        setIsLoadingClients(false);
      }
    },
    [toast],
  );

  useEffect(() => {
    loadClients();
  }, [loadClients]);

  useEffect(() => {
    const handler = setTimeout(() => {
      loadClients(search.trim() ? search : undefined);
    }, 350);
    return () => clearTimeout(handler);
  }, [search, loadClients]);

  const fetchClientCases = useCallback(
    async (clientId: string) => {
      setClientCaseMap((prev) => ({
        ...prev,
        [clientId]: { cases: prev[clientId]?.cases ?? [], isLoading: true },
      }));

      const result = await getClientCases(clientId);
      if (result.success) {
        setClientCaseMap((prev) => ({
          ...prev,
          [clientId]: { cases: result.cases, isLoading: false },
        }));
      } else {
        setClientCaseMap((prev) => ({
          ...prev,
          [clientId]: { cases: [], isLoading: false, error: result.error },
        }));
        toast({
          title: 'No se pudieron cargar los casos',
          description: result.error,
          variant: 'destructive',
        });
      }
    },
    [toast],
  );

  const resetForm = () => {
    setForm({ nombre: '', email: '', rut: '', telefono: '' });
  };

  const handleChange = (field: keyof ClientFormState) => (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = field === 'rut' ? formatRUT(event.target.value) : event.target.value;
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleCreateClient = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsCreating(true);
    try {
      const payload = {
        nombre: form.nombre.trim(),
        email: form.email.trim(),
        rut: form.rut.trim() || undefined,
        telefono: form.telefono.trim() || undefined,
      };

      const result = await createClientProfile(payload);
      if (result.success) {
        toast({
          title: 'Cliente creado',
          description: `${result.client.nombre} fue añadido al directorio.`,
        });
        const createdClient: ClientRecord = {
          id: result.client.id,
          nombre: result.client.nombre,
          email: result.client.email,
          telefono: result.client.telefono ?? null,
          rut: result.client.rut ?? null,
          created_at: new Date().toISOString(),
        };
        setClients((prev) => [...prev, createdClient].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es')));
        resetForm();
      } else {
        toast({
          title: 'No se pudo crear el cliente',
          description: result.error,
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error creating client', error);
      toast({
        title: 'Error inesperado',
        description: 'No fue posible crear el cliente, intenta nuevamente.',
        variant: 'destructive',
      });
    } finally {
      setIsCreating(false);
    }
  };

  const totalClientes = useMemo(() => clients.length, [clients]);

  const normalizeCaseSummary = useCallback((value: any, clientId: string): ClientCaseSummary => {
    const lawyer = value?.abogado_responsable;
    const abogado = lawyer
      ? {
          id: typeof lawyer === 'object' && lawyer !== null ? (lawyer.id as string) : (lawyer as string),
          nombre: typeof lawyer === 'object' && lawyer !== null ? (lawyer.nombre ?? null) : null,
        }
      : null;

    return {
      id: value?.id ?? '',
      caratulado: value?.caratulado ?? 'Caso sin título',
      numero_causa: value?.numero_causa ?? null,
      estado: value?.estado ?? null,
      prioridad: value?.prioridad ?? null,
      etapa_actual: value?.etapa_actual ?? null,
      abogado,
      esPrincipal: value?.cliente_principal_id === clientId,
    };
  }, []);

  useEffect(() => {
    if (!assignState.open || !assignState.clientId) return;

    const clientId = assignState.clientId;
    const term = assignState.search.trim();

    if (term.length < 2) {
      setAssignState((prev) => ({ ...prev, results: [], isSearching: false }));
      return;
    }

    const handler = setTimeout(async () => {
      setAssignState((prev) => ({ ...prev, isSearching: true }));
      const response = await getCases({ search: term, limit: 8 });
      if (!response.success) {
        setAssignState((prev) => ({ ...prev, isSearching: false }));
        toast({
          title: 'No se pudieron buscar casos',
          description: response.error || 'Intenta nuevamente en unos minutos.',
          variant: 'destructive',
        });
        return;
      }

      const mapped = (response.cases ?? []).map((caseItem: any) => normalizeCaseSummary(caseItem, clientId));
      setAssignState((prev) => ({ ...prev, results: mapped, isSearching: false }));
    }, 350);

    return () => clearTimeout(handler);
  }, [assignState.open, assignState.clientId, assignState.search, toast, normalizeCaseSummary]);

  const handleToggleClient = (clientId: string) => {
    setExpandedClientId((current) => (current === clientId ? null : clientId));

    if (assignState.open && assignState.clientId !== clientId) {
      setAssignState(EMPTY_ASSIGN_STATE);
    }
  };

  useEffect(() => {
    if (!expandedClientId) return;

    const currentCaseState = clientCaseMap[expandedClientId];
    if (!currentCaseState) {
      void fetchClientCases(expandedClientId);
    }
  }, [expandedClientId, clientCaseMap, fetchClientCases]);

  const handleAssignToggle = (clientId: string) => {
    setAssignState((prev) => {
      if (prev.open && prev.clientId === clientId) {
        return EMPTY_ASSIGN_STATE;
      }
      return {
        clientId,
        open: true,
        search: '',
        setAsPrincipal: true,
        isSearching: false,
        results: [],
        assigningCaseId: null,
      };
    });
  };

  const handleAssignCase = async (caseId: string) => {
    if (!assignState.clientId) return;

    setAssignState((prev) => ({ ...prev, assigningCaseId: caseId }));

    const response = await assignClientToCase({
      client_id: assignState.clientId,
      case_id: caseId,
      set_as_principal: assignState.setAsPrincipal,
    });

    if (!response.success) {
      setAssignState((prev) => ({ ...prev, assigningCaseId: null }));
      toast({
        title: 'No se pudo asignar el caso',
        description: response.error,
        variant: 'destructive',
      });
      return;
    }

    setClientCaseMap((prev) => {
      const current = prev[assignState.clientId!] ?? { cases: [], isLoading: false };
      const existsIndex = current.cases.findIndex((c) => c.id === response.case.id);
      const updatedCases = existsIndex >= 0
        ? current.cases.map((item) => (item.id === response.case.id ? response.case : item))
        : [response.case, ...current.cases];

      return {
        ...prev,
        [assignState.clientId!]: { cases: updatedCases, isLoading: false },
      };
    });

    toast({
      title: 'Caso asignado',
      description: 'El cliente ahora figura asociado a este expediente.',
    });

    setAssignState(EMPTY_ASSIGN_STATE);
  };

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-10 sm:px-6 lg:px-8">
      <header className="space-y-2">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-50 text-blue-600">
            <Users className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">Directorio de clientes</h1>
            <p className="text-sm text-slate-500">Crea y gestiona clientes antes de asociarles casos o planes legales.</p>
          </div>
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-[1.1fr_1.9fr]">
        <Card className="border-slate-200 bg-white/90 backdrop-blur">
          <CardHeader>
            <CardTitle className="text-lg font-semibold text-slate-900">Registrar nuevo cliente</CardTitle>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={handleCreateClient}>
              <div className="space-y-2">
                <Label htmlFor="nombre">Nombre completo</Label>
                <Input
                  id="nombre"
                  value={form.nombre}
                  onChange={handleChange('nombre')}
                  placeholder="Ej: Carla González"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Correo electrónico</Label>
                <Input
                  id="email"
                  type="email"
                  value={form.email}
                  onChange={handleChange('email')}
                  placeholder="cliente@correo.cl"
                  required
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="rut">RUT</Label>
                  <Input
                    id="rut"
                    value={form.rut}
                    onChange={handleChange('rut')}
                    placeholder="12.345.678-9"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="telefono">Teléfono</Label>
                  <Input
                    id="telefono"
                    value={form.telefono}
                    onChange={handleChange('telefono')}
                    placeholder="+56 9 1234 5678"
                  />
                </div>
              </div>

              <Button type="submit" className="flex items-center gap-2" disabled={isCreating}>
                {isCreating ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Creando…
                  </>
                ) : (
                  <>
                    <PlusCircle className="h-4 w-4" />
                    Guardar cliente
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card className="border-slate-200 bg-white/90 backdrop-blur">
          <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="text-lg font-semibold text-slate-900">
                Clientes registrados ({totalClientes})
              </CardTitle>
              <p className="text-sm text-slate-500">Filtra por nombre, correo o RUT para encontrar un cliente existente.</p>
            </div>
            <div className="w-full sm:w-64">
              <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar cliente…" />
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {isLoadingClients ? (
              <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white/70 px-4 py-3 text-sm text-slate-500">
                <Loader2 className="h-4 w-4 animate-spin" />
                Cargando clientes…
              </div>
            ) : clients.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
                No hay clientes registrados todavía. Crea el primero para comenzar.
              </div>
            ) : (
              <ul className="space-y-3">
                {clients.map((client) => {
                  const caseState = clientCaseMap[client.id];
                  const caseCount = caseState?.cases.length ?? 0;
                  const isExpanded = expandedClientId === client.id;

                  return (
                    <li key={client.id} className="flex flex-col gap-2 rounded-xl border border-slate-200 bg-white/80 px-4 py-3 text-sm text-slate-700 shadow-sm">
                      <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
                        <button
                          type="button"
                          onClick={() => handleToggleClient(client.id)}
                          aria-expanded={isExpanded}
                          aria-controls={`client-cases-${client.id}`}
                          className="flex w-full cursor-pointer flex-col rounded-lg border border-transparent text-left transition hover:bg-slate-50/80 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:ring-offset-2"
                        >
                          <span className="px-2 pt-2 text-base font-medium text-slate-900">{client.nombre}</span>
                          <div className="flex flex-wrap gap-x-6 gap-y-1 px-2 pb-2 text-xs text-slate-500">
                            <span>{client.email}</span>
                            {client.telefono && <span>Tel: {client.telefono}</span>}
                            {client.rut && <span>RUT: {client.rut}</span>}
                          </div>
                        </button>
                        <div className="flex items-center gap-2">
                          <Button variant="outline" size="sm" onClick={() => handleToggleClient(client.id)}>
                            {isExpanded ? 'Ocultar casos' : `Ver casos (${caseCount})`}
                          </Button>
                          <Button variant="secondary" size="sm" onClick={() => handleAssignToggle(client.id)}>
                            {assignState.open && assignState.clientId === client.id ? 'Cerrar asignación' : 'Asignar caso'}
                          </Button>
                        </div>
                      </div>
                      {client.created_at && (
                        <span className="text-xs text-slate-400">Creado el {new Date(client.created_at).toLocaleDateString('es-CL')}</span>
                      )}

                      {isExpanded && (
                        <div
                          id={`client-cases-${client.id}`}
                          className="space-y-3 rounded-lg border border-slate-200 bg-slate-50/70 px-4 py-3 text-sm"
                        >
                          {caseState?.isLoading ? (
                            <div className="flex items-center gap-2 text-slate-500">
                              <Loader2 className="h-4 w-4 animate-spin" />
                              Buscando casos asociados…
                            </div>
                          ) : caseState?.error ? (
                            <p className="text-slate-500">No fue posible cargar los casos.</p>
                          ) : caseState && caseState.cases.length > 0 ? (
                            <ul className="space-y-2">
                              {caseState.cases.map((caseItem) => (
                                <li key={caseItem.id} className="rounded-lg border border-slate-200 bg-white px-3 py-2">
                                  <div className="flex items-start gap-3">
                                    <FileText className="mt-1 h-4 w-4 text-slate-400" />
                                    <div className="flex-1 space-y-1">
                                      <div className="flex flex-wrap items-center gap-2">
                                        <Link
                                          href={`/cases/${caseItem.id}`}
                                          className="font-medium text-blue-600 transition hover:text-blue-700 hover:underline"
                                        >
                                          {caseItem.caratulado}
                                        </Link>
                                        {caseItem.esPrincipal && <Badge variant="default">Titular</Badge>}
                                      </div>
                                      <div className="flex flex-wrap gap-3 text-xs text-slate-500">
                                        {caseItem.numero_causa && <span>Causa: {caseItem.numero_causa}</span>}
                                        {caseItem.estado && <span>Estado: {caseItem.estado}</span>}
                                        {caseItem.prioridad && <span>Prioridad: {caseItem.prioridad}</span>}
                                        {caseItem.etapa_actual && <span>Etapa: {caseItem.etapa_actual}</span>}
                                        {caseItem.abogado?.nombre && <span>Abogado: {caseItem.abogado.nombre}</span>}
                                      </div>
                                    </div>
                                  </div>
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <p className="text-slate-500">Este cliente aún no tiene casos vinculados.</p>
                          )}
                        </div>
                      )}

                      {assignState.open && assignState.clientId === client.id && (
                        <div className="space-y-3 rounded-lg border border-dashed border-blue-200 bg-white px-4 py-3">
                          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                              <p className="text-sm font-semibold text-slate-900">Asignar caso existente</p>
                              <p className="text-xs text-slate-500">Busca por caratulado o número de causa.</p>
                            </div>
                            <label className="flex items-center gap-2 text-xs text-slate-600">
                              <input
                                type="checkbox"
                                className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                                checked={assignState.setAsPrincipal}
                                onChange={(event) =>
                                  setAssignState((prev) => ({ ...prev, setAsPrincipal: event.target.checked }))
                                }
                              />
                              Definir como titular del expediente
                            </label>
                          </div>

                          <Input
                            value={assignState.search}
                            onChange={(event) => setAssignState((prev) => ({ ...prev, search: event.target.value }))}
                            placeholder="Escribe al menos 2 caracteres…"
                          />

                          <div className="space-y-2">
                            {assignState.isSearching ? (
                              <div className="flex items-center gap-2 text-sm text-slate-500">
                                <Loader2 className="h-4 w-4 animate-spin" />
                                Buscando casos…
                              </div>
                            ) : assignState.search.trim().length < 2 ? (
                              <p className="text-xs text-slate-500">Ingresa al menos dos caracteres para iniciar la búsqueda.</p>
                            ) : assignState.results.length === 0 ? (
                              <p className="text-xs text-slate-500">No encontramos casos que coincidan con la búsqueda.</p>
                            ) : (
                              <ul className="space-y-2">
                                {assignState.results.map((caseOption) => {
                                  const alreadyLinked = clientCaseMap[client.id]?.cases.some((c) => c.id === caseOption.id);

                                  return (
                                    <li key={caseOption.id} className="flex flex-col gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
                                      <div className="space-y-1">
                                        <p className="text-sm font-medium text-slate-900">{caseOption.caratulado}</p>
                                        <div className="flex flex-wrap gap-2 text-xs text-slate-500">
                                          {caseOption.numero_causa && <span>Causa: {caseOption.numero_causa}</span>}
                                          {caseOption.estado && <span>Estado: {caseOption.estado}</span>}
                                          {caseOption.prioridad && <span>Prioridad: {caseOption.prioridad}</span>}
                                          {caseOption.abogado?.nombre && <span>Abogado: {caseOption.abogado.nombre}</span>}
                                        </div>
                                      </div>
                                      <Button
                                        size="sm"
                                        disabled={alreadyLinked || assignState.assigningCaseId === caseOption.id}
                                        onClick={() => handleAssignCase(caseOption.id)}
                                      >
                                        {alreadyLinked
                                          ? 'Ya asignado'
                                          : assignState.assigningCaseId === caseOption.id
                                          ? (
                                            <span className="flex items-center gap-2">
                                              <Loader2 className="h-4 w-4 animate-spin" />
                                              Asignando…
                                            </span>
                                          )
                                          : 'Asignar'}
                                      </Button>
                                    </li>
                                  );
                                })}
                              </ul>
                            )}
                          </div>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
