// src/components/landing/Navbar.tsx
'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

const menu = [
  {
    label: 'Productos',
    items: ['Gestión de casos', 'Documentos', 'Línea de tiempo', 'Portal cliente'],
  },
  {
    label: 'Soluciones',
    items: ['Estudios corporativos', 'Equipos multi-sede', 'Operación de cumplimiento', 'Dirección ejecutiva'],
  },
  {
    label: 'Recursos',
    items: ['Guías de operación', 'Metodología Xel', 'Blog corporativo'],
  },
  {
    label: 'Nosotros',
    items: ['Equipo', 'Cultura', 'Seguridad'],
  },
] as const;


export function Navbar({ ctaHref }: { ctaHref: string }) {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 16);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <header
      className={[
        'fixed left-0 top-0 z-50 w-full transition-all duration-300 font-sans',
        scrolled
          ? 'bg-white/95 shadow-lg backdrop-blur-md border-b border-slate-200/50'
          : 'bg-slate-900/80 backdrop-blur-md border-b border-white/10',
      ].join(' ')}
    >
      <nav className="mx-auto flex w-full max-w-7xl items-center justify-between px-6 py-4 sm:px-8 lg:px-12">
        <Link
          href="/"
          className={`flex items-center gap-3 text-sm font-bold tracking-[0.2em] uppercase transition-colors ${scrolled ? 'text-slate-900 hover:text-slate-700' : 'text-white hover:text-blue-200'
            }`}
        >
          <span className={`flex h-8 w-8 items-center justify-center rounded ${scrolled ? 'bg-slate-900 text-white' : 'bg-white/10 backdrop-blur-sm border border-white/20 text-white'
            }`}>
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" aria-hidden="true" stroke="currentColor" strokeWidth="2.5">
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
          Xel Chile
        </Link>

        <div className={`hidden items-center gap-8 text-xs font-semibold uppercase tracking-[0.15em] lg:flex ${scrolled ? 'text-slate-600' : 'text-white/80'
          }`}>
          {menu.map((item) => (
            <div key={item.label} className="group relative">
              <button
                type="button"
                className={`flex items-center gap-1 transition ${scrolled ? 'hover:text-slate-900' : 'hover:text-white'
                  }`}
              >
                {item.label}
                <svg className={`w-3 h-3 transition-colors ${scrolled ? 'text-slate-400 group-hover:text-slate-900' : 'text-white/50 group-hover:text-white'
                  }`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              <div className="pointer-events-none absolute left-0 top-8 w-64 translate-y-2 rounded-lg border border-slate-200 bg-white p-2 shadow-xl opacity-0 transition-all duration-200 group-hover:pointer-events-auto group-hover:translate-y-0 group-hover:opacity-100">
                <div className="flex flex-col">
                  {item.items.map((subItem) => (
                    <Link key={subItem} href="#" className="flex items-center justify-between px-4 py-3 rounded-md hover:bg-slate-50 transition-colors group/item">
                      <span className="text-slate-600 group-hover/item:text-slate-900 font-medium normal-case tracking-normal text-sm">{subItem}</span>
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          ))}
          <Link href="#contacto" className={`transition ${scrolled ? 'hover:text-slate-900' : 'hover:text-white'}`}>
            Contacto
          </Link>
        </div>

        <div className="flex items-center gap-4">
          <Link
            href={ctaHref}
            className={`rounded-lg px-5 py-2.5 text-xs font-bold uppercase tracking-[0.15em] transition-all duration-300 shadow-sm hover:shadow-md ${scrolled
              ? 'bg-blue-900 text-white hover:bg-blue-800'
              : 'bg-white text-blue-900 hover:bg-blue-50'
              }`}
          >
            Portal
          </Link>
        </div>
      </nav>
    </header>
  );
}

