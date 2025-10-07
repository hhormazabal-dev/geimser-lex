import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

// Rutas públicas que NO requieren sesión
const PUBLIC_PATHS = [
  '/login',
  '/api',                 // toda tu API (login/logout/callback/webhooks/etc.)
  '/_next',               // assets de Next
  '/favicon.ico',
  '/apple-touch-icon.png',
  '/logo.svg',
];

function isPublic(pathname: string) {
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + '/'));
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Permitir archivos estáticos o rutas marcadas como públicas
  if (isPublic(pathname) || /\.\w+$/.test(pathname)) {
    return NextResponse.next();
  }

  // Lee cookies que setea /api/auth/callback
  const access = req.cookies.get('sb-access-token')?.value;
  const refresh = req.cookies.get('sb-refresh-token')?.value;
  const isLoggedIn = Boolean(access || refresh);

  // Si está logueado e intenta ir a /login, lo mandamos al dashboard
  if (pathname === '/login' && isLoggedIn) {
    const url = req.nextUrl.clone();
    url.pathname = '/dashboard';
    url.search = '';
    return NextResponse.redirect(url);
  }

  // Si NO está logueado y no es público → a /login con redirectTo
  if (!isLoggedIn && !isPublic(pathname)) {
    const url = req.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('redirectTo', pathname + req.nextUrl.search);
    return NextResponse.redirect(url);
  }

  // Todo ok
  return NextResponse.next();
}

// Aplica a todo excepto _next, archivos estáticos y api (ya filtrado arriba también)
export const config = {
  matcher: ['/((?!_next|.*\\..*).*)'],
};
