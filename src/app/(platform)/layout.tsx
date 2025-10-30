export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

import type { ReactNode } from 'react';
import { redirect } from 'next/navigation';
import { AppSidebar, type SidebarItem } from '@/components/layout/AppSidebar';
import { getCurrentProfile, type Role } from '@/lib/auth/roles';
import {
  LayoutDashboard,
  FolderOpen,
  Settings,
  ShieldAlert,
  Users,
  UserPlus,
  Briefcase,
  ClipboardList,
  FilePlus2,
} from 'lucide-react';

interface PlatformLayoutProps {
  children: ReactNode;
}

function buildSidebarItems(role: Role): SidebarItem[] {
  if (role === 'admin_firma') {
    return [
      {
        href: '/dashboard/admin',
        label: 'Panel ejecutivo',
        description: 'Indicadores clave de la firma',
        icon: <LayoutDashboard className="h-4 w-4" />,
      },
      {
        href: '/cases',
        label: 'Casos de la firma',
        description: 'Visión global de expedientes activos',
        icon: <FolderOpen className="h-4 w-4" />,
      },
      {
        href: '/clients',
        label: 'Clientes',
        description: 'Crea perfiles antes de asignar casos',
        icon: <UserPlus className="h-4 w-4" />,
      },
      {
        href: '/dashboard/admin/users',
        label: 'Equipo y permisos',
        description: 'Roles, accesos y estados',
        icon: <Users className="h-4 w-4" />,
      },
      {
        href: '/admin/security',
        label: 'Seguridad',
        description: 'Auditoría y alertas críticas',
        icon: <ShieldAlert className="h-4 w-4" />,
        badge: 'Nuevo',
      },
      {
        href: '/settings',
        label: 'Configuración',
        description: 'Preferencias, catálogos y plantillas',
        icon: <Settings className="h-4 w-4" />,
      },
    ];
  }

  if (role === 'abogado') {
    return [
      {
        href: '/dashboard/abogado',
        label: 'Mi tablero',
        description: 'Resumen diario y vencimientos próximos',
        icon: <LayoutDashboard className="h-4 w-4" />,
      },
      {
        href: '/cases',
        label: 'Mis casos',
        description: 'Gestiona expedientes asignados',
        icon: <Briefcase className="h-4 w-4" />,
      },
      {
        href: '/cases/new',
        label: 'Registrar caso',
        description: 'Crea un nuevo expediente para la firma',
        icon: <FilePlus2 className="h-4 w-4" />,
      },
    ];
  }

  if (role === 'analista') {
    return [
      {
        href: '/dashboard/analista',
        label: 'Bandeja de analista',
        description: 'Priorización de ingresos y validación',
        icon: <LayoutDashboard className="h-4 w-4" />,
      },
      {
        href: '/cases',
        label: 'Casos en preparación',
        description: 'Seguimiento de expedientes asignados',
        icon: <ClipboardList className="h-4 w-4" />,
      },
      {
        href: '/cases/new',
        label: 'Nuevo caso',
        description: 'Inicia la recopilación y asignación',
        icon: <FilePlus2 className="h-4 w-4" />,
      },
      {
        href: '/clients',
        label: 'Clientes',
        description: 'Registra personas y empresas',
        icon: <UserPlus className="h-4 w-4" />,
      },
    ];
  }

  // cliente
  return [
    {
      href: '/dashboard/cliente',
      label: 'Portal cliente',
      description: 'Seguimiento de tus procesos y avances',
      icon: <LayoutDashboard className="h-4 w-4" />,
    },
    {
      href: '/cases',
      label: 'Documentos y expedientes',
      description: 'Consulta los casos compartidos con tu firma',
      icon: <FolderOpen className="h-4 w-4" />,
    },
  ];
}

export default async function PlatformLayout({ children }: PlatformLayoutProps) {
  const profile = await getCurrentProfile();

  if (!profile) {
    redirect('/login');
  }

  const role = ((profile as any)._role_override as Role | null) ?? profile.role;
  const sidebarItems = buildSidebarItems(role);

  const footerHint = (
    <div className="space-y-2">
      <p className="text-sm font-semibold text-foreground">¿Necesitas soporte?</p>
      <p className="text-xs leading-relaxed text-foreground/70">
        Escríbenos a <span className="font-medium text-primary">soporte@altiusignite.com</span> o agenda una asesoría
        onboarding desde tu dashboard.
      </p>
    </div>
  );

  const sidebarProfile = {
    nombre: profile.nombre,
    role,
    email: (profile as any)?.email ?? null,
  };

  return (
    <div className="relative isolate min-h-screen bg-transparent">
      {/* Fondo difuminado */}
      <div className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(circle_at_top,_rgba(148,163,184,0.14),_transparent_55%),radial-gradient(circle_at_bottom,_rgba(59,130,246,0.12),_transparent_50%)]" />
      <div className="absolute inset-x-0 top-0 -z-10 mx-auto h-32 w-full max-w-[1600px] rounded-full bg-white/50 blur-3xl opacity-70" />

      {/* Layout general */}
      <div className="relative flex min-h-screen flex-col lg:flex-row">
        <AppSidebar items={sidebarItems} profile={sidebarProfile} footer={footerHint} />

        <main className="relative flex-1 lg:pl-0">
          <div className="pb-12 pt-8 sm:pt-10 lg:pt-0">
            {/* ← AQUÍ SE CORRIGE EL ANCHO */}
            <div className="mx-auto w-full max-w-[1600px] px-6 lg:px-8">
              {children}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}