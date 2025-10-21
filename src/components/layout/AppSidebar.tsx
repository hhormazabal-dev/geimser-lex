'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import LogoutButton from '@/components/LogoutButton';
import { Menu } from 'lucide-react';
import { useState } from 'react';

export interface SidebarItem {
  href: string;
  label: string;
  description?: string;
  icon: ReactNode;
  badge?: string;
}

interface AppSidebarProps {
  items: SidebarItem[];
  profile: {
    nombre: string;
    role: string;
    email: string | null;
  };
  footer?: ReactNode;
}

export function AppSidebar({ items, profile, footer }: AppSidebarProps) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const renderLink = (item: SidebarItem) => {
    const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
    return (
      <Link
        key={item.href}
        href={item.href}
        onClick={() => setOpen(false)}
        className={cn(
          'group relative flex items-start gap-3 rounded-2xl border border-white/10 bg-white/20 px-4 py-3 transition-all hover:border-primary/30 hover:bg-primary/10',
          isActive && 'border-primary/40 bg-primary/15 text-primary shadow',
        )}
      >
        <span className='mt-0.5 inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/20 bg-white/50 text-foreground/70'>
          {item.icon}
        </span>
        <span className='flex-1 text-sm leading-snug'>
          <span className='font-medium flex items-center gap-2'>
            {item.label}
            {item.badge && (
              <span className='rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-primary'>
                {item.badge}
              </span>
            )}
          </span>
          {item.description && (
            <span className='mt-0.5 block text-xs text-foreground/60'>{item.description}</span>
          )}
        </span>
      </Link>
    );
  };

  return (
    <>
      <aside className='hidden h-full min-h-screen w-64 flex-col gap-6 border-r border-white/15 bg-white/55 px-5 py-6 shadow-xl backdrop-blur-2xl lg:flex'>
        <div className='space-y-8'>
          <div>
            <p className='text-xs uppercase tracking-[0.2em] text-foreground/50'>Navegación</p>
            <div className='mt-4 space-y-2'>{items.map(renderLink)}</div>
          </div>
        </div>
        <div className='rounded-2xl border border-white/20 bg-white/40 px-4 py-3 text-sm text-foreground/70'>
          <p className='font-medium text-foreground'>{profile.nombre}</p>
          <p className='text-xs uppercase tracking-wide text-foreground/50'>{profile.role.replace('_', ' ')}</p>
          {profile.email && <p className='mt-1 text-xs text-foreground/50'>{profile.email}</p>}
          <div className='mt-3'>
            <LogoutButton />
          </div>
        </div>
        {footer && (
          <div className='rounded-2xl border border-dashed border-white/30 bg-white/20 px-4 py-4 text-xs text-foreground/60'>
            {footer}
          </div>
        )}
      </aside>

      <div className='sticky top-0 z-30 flex items-center justify-between border-b border-white/20 bg-white/70 px-4 py-3 backdrop-blur-xl lg:hidden'>
        <button
          type='button'
          onClick={() => setOpen((prev) => !prev)}
          className='inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/30 bg-white/60 text-foreground shadow'
        >
          <Menu className='h-5 w-5' />
        </button>
        <div className='text-right text-xs text-foreground/60'>
          <p className='font-semibold text-foreground'>{profile.nombre}</p>
          <p>{profile.role.replace('_', ' ')}</p>
        </div>
      </div>

      {open && (
        <div className='fixed inset-x-4 top-20 z-30 rounded-3xl border border-white/20 bg-white/80 p-4 shadow-2xl backdrop-blur-2xl lg:hidden'>
          <div className='space-y-2'>{items.map(renderLink)}</div>
          <div className='mt-4 rounded-2xl border border-white/20 bg-white/40 px-4 py-3 text-sm text-foreground/70'>
            <p className='font-medium text-foreground'>{profile.nombre}</p>
            <p className='text-xs uppercase tracking-wide text-foreground/50'>{profile.role.replace('_', ' ')}</p>
            {profile.email && <p className='mt-1 text-xs text-foreground/50'>{profile.email}</p>}
            <div className='mt-3'>
              <LogoutButton />
            </div>
          </div>
          {footer && (
            <div className='mt-4 rounded-2xl border border-dashed border-white/30 bg-white/20 px-4 py-3 text-xs text-foreground/60'>
              {footer}
            </div>
          )}
        </div>
      )}
    </>
  );
}
