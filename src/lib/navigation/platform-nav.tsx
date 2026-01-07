import type { SidebarItem } from '@/components/layout/AppSidebar';
import type { Role } from '@/lib/auth/roles';
import {
  Bell,
  Building2,
  ClipboardList,
  Crown,
  ArrowLeftRight,
  FolderOpen,
  Gavel,
  Inbox,
  LayoutDashboard,
  ListChecks,
  Settings,
  ShieldCheck,
  ShieldAlert,
  Users,
  UserPlus,
  Wallet,
} from 'lucide-react';

export function buildSidebarItems(
  role: Role,
  opts?: { isSuperAdmin?: boolean; canTransition?: boolean },
): SidebarItem[] {
  const isSuperAdmin = Boolean(opts?.isSuperAdmin);
  const canTransition = Boolean(opts?.canTransition);
  const transitionItem: SidebarItem | null = canTransition
    ? {
        href: '/transicion',
        label: 'Transicion',
        description: 'Reasigna casos entre empresas',
        icon: <ArrowLeftRight className="h-4 w-4" />,
        group: isSuperAdmin ? 'Super Admin' : 'Administración',
        keywords: ['transicion', 'reasignar', 'casos', 'empresas'],
      }
    : null;
  const superAdminItems: SidebarItem[] = !isSuperAdmin
    ? []
    : [
        {
          href: '/admin-global',
          label: 'Dashboard',
          description: 'MRR, clientes y KPIs',
          icon: <LayoutDashboard className="h-4 w-4" />,
          group: 'Super Admin',
          keywords: ['dashboard', 'kpis', 'mrr', 'saas'],
        },
        {
          href: '/admin-global/organizations',
          label: 'Empresas',
          description: 'Setup, pricing y estado',
          icon: <Crown className="h-4 w-4" />,
          group: 'Super Admin',
          keywords: ['empresas', 'organizaciones', 'tenants', 'billing'],
        },
        {
          href: '/admin-global/transfers',
          label: 'Transferencias',
          description: 'Historial de traslados',
          icon: <ListChecks className="h-4 w-4" />,
          group: 'Super Admin',
          keywords: ['transferencias', 'migración', 'auditoría'],
        },
        {
          href: '/compliance',
          label: 'Compliance',
          description: 'Monitoreo y fuentes',
          icon: <ShieldCheck className="h-4 w-4" />,
          group: 'Super Admin',
          keywords: ['compliance', 'monitoreo', 'pjud', 'fuentes'],
        },
        {
          href: '/dashboard/admin/users',
          label: 'Mantenedor de usuarios',
          description: 'Cuentas, roles y accesos',
          icon: <Users className="h-4 w-4" />,
          group: 'Super Admin',
          keywords: ['usuarios', 'roles', 'permisos', 'equipo'],
        },
        ...(transitionItem ? [transitionItem] : []),
      ];

  // Super admin: solo navegación de negocio (evita menús operativos).
  if (isSuperAdmin) return superAdminItems;

  if (role === 'admin_firma') {
    const items: SidebarItem[] = [
      {
        href: '/dashboard/admin',
        label: 'Panel ejecutivo',
        description: 'Indicadores clave y riesgos',
        icon: <LayoutDashboard className="h-4 w-4" />,
        group: 'Principal',
        keywords: ['dashboard', 'tablero', 'kpis', 'indicadores', 'riesgo'],
      },
      {
        href: '/inbox',
        label: 'Inbox',
        description: 'Vencidos, bloqueos y solicitudes',
        icon: <Inbox className="h-4 w-4" />,
        group: 'Principal',
        keywords: ['pendientes', 'vencidos', 'triage'],
      },
      {
        href: '/cases',
        label: 'Casos',
        description: 'Expedientes activos y control',
        icon: <FolderOpen className="h-4 w-4" />,
        group: 'Operación',
        keywords: ['expedientes', 'causas', 'pipeline'],
      },
      {
        href: '/billing',
        label: 'Cobros',
        description: 'Pagos, estados y montos',
        icon: <Wallet className="h-4 w-4" />,
        group: 'Finanzas',
        keywords: ['cobros', 'pagos', 'honorarios'],
      },
      {
        href: '/clients',
        label: 'Clientes',
        description: 'Directorio y creación',
        icon: <UserPlus className="h-4 w-4" />,
        group: 'CRM',
        keywords: ['cartera', 'contactos', 'personas', 'empresas'],
      },
      {
        href: '/dashboard/admin/clients',
        label: 'Cartera',
        description: 'Top clientes y distribución',
        icon: <Building2 className="h-4 w-4" />,
        group: 'CRM',
        keywords: ['portafolio', 'valor', 'ranking'],
      },
      {
        href: '/notifications',
        label: 'Notificaciones',
        description: 'Recordatorios y alertas',
        icon: <Bell className="h-4 w-4" />,
        group: 'Comunicación',
        keywords: ['alertas', 'recordatorios'],
      },
      {
        href: '/pjud',
        label: 'PJUD',
        description: 'Consulta causas por RUT',
        icon: <Gavel className="h-4 w-4" />,
        group: 'Herramientas',
        keywords: ['poder judicial', 'rut', 'consulta'],
      },
      {
        href: '/compliance',
        label: 'Compliance',
        description: 'Monitoreo 24/7 y fuentes',
        icon: <ShieldCheck className="h-4 w-4" />,
        group: 'Herramientas',
        keywords: ['compliance', 'monitoreo', 'stakeholders', 'rut'],
      },
      {
        href: '/dashboard/admin/users',
        label: 'Equipo y permisos',
        description: 'Roles, accesos y estados',
        icon: <Users className="h-4 w-4" />,
        group: 'Administración',
        keywords: ['usuarios', 'roles', 'permisos'],
      },
      {
        href: '/empresa',
        label: 'Empresa',
        description: 'Miembros y abogados',
        icon: <Building2 className="h-4 w-4" />,
        group: 'Administración',
        keywords: ['empresa', 'organización', 'miembros'],
      },
      {
        href: '/admin/security',
        label: 'Seguridad',
        description: 'Auditoría y alertas críticas',
        icon: <ShieldAlert className="h-4 w-4" />,
        group: 'Administración',
        badge: 'Nuevo',
        keywords: ['auditoría', 'riesgo'],
      },
      {
        href: '/settings',
        label: 'Configuración',
        description: 'Preferencias y plantillas',
        icon: <Settings className="h-4 w-4" />,
        group: 'Administración',
        keywords: ['preferencias', 'plantillas'],
      },
    ];

    if (transitionItem) items.push(transitionItem);
    // Nota: el mantenedor global de usuarios es solo para super_admin.
    return items.filter((i) => i.href !== '/dashboard/admin/users');
  }

  if (role === 'abogado') {
    const items: SidebarItem[] = [
      ...superAdminItems,
      {
        href: '/dashboard/abogado',
        label: 'Mi tablero',
        description: 'Resumen diario y vencimientos',
        icon: <LayoutDashboard className="h-4 w-4" />,
        group: 'Principal',
        keywords: ['dashboard', 'tablero', 'día'],
      },
      {
        href: '/inbox',
        label: 'Inbox',
        description: 'Vencidos, bloqueos y solicitudes',
        icon: <Inbox className="h-4 w-4" />,
        group: 'Principal',
        keywords: ['pendientes', 'vencidos', 'solicitudes'],
      },
      {
        href: '/cases',
        label: 'Mis casos',
        description: 'Expedientes asignados',
        icon: <FolderOpen className="h-4 w-4" />,
        group: 'Operación',
        keywords: ['expedientes', 'causas'],
      },
      {
        href: '/billing',
        label: 'Cobros',
        description: 'Pagos y estados por expediente',
        icon: <Wallet className="h-4 w-4" />,
        group: 'Finanzas',
        keywords: ['cobros', 'pagos', 'honorarios'],
      },
      {
        href: '/notifications',
        label: 'Notificaciones',
        description: 'Recordatorios y alertas',
        icon: <Bell className="h-4 w-4" />,
        group: 'Comunicación',
        keywords: ['alertas'],
      },
      {
        href: '/pjud',
        label: 'PJUD',
        description: 'Consulta causas por RUT',
        icon: <Gavel className="h-4 w-4" />,
        group: 'Herramientas',
        keywords: ['poder judicial', 'rut'],
      },
      {
        href: '/compliance',
        label: 'Compliance',
        description: 'Monitoreo y sujetos por RUT',
        icon: <ShieldCheck className="h-4 w-4" />,
        group: 'Herramientas',
        keywords: ['compliance', 'monitoreo', 'rut'],
      },
    ];

    if (transitionItem) items.push(transitionItem);
    return items;
  }

  if (role === 'analista') {
    const items: SidebarItem[] = [
      ...superAdminItems,
      {
        href: '/dashboard/analista',
        label: 'Panel analista',
        description: 'Intake, validación y asignación',
        icon: <LayoutDashboard className="h-4 w-4" />,
        group: 'Principal',
        keywords: ['intake', 'validación', 'bandeja'],
      },
      {
        href: '/inbox',
        label: 'Inbox',
        description: 'Triage de vencidos y solicitudes',
        icon: <Inbox className="h-4 w-4" />,
        group: 'Principal',
        keywords: ['pendientes', 'vencidos', 'solicitudes'],
      },
      {
        href: '/cases',
        label: 'Casos',
        description: 'Seguimiento del pipeline',
        icon: <ClipboardList className="h-4 w-4" />,
        group: 'Operación',
        keywords: ['expedientes', 'causas', 'workflow'],
      },
      {
        href: '/billing',
        label: 'Cobros',
        description: 'Pagos, estados y montos',
        icon: <Wallet className="h-4 w-4" />,
        group: 'Finanzas',
        keywords: ['cobros', 'pagos', 'honorarios'],
      },
      {
        href: '/clients',
        label: 'Clientes',
        description: 'Directorio y creación',
        icon: <UserPlus className="h-4 w-4" />,
        group: 'CRM',
        keywords: ['cartera', 'contactos'],
      },
      {
        href: '/notifications',
        label: 'Notificaciones',
        description: 'Recordatorios y alertas',
        icon: <Bell className="h-4 w-4" />,
        group: 'Comunicación',
        keywords: ['alertas'],
      },
      {
        href: '/pjud',
        label: 'PJUD',
        description: 'Consulta causas por RUT',
        icon: <Gavel className="h-4 w-4" />,
        group: 'Herramientas',
        keywords: ['poder judicial', 'rut'],
      },
      {
        href: '/compliance',
        label: 'Compliance',
        description: 'Monitoreo y fuentes',
        icon: <ShieldCheck className="h-4 w-4" />,
        group: 'Herramientas',
        keywords: ['compliance', 'monitoreo'],
      },
    ];

    if (transitionItem) items.push(transitionItem);
    return items;
  }

  // cliente/usuario
  return [
    ...superAdminItems,
    {
      href: '/dashboard/cliente',
      label: 'Mi portal',
      description: 'Seguimiento de casos y avances',
      icon: <LayoutDashboard className="h-4 w-4" />,
      group: 'Principal',
      keywords: ['portal', 'avance'],
    },
    {
      href: '/notifications',
      label: 'Notificaciones',
      description: 'Recordatorios y alertas',
      icon: <Bell className="h-4 w-4" />,
      group: 'Comunicación',
      keywords: ['alertas'],
    },
  ];
}
