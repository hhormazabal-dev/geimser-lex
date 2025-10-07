'use client';

import { useMemo, useState, useTransition } from 'react';
import Link from 'next/link';
import { Plus, Pencil, Trash2, Users, XCircle } from 'lucide-react';
import {
  createManagedUser,
  updateManagedUser,
  deleteManagedUser,
  deactivateManagedUser,
  type ManagedUser,
} from '@/lib/actions/admin-users';
import { managedUserRoles } from '@/lib/validators/admin-users';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { cn, formatRelativeTime, formatDateShort } from '@/lib/utils';

interface AdminUserManagerProps {
  initialUsers: ManagedUser[];
}

type RoleFilter = 'todos' | (typeof managedUserRoles)[number];

type PendingState = {
  type: 'create' | 'update' | 'delete' | 'deactivate' | null;
  userId?: string;
};

export function AdminUserManager({ initialUsers }: AdminUserManagerProps) {
  const { toast } = useToast();
  const [users, setUsers] = useState(initialUsers);
  const [filter, setFilter] = useState<RoleFilter>('todos');
  const [search, setSearch] = useState('');
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [pendingState, setPendingState] = useState<PendingState>({ type: null });

  const isPending = pendingState.type !== null && pending;

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

  const stats = useMemo(() => {
    const total = users.length;
    const byRole = managedUserRoles.reduce<Record<string, number>>((acc, role) => {
      acc[role] = users.filter((user) => user.role === role).length;
      return acc;
    }, {});

    const inactive = users.filter((user) => !user.activo).length;

    return { total, byRole, inactive };
  }, [users]);

  const resetState = () => {
    setPendingState({ type: null });
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
      'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
      filter === role
        ? 'border-blue-600 bg-blue-50 text-blue-700'
        : 'border-transparent text-gray-600 hover:bg-gray-100',
    );

  return (
    <div className='space-y-10'>
      <section>
        <Card className='border-blue-100'>
          <CardHeader className='flex flex-row items-center justify-between'>
            <div>
              <CardTitle className='flex items-center gap-2 text-base text-blue-800'>
                <Users className='h-5 w-5' /> Gestión de usuarios
              </CardTitle>
              <p className='mt-2 text-sm text-muted-foreground'>
                Administra las cuentas de tu firma: crea accesos, edita roles y controla el estado de cada
                usuario.
              </p>
            </div>
            <Button asChild variant='outline'>
              <Link href='/dashboard/admin'>Volver al dashboard</Link>
            </Button>
          </CardHeader>
          <CardContent>
            <dl className='grid gap-4 text-sm md:grid-cols-4'>
              <div className='rounded-md border border-blue-100 bg-blue-50 p-4 text-blue-700'>
                <dt className='text-xs uppercase tracking-wide'>Usuarios activos</dt>
                <dd className='text-2xl font-semibold'>{stats.total - stats.inactive}</dd>
              </div>
              <div className='rounded-md border border-gray-200 p-4'>
                <dt className='text-xs uppercase tracking-wide'>Administradores</dt>
                <dd className='text-xl font-semibold'>{stats.byRole['admin_firma'] ?? 0}</dd>
              </div>
              <div className='rounded-md border border-gray-200 p-4'>
                <dt className='text-xs uppercase tracking-wide'>Abogados</dt>
                <dd className='text-xl font-semibold'>{stats.byRole['abogado'] ?? 0}</dd>
              </div>
              <div className='rounded-md border border-gray-200 p-4'>
                <dt className='text-xs uppercase tracking-wide'>Clientes</dt>
                <dd className='text-xl font-semibold'>{stats.byRole['cliente'] ?? 0}</dd>
              </div>
            </dl>
          </CardContent>
        </Card>
      </section>

      <section>
        <Card>
          <CardHeader>
            <CardTitle className='flex items-center gap-2 text-base'>
              <Plus className='h-4 w-4 text-blue-600' /> Crear nuevo usuario
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreate} className='grid gap-4 md:grid-cols-2 lg:grid-cols-3'>
              <div className='space-y-2'>
                <Label htmlFor='create-nombre'>Nombre completo</Label>
                <Input id='create-nombre' name='nombre' placeholder='Nombre y apellidos' required disabled={isPending} />
              </div>
              <div className='space-y-2'>
                <Label htmlFor='create-email'>Email</Label>
                <Input
                  id='create-email'
                  name='email'
                  type='email'
                  placeholder='usuario@empresa.com'
                  required
                  disabled={isPending}
                />
              </div>
              <div className='space-y-2'>
                <Label htmlFor='create-password'>Contraseña temporal</Label>
                <Input
                  id='create-password'
                  name='password'
                  type='password'
                  placeholder='Mínimo 8 caracteres'
                  required
                  disabled={isPending}
                />
              </div>
              <div className='space-y-2'>
                <Label htmlFor='create-role'>Rol</Label>
                <select
                  id='create-role'
                  name='role'
                  className='w-full rounded-md border border-input bg-background px-3 py-2 text-sm'
                  defaultValue='abogado'
                  disabled={isPending}
                >
                  {managedUserRoles.map((role) => (
                    <option key={role} value={role}>
                      {role.replace('_', ' ')}
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
              <div className='flex items-center gap-2 pt-4'>
                <input
                  id='create-activo'
                  name='activo'
                  type='checkbox'
                  defaultChecked
                  disabled={isPending}
                  className='h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500'
                />
                <Label htmlFor='create-activo' className='text-sm text-muted-foreground'>
                  Habilitar acceso inmediato
                </Label>
              </div>
              <div className='md:col-span-2 lg:col-span-3'>
                <Button type='submit' disabled={isPending}>
                  {pendingState.type === 'create' && pending ? 'Creando...' : 'Crear usuario'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </section>

      <section className='space-y-4'>
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
                {role.replace('_', ' ')} ({stats.byRole[role] ?? 0})
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
            <Input
              placeholder='Buscar por nombre, email o teléfono'
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className='md:w-72'
            />
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
              <div className='space-y-4'>
                {filteredUsers.map((user) => (
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
                            {user.role.replace('_', ' ')}
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
                      <div className='flex flex-wrap items-center gap-2'>
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
                                  {role.replace('_', ' ')}
                                </option>
                              ))}
                            </select>
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
                ))}
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
