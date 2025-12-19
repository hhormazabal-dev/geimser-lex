import type { SidebarItem } from '@/components/layout/AppSidebar';
import type { Role } from '@/lib/auth/roles';
import {
  Bell,
  Building2,
  ClipboardList,
  FolderOpen,
  Gavel,
  Inbox,
  LayoutDashboard,
  Settings,
  ShieldAlert,
  Users,
  UserPlus,
} from 'lucide-react';

export function buildSidebarItems(role: Role): SidebarItem[] {
  if (role === 'admin_firma') {
    return [
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
        href: '/dashboard/admin/users',
        label: 'Equipo y permisos',
        description: 'Roles, accesos y estados',
        icon: <Users className="h-4 w-4" />,
        group: 'Administración',
        keywords: ['usuarios', 'roles', 'permisos'],
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
  }

  if (role === 'abogado') {
    return [
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
    ];
  }

  if (role === 'analista') {
    return [
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
    ];
  }

  // cliente/usuario
  return [
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

