import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => request.cookies.set(name, value));
          response = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Verificar si el usuario está autenticado
  const { data: { user }, error } = await supabase.auth.getUser();

  // Rutas que requieren autenticación
  const protectedRoutes = ['/dashboard', '/cases', '/settings'];
  const isProtectedRoute = protectedRoutes.some(route => 
    request.nextUrl.pathname.startsWith(route)
  );

  // Rutas de autenticación
  const authRoutes = ['/login', '/register'];
  const isAuthRoute = authRoutes.some(route => 
    request.nextUrl.pathname.startsWith(route)
  );

  // Si no hay usuario y está intentando acceder a una ruta protegida
  if (!user && isProtectedRoute) {
    const redirectUrl = new URL('/login', request.url);
    redirectUrl.searchParams.set('redirectTo', request.nextUrl.pathname);
    return NextResponse.redirect(redirectUrl);
  }

  // Si hay usuario y está en una ruta de autenticación, redirigir al dashboard
  if (user && isAuthRoute) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  // Verificar permisos específicos por rol
  if (user && isProtectedRoute) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('user_id', user.id)
      .single();

    if (profile) {
      // Rutas específicas para admin
      if (request.nextUrl.pathname.startsWith('/dashboard/admin') && profile.role !== 'admin_firma') {
        return NextResponse.redirect(new URL('/dashboard', request.url));
      }

      // Rutas específicas para abogados
      if (request.nextUrl.pathname.startsWith('/dashboard/abogado') && 
          profile.role !== 'abogado' && profile.role !== 'admin_firma') {
        return NextResponse.redirect(new URL('/dashboard', request.url));
      }

      // Rutas de configuración solo para admin
      if (request.nextUrl.pathname.startsWith('/settings') && profile.role !== 'admin_firma') {
        return NextResponse.redirect(new URL('/dashboard', request.url));
      }
    }
  }

  return response;
}

/**
 * Verifica si el usuario tiene acceso a una ruta específica
 */
export async function checkRouteAccess(
  request: NextRequest,
  requiredRole?: string
): Promise<boolean> {
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll() {
          // No-op for read-only access
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    return false;
  }

  if (!requiredRole) {
    return true;
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('user_id', user.id)
    .single();

  if (!profile) {
    return false;
  }

  // Admin tiene acceso a todo
  if (profile.role === 'admin_firma') {
    return true;
  }

  return profile.role === requiredRole;
}
