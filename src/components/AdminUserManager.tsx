'use client';

import { useMemo, useState, useTransition, type ReactNode } from 'react';
import Link from 'next/link';
import {
  Pencil,
  Trash2,
  Users,
  UserCheck,
  Building2,
  ShieldCheck,
  Shield,
  Target,
  Search,
  XCircle,
  Plus,
  Loader2,
} from 'lucide-react';
import {
  createManagedUser,
  updateManagedUser,
  deleteManagedUser,
  deactivateManagedUser,
  updateManagedUserOrganization,
  type ManagedOrganization,
  type ManagedUser,
} from '@/lib/actions/admin-users';
import { startDiditVerification } from '@/lib/actions/didit-verification';
import { managedUserRoles } from '@/lib/validators/admin-users';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { cn, formatRelativeTime, formatDateShort } from '@/lib/utils';
import { formatRoleLabel } from '@/lib/navigation/role-label';

interface AdminUserManagerProps {
  initialUsers: ManagedUser[];
  organizations: ManagedOrganization[];
}

type RoleFilter = 'todos' | (typeof managedUserRoles)[number];

type PendingState = {
  type: 'create' | 'update' | 'delete' | 'deactivate' | 'transfer-org' | null;
  userId?: string;
};

function HighlightStat({ title, value, subtitle, icon }: { title: string; value: number; subtitle: string; icon: ReactNode }) {
  return (
    <div className='rounded-2xl border border-white/20 bg-white/50 p-4 shadow-sm backdrop-blur-xl'>
      <div className='flex items-center justify-between'>
        <p className='text-xs uppercase tracking-wide text-foreground/50'>{title}</p>
        <span className='inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/30 bg-white/50 text-xs text-foreground/60'>
          {icon}
        </span>
      </div>
      <p className='mt-2 text-2xl font-semibold text-foreground'>{value}</p>
      <p className='text-xs text-foreground/50'>{subtitle}</p>
    </div>
  );
}
export function AdminUserManager({ initialUsers, organizations }: AdminUserManagerProps) {
  const { toast } = useToast();
  const [users, setUsers] = useState(initialUsers);
  const [filter, setFilter] = useState<RoleFilter>('todos');
  const [search, setSearch] = useState('');
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [pendingState, setPendingState] = useState<PendingState>({ type: null });
  const [verifyingUserId, setVerifyingUserId] = useState<string | null>(null);
  const [orgDraftByUserId, setOrgDraftByUserId] = useState<Record<string, string>>({});
  const [transferModeByUserId, setTransferModeByUserId] = useState<Record<string, 'A' | 'B'>>({});

  const isPending = pendingState.type !== null && pending;

  const organizationsById = useMemo(
    () => new Map<string, ManagedOrganization>((organizations ?? []).map((o) => [o.id, o])),
    [organizations],
  );

  const getAssignedOrgId = (user: ManagedUser) => {
    return user.role === 'cliente' ? user.organizationId : user.activeOrganizationId;
  };

  const filteredUsers = useMemo(() => {
    const term = search.trim().toLowerCase();
    return users.filter((user) => {
      const matchesRole = filter === 'todos' || user.role === filter;
      const matchesSearch =
        !term ||
        user.nombre.toLowerCase().includes(term) ||
        user.email.toLowerCase().includes(term) ||
        (user.telefono ?? '').toLowerCase().includes(term);
      return matchesRole && matchesSearch;
    });
  }, [users, filter, search]);

  const groupedUsers = useMemo(() => {
    const bucket = new Map<string, ManagedUser[]>();
    for (const user of filteredUsers) {
      const key = getAssignedOrgId(user) ?? '';
      const current = bucket.get(key);
      if (current) current.push(user);
      else bucket.set(key, [user]);
    }

    const groups: Array<{
      key: string;
      organization: ManagedOrganization | null;
      users: ManagedUser[];
    }> = [];

    const seen = new Set<string>();
    for (const org of organizations ?? []) {
      const orgUsers = bucket.get(org.id);
      if (orgUsers && orgUsers.length > 0) {
        groups.push({ key: org.id, organization: org, users: [...orgUsers].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es')) });
        seen.add(org.id);
      }
    }

    const unassigned = bucket.get('') ?? [];
    if (unassigned.length > 0) {
      groups.push({
        key: '',
        organization: null,
        users: [...unassigned].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es')),
      });
      seen.add('');
    }

    for (const [key, list] of bucket.entries()) {
      if (seen.has(key)) continue;
      const org = key ? organizationsById.get(key) ?? null : null;
      groups.push({
        key,
        organization: org,
        users: [...list].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es')),
      });
    }

    return groups;
  }, [filteredUsers, organizations, organizationsById]);

  const stats = useMemo(() => {
    const total = users.length;
    const byRole = managedUserRoles.reduce<Record<string, number>>((acc, role) => {
      acc[role] = users.filter((user) => user.role === role).length;
      return acc;
    }, {});

    const inactive = users.filter((user) => !user.activo).length;

    return { total, byRole, inactive };
  }, [users]);

  const orgStats = useMemo(() => {
    const total = (organizations ?? []).length;
    const inactive = (organizations ?? []).filter((org) => org.status !== 'active').length;
    return { total, inactive, active: total - inactive };
  }, [organizations]);

  const resetState = () => {
    setPendingState({ type: null });
  };

  const handleStartIdentityVerification = async (user: ManagedUser) => {
    setVerifyingUserId(user.userId);
    try {
      const result = await startDiditVerification(user.userId);
      if (!result.success) {
        toast({ title: 'No se pudo iniciar la validación', description: result.error, variant: 'destructive' });
        return;
      }

      try {
        await navigator.clipboard.writeText(result.url);
      } catch {
        // ignore
      }

      window.open(result.url, '_blank', 'noopener,noreferrer');
      toast({
        title: 'Validación iniciada',
        description: 'Se abrió el enlace de Didit (y quedó copiado al portapapeles si el navegador lo permite).',
      });
    } catch (error) {
      console.error('Error starting identity verification', error);
      toast({
        title: 'Error inesperado',
        description: 'No fue posible iniciar la validación de identidad.',
        variant: 'destructive',
      });
    } finally {
      setVerifyingUserId(null);
    }
  };

  const handleTransferOrg = (user: ManagedUser) => {
    const currentOrgId = getAssignedOrgId(user) ?? '';
    const draft = orgDraftByUserId[user.userId] ?? currentOrgId;
    const nextOrgId = draft.trim();
    const mode = transferModeByUserId[user.userId] ?? 'A';

    if (!nextOrgId && user.role !== 'cliente') {
      toast({ title: 'Selecciona una empresa', description: 'Los usuarios internos requieren una empresa activa.', variant: 'destructive' });
      return;
    }

    if (nextOrgId === currentOrgId) return;

    setPendingState({ type: 'transfer-org', userId: user.userId });
    startTransition(async () => {
      const result = await updateManagedUserOrganization(user.userId, nextOrgId ? nextOrgId : null, mode);
      if (result.success && result.users) {
        setUsers(result.users);
        const transfer = (result as any).transfer as any | undefined;
        const description =
          transfer && typeof transfer === 'object'
            ? `Casos movidos: ${transfer.moved_cases_count ?? 0}. Clientes movidos: ${transfer.moved_clients_count ?? 0}. Omitidos: ${transfer.skipped_cases_count ?? 0}.`
            : 'La asignación quedó actualizada.';
        toast({
          title: 'Empresa actualizada',
          description,
        });
      } else {
        if (result.users) setUsers(result.users);
        toast({
          title: 'No se pudo reasignar',
          description: result.error,
          variant: 'destructive',
        });
      }
      resetState();
    });
  };

  const handleCreate: React.FormEventHandler<HTMLFormElement> = (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);

    setPendingState({ type: 'create' });
    startTransition(async () => {
      const result = await createManagedUser(formData);
      if (result.success && result.users) {
        setUsers(result.users);
        form.reset();
        toast({
          title: 'Usuario creado',
          description: 'La cuenta quedó disponible para iniciar sesión.',
        });
      } else {
        if (result.users) {
          setUsers(result.users);
        }
        toast({
          title: 'No se pudo crear el usuario',
          description: result.error,
          variant: 'destructive',
        });
      }
      resetState();
    });
  };

  const handleEdit = (userId: string) => {
    setEditingUserId((current) => (current === userId ? null : userId));
  };

  const handleUpdate: React.FormEventHandler<HTMLFormElement> = (event) => {
    event.preventDefault();
    if (!editingUserId) return;

    const formData = new FormData(event.currentTarget);
    setPendingState({ type: 'update', userId: editingUserId });

    startTransition(async () => {
      const result = await updateManagedUser(editingUserId, formData);
      if (result.success && result.users) {
        setUsers(result.users);
        setEditingUserId(null);
        toast({ title: 'Usuario actualizado', description: 'Los cambios fueron guardados.' });
      } else {
        if (result.users) {
          setUsers(result.users);
        }
        toast({
          title: 'No se pudo actualizar',
          description: result.error,
          variant: 'destructive',
        });
      }
      resetState();
    });
  };

  const handleDeactivate = (userId: string) => {
    if (!users.find((user) => user.userId === userId)) return;

    if (!confirm('¿Seguro quieres desactivar a este usuario?')) {
      return;
    }

    setPendingState({ type: 'deactivate', userId });
    startTransition(async () => {
      const result = await deactivateManagedUser(userId);
      if (result.success && result.users) {
        setUsers(result.users);
        toast({ title: 'Cuenta desactivada', description: 'El usuario ya no podrá acceder.' });
      } else {
        if (result.users) {
          setUsers(result.users);
        }
        toast({
          title: 'No se pudo desactivar',
          description: result.error,
          variant: 'destructive',
        });
      }
      resetState();
    });
  };

  const handleDelete = (userId: string) => {
    const target = users.find((user) => user.userId === userId);
    if (!target) return;

    const confirmation = confirm(
      `¿Eliminar definitivamente a ${target.nombre}? Esta acción es irreversible.`,
    );
    if (!confirmation) {
      return;
    }

    setPendingState({ type: 'delete', userId });
    startTransition(async () => {
      const result = await deleteManagedUser(userId);
      if (result.success && result.users) {
        setUsers(result.users);
        toast({ title: 'Usuario eliminado', description: 'La cuenta fue removida del sistema.' });
      } else {
        if (result.users) {
          setUsers(result.users);
        }
        toast({
          title: 'No se pudo eliminar la cuenta',
          description: result.error,
          variant: 'destructive',
        });
      }
      resetState();
    });
  };

  const handleToggleActive = (user: ManagedUser) => {
    const formData = new FormData();
    formData.append('email', user.email);
    formData.append('nombre', user.nombre);
    formData.append('role', user.role);
    if (user.rut) formData.append('rut', user.rut);
    if (user.telefono) formData.append('telefono', user.telefono);
    if (user.activo) {
      formData.append('activo', '');
    } else {
      formData.append('activo', 'on');
    }

    setPendingState({ type: 'update', userId: user.userId });
    startTransition(async () => {
      const result = await updateManagedUser(user.userId, formData);
      if (result.success && result.users) {
        setUsers(result.users);
        toast({
          title: user.activo ? 'Usuario desactivado' : 'Usuario activado',
          description: user.activo
            ? 'Puedes reactivarlo cuando lo necesites.'
            : 'La cuenta vuelve a tener acceso.',
        });
      } else {
        if (result.users) {
          setUsers(result.users);
        }
        toast({
          title: 'No se pudo actualizar el estado',
          description: result.error,
          variant: 'destructive',
        });
      }
      resetState();
    });
  };

  const activeClass = (role: RoleFilter) =>
    cn(
      'inline-flex items-center rounded-full border px-4 py-1.5 text-xs font-medium transition-all backdrop-blur-md',
      filter === role
        ? 'border-primary/30 bg-primary/15 text-primary'
        : 'border-white/20 bg-white/30 text-foreground/60 hover:bg-white/50',
    );

  return (
    <div className='space-y-10'>
      <section className='rounded-3xl border border-white/15 bg-white/60 px-6 py-6 shadow-xl backdrop-blur-2xl sm:px-8'>
        <div className='flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between'>
          <div className='space-y-2'>
            <div className='inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/40 px-3 py-1 text-xs font-semibold text-foreground/60'>
              <Users className='h-4 w-4 text-primary' /> Gestión de usuarios
            </div>
            <h1 className='text-2xl font-semibold tracking-tight text-foreground'>
              Controla los accesos del estudio con visibilidad total
            </h1>
            <p className='max-w-xl text-sm text-foreground/60'>
              Crea, edita y administra roles en segundos; mantén la seguridad y el orden organizacional.
            </p>
          </div>
          <Button
            asChild
            variant='secondary'
            size='sm'
            className='rounded-full bg-white/80 text-foreground hover:bg-white shadow-md'
          >
            <Link href='/dashboard/admin'>Volver al dashboard</Link>
          </Button>
        </div>

        <div className='mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-6'>
          <HighlightStat
            title='Empresas'
            value={orgStats.total}
            subtitle={`${orgStats.active} activas · ${orgStats.inactive} inactivas`}
            icon={<Building2 className='h-4 w-4 text-amber-500' />}
          />
          <HighlightStat
            title='Usuarios activos'
            value={stats.total - stats.inactive}
            subtitle={`${stats.inactive} desactivados`}
            icon={<UserCheck className='h-4 w-4 text-emerald-400' />}
          />
          <HighlightStat
            title='Administradores'
            value={stats.byRole['admin_firma'] ?? 0}
            subtitle='Rol admin_firma'
            icon={<ShieldCheck className='h-4 w-4 text-sky-400' />}
          />
          <HighlightStat
            title='Abogados'
            value={stats.byRole['abogado'] ?? 0}
            subtitle='Equipo litigios'
            icon={<Shield className='h-4 w-4 text-indigo-400' />}
          />
          <HighlightStat
            title='Analistas'
            value={stats.byRole['analista'] ?? 0}
            subtitle='Soporte interno'
            icon={<Target className='h-4 w-4 text-purple-400' />}
          />
          <HighlightStat
            title='Clientes activos'
            value={stats.byRole['cliente'] ?? 0}
            subtitle='Portal cliente'
            icon={<Users className='h-4 w-4 text-blue-400' />}
          />
        </div>
      </section>

      <section className='rounded-3xl border border-white/15 bg-white/70 shadow-xl backdrop-blur-2xl'>
        <header className='flex flex-col gap-2 border-b border-white/10 px-6 py-6 sm:px-8 sm:flex-row sm:items-center sm:justify-between'>
          <div>
            <h2 className='text-lg font-semibold text-foreground'>Crear nuevo usuario</h2>
            <p className='text-sm text-foreground/60'>Completa la información para habilitar acceso inmediato.</p>
          </div>
          <div className='rounded-full border border-white/20 bg-white/40 px-3 py-1 text-xs text-foreground/60'>
            Tiempo estimado: 2 minutos
          </div>
        </header>
        <form onSubmit={handleCreate} className='grid gap-4 px-6 py-6 sm:px-8 md:grid-cols-2 xl:grid-cols-3'>
          <div className='space-y-2'>
            <Label htmlFor='create-nombre'>Nombre completo</Label>
            <Input id='create-nombre' name='nombre' placeholder='Nombre y apellidos' required disabled={isPending} />
          </div>
          <div className='space-y-2'>
            <Label htmlFor='create-email'>Email</Label>
            <Input id='create-email' name='email' type='email' placeholder='usuario@empresa.com' required disabled={isPending} />
          </div>
          <div className='space-y-2'>
            <Label htmlFor='create-password'>Contraseña temporal</Label>
            <Input id='create-password' name='password' type='password' placeholder='Mínimo 8 caracteres' required disabled={isPending} />
          </div>
          <div className='space-y-2'>
            <Label htmlFor='create-role'>Rol</Label>
            <select
              id='create-role'
              name='role'
              className='h-11 w-full rounded-2xl border border-white/30 bg-white/70 px-4 text-sm text-foreground/80 shadow-inner focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30'
              defaultValue='abogado'
              disabled={isPending}
            >
              {managedUserRoles.map((role) => (
                <option key={role} value={role} className='capitalize'>
                  {formatRoleLabel(role)}
                </option>
              ))}
            </select>
          </div>
          <div className='space-y-2'>
            <Label htmlFor='create-organization'>Empresa (opcional)</Label>
            <select
              id='create-organization'
              name='organization_id'
              className='h-11 w-full rounded-2xl border border-white/30 bg-white/70 px-4 text-sm text-foreground/80 shadow-inner focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30'
              defaultValue=''
              disabled={isPending || (organizations ?? []).length === 0}
            >
              <option value=''>Sin asignar</option>
              {(organizations ?? []).map((org) => (
                <option key={org.id} value={org.id} disabled={org.status !== 'active'}>
                  {org.name} {org.status !== 'active' ? '(inactiva)' : ''}
                </option>
              ))}
            </select>
          </div>
          <div className='space-y-2'>
            <Label htmlFor='create-rut'>RUT (opcional)</Label>
            <Input id='create-rut' name='rut' placeholder='12345678-9' disabled={isPending} />
          </div>
          <div className='space-y-2'>
            <Label htmlFor='create-telefono'>Teléfono (opcional)</Label>
            <Input id='create-telefono' name='telefono' placeholder='+569...' disabled={isPending} />
          </div>
          <div className='col-span-full flex items-center gap-2 rounded-2xl border border-white/20 bg-white/40 px-5 py-3 text-sm text-foreground/70'>
            <input
              id='create-activo'
              name='activo'
              type='checkbox'
              defaultChecked
              disabled={isPending}
              className='h-4 w-4 rounded border-white/30 bg-white text-primary focus:ring-primary/40'
            />
            <Label htmlFor='create-activo'>Habilitar acceso inmediato</Label>
          </div>
          <div className='col-span-full flex justify-end'>
            <Button type='submit' disabled={isPending} className='rounded-full px-6'>
              {pendingState.type === 'create' && pending ? 'Creando…' : 'Crear usuario'}
            </Button>
          </div>
        </form>
      </section>

      <section className='space-y-6 rounded-3xl border border-white/15 bg-white/70 px-6 py-6 shadow-xl backdrop-blur-2xl sm:px-8'>
        <div className='flex flex-col gap-4 md:flex-row md:items-center md:justify-between'>
          <div className='flex flex-wrap gap-2'>
            <button type='button' onClick={() => setFilter('todos')} className={activeClass('todos')}>
              Todos ({users.length})
            </button>
            {managedUserRoles.map((role) => (
              <button
                key={role}
                type='button'
                onClick={() => setFilter(role)}
                className={activeClass(role)}
              >
                {formatRoleLabel(role)} ({stats.byRole[role] ?? 0})
              </button>
            ))}
            <button
              type='button'
              onClick={() => {
                setFilter('todos');
                setSearch('');
              }}
              className='rounded-full border border-transparent px-3 py-1 text-xs text-gray-500 hover:bg-gray-100'
            >
              Limpiar filtros
            </button>
          </div>
          <div className='flex items-center gap-2'>
            <div className='flex items-center gap-2 rounded-full border border-white/20 bg-white/40 px-4 py-1.5 text-sm text-foreground/60'>
            <Search className='h-4 w-4 text-foreground/40' />
            <input
              placeholder='Buscar por nombre, email o teléfono'
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className='bg-transparent outline-none placeholder:text-foreground/40'
            />
          </div>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className='text-base'>Usuarios registrados</CardTitle>
            <p className='text-sm text-muted-foreground'>Gestiona la información de cada cuenta y controla su estado.</p>
          </CardHeader>
          <CardContent>
            {filteredUsers.length === 0 ? (
              <div className='rounded-lg border border-dashed border-gray-300 p-6 text-center text-sm text-muted-foreground'>
                No se encontraron usuarios con los filtros seleccionados.
              </div>
            ) : (
              <div className='space-y-6'>
                {groupedUsers.map((group) => {
                  const groupActiveCount = group.users.filter((u) => u.activo).length;
                  const orgLabel = group.organization?.name ?? (group.key ? 'Empresa desconocida' : 'Sin empresa');
                  return (
                    <div key={group.key || 'unassigned'} className='rounded-2xl border border-white/15 bg-white/60 p-4 shadow-sm backdrop-blur-xl'>
                      <div className='mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between'>
                        <div className='space-y-1'>
                          <div className='flex flex-wrap items-center gap-2'>
                            <h3 className='text-sm font-semibold text-foreground'>{orgLabel}</h3>
                            {group.organization?.status === 'inactive' ? (
                              <span className='rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs text-amber-800'>
                                Inactiva
                              </span>
                            ) : null}
                          </div>
                          <p className='text-xs text-foreground/60'>
                            {groupActiveCount} activos · {group.users.length - groupActiveCount} desactivados
                          </p>
                        </div>
                      </div>

                      <div className='space-y-4'>
                        {group.users.map((user) => {
                          const currentOrgId = getAssignedOrgId(user) ?? '';
                          const draftOrgId = orgDraftByUserId[user.userId] ?? currentOrgId;
                          const mode = transferModeByUserId[user.userId] ?? 'A';
                          const transferDisabled =
                            isPending ||
                            (pendingState.type === 'transfer-org' && pendingState.userId === user.userId && pending) ||
                            draftOrgId.trim() === currentOrgId;

                          return (
                            <div key={user.userId} className='rounded-lg border border-gray-200 bg-white p-4 shadow-sm'>
                              <div className='flex flex-col gap-4 md:flex-row md:items-start md:justify-between'>
                                <div className='space-y-2 text-sm'>
                                  <div className='flex flex-wrap items-center gap-2'>
                                    <span className='text-base font-semibold text-gray-900'>{user.nombre}</span>
                                    <span
                                      className={cn(
                                        'rounded-full px-2 py-0.5 text-xs font-medium uppercase tracking-wide',
                                        user.activo
                                          ? 'bg-green-50 text-green-700 border border-green-200'
                                          : 'bg-red-50 text-red-700 border border-red-200',
                                      )}
                                    >
                                      {user.activo ? 'Activo' : 'Inactivo'}
                                    </span>
                                    <span className='rounded-full bg-gray-100 px-2 py-0.5 text-xs uppercase tracking-wide text-gray-600'>
                                      {Array.from(new Set([user.role, ...(user.globalRoles ?? [])]))
                                        .map((r) => formatRoleLabel(r))
                                        .join(' · ')}
                                    </span>
                                  </div>
                                  <div className='grid gap-1 text-muted-foreground md:grid-cols-2'>
                                    <span>
                                      <strong>Email:</strong> {user.email}
                                    </span>
                                    {user.telefono && (
                                      <span>
                                        <strong>Teléfono:</strong> {user.telefono}
                                      </span>
                                    )}
                                    {user.rut && (
                                      <span>
                                        <strong>RUT:</strong> {user.rut}
                                      </span>
                                    )}
                                    <span>
                                      <strong>Último acceso:</strong>{' '}
                                      {user.lastSignInAt ? formatRelativeTime(user.lastSignInAt) : 'Sin registros'}
                                    </span>
                                    {user.createdAt && (
                                      <span>
                                        <strong>Creado:</strong> {formatDateShort(user.createdAt)}
                                      </span>
                                    )}
                                  </div>
                                </div>

                                <div className='flex flex-col gap-3 md:items-end'>
                                  <div className='flex flex-wrap items-center gap-2'>
                                    <Button
                                      variant='outline'
                                      size='sm'
                                      onClick={() => handleStartIdentityVerification(user)}
                                      disabled={isPending || verifyingUserId !== null}
                                      className='flex items-center gap-2'
                                    >
                                      {verifyingUserId === user.userId ? (
                                        <>
                                          <Loader2 className='h-4 w-4 animate-spin' />
                                          Validando…
                                        </>
                                      ) : (
                                        'Validar identidad'
                                      )}
                                    </Button>
                                    <Button
                                      variant='outline'
                                      size='sm'
                                      onClick={() => handleToggleActive(user)}
                                      disabled={isPending}
                                      className='flex items-center gap-2'
                                    >
                                      {user.activo ? <XCircle className='h-4 w-4' /> : <Plus className='h-4 w-4' />}
                                      {user.activo ? 'Desactivar' : 'Activar'}
                                    </Button>
                                    <Button
                                      variant='outline'
                                      size='sm'
                                      onClick={() => handleEdit(user.userId)}
                                      disabled={isPending}
                                      className='flex items-center gap-2'
                                    >
                                      <Pencil className='h-4 w-4' /> Editar
                                    </Button>
                                    <Button
                                      variant='destructive'
                                      size='sm'
                                      onClick={() => handleDelete(user.userId)}
                                      disabled={isPending}
                                      className='flex items-center gap-2'
                                    >
                                      <Trash2 className='h-4 w-4' /> Eliminar
                                    </Button>
                                  </div>

                                  <div className='flex flex-wrap items-center gap-2 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2'>
                                    <span className='text-xs font-medium text-muted-foreground'>Empresa</span>
                                    <select
                                      value={draftOrgId}
                                      onChange={(e) =>
                                        setOrgDraftByUserId((prev) => ({ ...prev, [user.userId]: e.target.value }))
                                      }
                                      disabled={isPending}
                                      className='h-9 min-w-56 rounded-md border border-input bg-background px-3 py-2 text-sm'
                                    >
                                      {user.role === 'cliente' ? (
                                        <option value=''>Sin empresa</option>
                                      ) : (
                                        <option value=''>Selecciona empresa…</option>
                                      )}
                                      {draftOrgId && !organizationsById.has(draftOrgId) ? (
                                        <option value={draftOrgId}>Empresa actual (no disponible)</option>
                                      ) : null}
                                      {(organizations ?? []).map((org) => (
                                        <option key={org.id} value={org.id} disabled={org.status !== 'active'}>
                                          {org.name} {org.status !== 'active' ? '(inactiva)' : ''}
                                        </option>
                                      ))}
                                    </select>

                                    {user.role !== 'cliente' ? (
                                      <select
                                        value={mode}
                                        onChange={(e) =>
                                          setTransferModeByUserId((prev) => ({
                                            ...prev,
                                            [user.userId]: (e.target.value as 'A' | 'B') ?? 'A',
                                          }))
                                        }
                                        disabled={isPending}
                                        className='h-9 rounded-md border border-input bg-background px-2 py-2 text-sm'
                                      >
                                        <option value='A'>Modo A</option>
                                        <option value='B'>Modo B</option>
                                      </select>
                                    ) : null}

                                    <Button
                                      type='button'
                                      size='sm'
                                      variant='secondary'
                                      className='h-9'
                                      onClick={() => handleTransferOrg(user)}
                                      disabled={transferDisabled}
                                    >
                                      {pendingState.type === 'transfer-org' && pendingState.userId === user.userId && pending
                                        ? 'Moviendo...'
                                        : 'Mover'}
                                    </Button>
                                  </div>
                                </div>
                              </div>

                              {editingUserId === user.userId && (
                                <div className='mt-4 rounded-md border border-gray-200 bg-gray-50 p-4'>
                                  <form onSubmit={handleUpdate} className='grid gap-3 md:grid-cols-2 lg:grid-cols-3'>
                          <div className='space-y-1'>
                            <Label htmlFor={`edit-nombre-${user.userId}`}>Nombre</Label>
                            <Input
                              id={`edit-nombre-${user.userId}`}
                              name='nombre'
                              defaultValue={user.nombre}
                              required
                              disabled={isPending}
                            />
                          </div>
                          <div className='space-y-1'>
                            <Label htmlFor={`edit-email-${user.userId}`}>Email</Label>
                            <Input
                              id={`edit-email-${user.userId}`}
                              name='email'
                              type='email'
                              defaultValue={user.email}
                              required
                              disabled={isPending}
                            />
                          </div>
                          <div className='space-y-1'>
                            <Label htmlFor={`edit-password-${user.userId}`}>Nueva contraseña (opcional)</Label>
                            <Input
                              id={`edit-password-${user.userId}`}
                              name='password'
                              type='password'
                              placeholder='Deja vacío para mantener la actual'
                              disabled={isPending}
                            />
                          </div>
                          <div className='space-y-1'>
                            <Label htmlFor={`edit-role-${user.userId}`}>Rol</Label>
                            <select
                              id={`edit-role-${user.userId}`}
                              name='role'
                              defaultValue={user.role}
                              className='w-full rounded-md border border-input bg-background px-3 py-2 text-sm'
                              disabled={isPending}
                            >
                              {managedUserRoles.map((role) => (
                                <option key={role} value={role}>
                                  {formatRoleLabel(role)}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div className='space-y-1 md:col-span-2 lg:col-span-3'>
                            <Label>Roles globales (RBAC)</Label>
                            <p className='text-xs text-muted-foreground'>
                              Selecciona múltiples roles. El de mayor nivel queda como principal (compatibilidad).
                            </p>
                            <div className='mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-4'>
                              {managedUserRoles.map((role) => {
                                const current = Array.from(new Set([user.role, ...(user.globalRoles ?? [])]));
                                const checked = current.includes(role);
                                return (
                                  <label
                                    key={role}
                                    className='flex items-center gap-2 rounded-lg border border-white/30 bg-white px-3 py-2 text-sm'
                                  >
                                    <input
                                      type='checkbox'
                                      name='global_roles'
                                      value={role}
                                      defaultChecked={checked}
                                      disabled={isPending}
                                      className='h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500'
                                    />
                                    <span>{formatRoleLabel(role)}</span>
                                  </label>
                                );
                              })}
                            </div>
                          </div>
                          <div className='space-y-1'>
                            <Label htmlFor={`edit-rut-${user.userId}`}>RUT</Label>
                            <Input
                              id={`edit-rut-${user.userId}`}
                              name='rut'
                              defaultValue={user.rut ?? ''}
                              placeholder='12345678-9'
                              disabled={isPending}
                            />
                          </div>
                          <div className='space-y-1'>
                            <Label htmlFor={`edit-telefono-${user.userId}`}>Teléfono</Label>
                            <Input
                              id={`edit-telefono-${user.userId}`}
                              name='telefono'
                              defaultValue={user.telefono ?? ''}
                              placeholder='+569...'
                              disabled={isPending}
                            />
                          </div>
                          <div className='flex items-center gap-2 pt-2'>
                            <input
                              id={`edit-activo-${user.userId}`}
                              name='activo'
                              type='checkbox'
                              defaultChecked={user.activo}
                              disabled={isPending}
                              className='h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500'
                            />
                            <Label htmlFor={`edit-activo-${user.userId}`} className='text-xs text-muted-foreground'>
                              Cuenta habilitada
                            </Label>
                          </div>
                          <div className='md:col-span-2 lg:col-span-3 flex items-center gap-2 pt-2'>
                            <Button type='submit' disabled={isPending}>
                              {pendingState.type === 'update' && pendingState.userId === user.userId && pending
                                ? 'Guardando cambios...'
                                : 'Guardar cambios'}
                            </Button>
                            <Button
                              type='button'
                              variant='ghost'
                              disabled={isPending}
                              onClick={() => setEditingUserId(null)}
                            >
                              Cancelar
                            </Button>
                          </div>
                        </form>
                      </div>
                    )}
                  </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </section>

      <Separator />
      <p className='text-xs text-muted-foreground'>
        Consejo: comparte la contraseña temporal de forma segura y solicita al usuario cambiarla en su primer
        acceso.
      </p>
    </div>
  );
}
