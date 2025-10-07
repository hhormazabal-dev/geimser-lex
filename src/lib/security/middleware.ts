'use server';

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';

interface SecurityConfig {
  maxLoginAttempts: number;
  lockoutDurationMinutes: number;
  sessionTimeoutHours: number;
  maxConcurrentSessions: number;
  enableIpWhitelist: boolean;
  allowedFileTypes: string[];
}

/** Util: convierte Json | null a string | null */
function toStringOrNull(v: unknown): string | null {
  if (v == null) return null;
  if (typeof v === 'string') return v;
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  try {
    return JSON.stringify(v);
  } catch {
    return null;
  }
}

/** Util: parsea array de strings desde Json | null o string JSONificado */
function toStringArray(v: unknown): string[] {
  if (Array.isArray(v)) {
    return v.filter((x) => typeof x === 'string') as string[];
  }
  if (typeof v === 'string') {
    try {
      const parsed = JSON.parse(v);
      if (Array.isArray(parsed)) {
        return parsed.filter((x) => typeof x === 'string') as string[];
      }
      // también aceptamos lista separada por comas
      return v.split(',').map((s) => s.trim()).filter(Boolean);
    } catch {
      return v.split(',').map((s) => s.trim()).filter(Boolean);
    }
  }
  return [];
}

/**
 * Config por defecto
 */
function getDefaultSecurityConfig(): SecurityConfig {
  return {
    maxLoginAttempts: 5,
    lockoutDurationMinutes: 30,
    sessionTimeoutHours: 8,
    maxConcurrentSessions: 3,
    enableIpWhitelist: false,
    allowedFileTypes: ['pdf', 'doc', 'docx', 'jpg', 'jpeg', 'png', 'txt'],
  };
}

/**
 * Obtiene la configuración de seguridad
 */
async function getSecurityConfig(): Promise<SecurityConfig> {
  try {
    const supabase = await createServerClient();

    const { data: settings, error } = await supabase
      .from('security_settings')
      .select('setting_key, setting_value')
      .eq('is_active', true);

    if (error) {
      console.error('Error fetching security settings:', error);
      return getDefaultSecurityConfig();
    }

    const config: Partial<SecurityConfig> = {};
    (settings ?? []).forEach((setting: any) => {
      const raw = setting.setting_value as unknown;
      switch (setting.setting_key) {
        case 'max_login_attempts': {
          const s = toStringOrNull(raw);
          const n = s ? parseInt(s, 10) : NaN;
          if (!Number.isNaN(n)) config.maxLoginAttempts = n;
          break;
        }
        case 'lockout_duration_minutes': {
          const s = toStringOrNull(raw);
          const n = s ? parseInt(s, 10) : NaN;
          if (!Number.isNaN(n)) config.lockoutDurationMinutes = n;
          break;
        }
        case 'session_timeout_hours': {
          const s = toStringOrNull(raw);
          const n = s ? parseInt(s, 10) : NaN;
          if (!Number.isNaN(n)) config.sessionTimeoutHours = n;
          break;
        }
        case 'max_concurrent_sessions': {
          const s = toStringOrNull(raw);
          const n = s ? parseInt(s, 10) : NaN;
          if (!Number.isNaN(n)) config.maxConcurrentSessions = n;
          break;
        }
        case 'enable_ip_whitelist': {
          if (typeof raw === 'boolean') {
            config.enableIpWhitelist = raw;
          } else {
            const s = toStringOrNull(raw);
            config.enableIpWhitelist = s === 'true';
          }
          break;
        }
        case 'allowed_file_types': {
          config.allowedFileTypes = toStringArray(raw);
          break;
        }
      }
    });

    return { ...getDefaultSecurityConfig(), ...config };
  } catch (error) {
    console.error('Error in getSecurityConfig:', error);
    return getDefaultSecurityConfig();
  }
}

/**
 * Obtiene la IP real del cliente
 */
function getClientIP(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for');
  const realIP = request.headers.get('x-real-ip');

  if (forwarded) {
    const first = forwarded.split(',')[0]?.trim();
    if (first) return first;
  }
  if (realIP) return realIP;

  // NextRequest no expone .ip tipado; evitamos usarla
  return 'unknown';
}

/**
 * Verifica si una IP está en la lista blanca
 */
async function isIPWhitelisted(ip: string): Promise<boolean> {
  try {
    const supabase = await createServerClient();

    const { data: whitelist, error } = await supabase
      .from('security_settings')
      .select('setting_value')
      .eq('setting_key', 'ip_whitelist')
      .eq('is_active', true)
      .maybeSingle();

    if (error) {
      console.error('Error reading IP whitelist:', error);
      return true;
    }
    if (!whitelist) {
      return true; // si no hay config, permitir
    }

    const allowedIPs = toStringArray((whitelist as any).setting_value);
    if (allowedIPs.length === 0) return true;

    return allowedIPs.includes(ip) || allowedIPs.includes('*');
  } catch (error) {
    console.error('Error checking IP whitelist:', error);
    return true; // en caso de error, permitir
  }
}

/**
 * Verifica si una IP está bloqueada por intentos fallidos
 */
async function isIPBlocked(ip: string, config: SecurityConfig): Promise<boolean> {
  try {
    const supabase = await createServerClient();

    const lockoutTime = new Date();
    lockoutTime.setMinutes(lockoutTime.getMinutes() - config.lockoutDurationMinutes);

    const { data: attempts, error } = await supabase
      .from('login_attempts')
      .select('id')
      .eq('ip_address', ip)
      .eq('success', false)
      .gte('created_at', lockoutTime.toISOString());

    if (error) {
      console.error('Error checking blocked IP:', error);
      return false;
    }

    return (attempts?.length ?? 0) >= config.maxLoginAttempts;
  } catch (error) {
    console.error('Error in isIPBlocked:', error);
    return false;
  }
}

/**
 * Verifica el límite de sesiones concurrentes
 */
async function checkConcurrentSessions(userId: string, config: SecurityConfig): Promise<boolean> {
  try {
    const supabase = await createServerClient();

    const { data: sessions, error } = await supabase
      .from('user_sessions')
      .select('id')
      .eq('user_id', userId)
      .eq('is_active', true)
      .gt('expires_at', new Date().toISOString());

    if (error) {
      console.error('Error checking concurrent sessions:', error);
      return true; // en caso de error, no bloquear
    }

    return (sessions?.length ?? 0) < config.maxConcurrentSessions;
  } catch (error) {
    console.error('Error in checkConcurrentSessions:', error);
    return true;
  }
}

/**
 * Valida el tipo de archivo subido
 */
function validateFileType(filename: string, config: SecurityConfig): boolean {
  const extension = filename.split('.').pop()?.toLowerCase();
  return extension ? config.allowedFileTypes.includes(extension) : false;
}

/**
 * Detecta patrones de ataque comunes
 */
function detectAttackPatterns(request: NextRequest): string[] {
  const threats: string[] = [];
  const url = request.url.toLowerCase();
  const userAgent = request.headers.get('user-agent')?.toLowerCase() ?? '';

  // SQL Injection
  const sqlPatterns = [
    'union select',
    'drop table',
    'insert into',
    'delete from',
    'update set',
    'exec(',
    'execute(',
    'sp_',
    'xp_',
  ];
  for (const p of sqlPatterns) {
    if (url.includes(p)) {
      threats.push('sql_injection');
      break;
    }
  }

  // XSS
  const xssPatterns = ['<script', 'javascript:', 'onerror=', 'onload=', 'onclick='];
  for (const p of xssPatterns) {
    if (url.includes(p)) {
      threats.push('xss_attempt');
      break;
    }
  }

  // Path traversal
  if (url.includes('../') || url.includes('..\\')) {
    threats.push('path_traversal');
  }

  // Bot detection
  const botPatterns = ['bot', 'crawler', 'spider', 'scraper', 'curl', 'wget'];
  for (const p of botPatterns) {
    if (userAgent.includes(p)) {
      threats.push('bot_access');
      break;
    }
  }

  return threats;
}

/**
 * Registra evento de seguridad
 */
async function logSecurityEvent(
  type: string,
  description: string,
  ip: string,
  userAgent: string,
  severity: 'low' | 'info' | 'warning' | 'high' | 'critical' = 'info',
  metadata?: any
) {
  try {
    const supabase = await createServerClient();

    await supabase.from('audit_logs').insert({
      table_name: 'security_events',
      record_id: typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : undefined,
      action: 'SECURITY_EVENT',
      new_values: {
        type,
        description,
        ip_address: ip,
        user_agent: userAgent,
        metadata,
      },
      ip_address: ip as unknown as string, // según tus types podría ser unknown
      user_agent: userAgent,
      severity,
      category: 'security',
      description,
    } as any);
  } catch (error) {
    console.error('Error logging security event:', error);
  }
}

/**
 * Middleware principal de seguridad
 */
export async function securityMiddleware(request: NextRequest): Promise<NextResponse | null> {
  const ip = getClientIP(request);
  const userAgent = request.headers.get('user-agent') ?? '';
  const config = await getSecurityConfig();

  // Lista blanca
  if (config.enableIpWhitelist) {
    const isWhitelisted = await isIPWhitelisted(ip);
    if (!isWhitelisted) {
      await logSecurityEvent(
        'ip_not_whitelisted',
        `Acceso denegado desde IP no autorizada: ${ip}`,
        ip,
        userAgent,
        'warning'
      );
      return new NextResponse('Access Denied', { status: 403 });
    }
  }

  // IP bloqueada
  const isBlocked = await isIPBlocked(ip, config);
  if (isBlocked) {
    await logSecurityEvent(
      'ip_blocked',
      `Acceso denegado desde IP bloqueada por intentos fallidos: ${ip}`,
      ip,
      userAgent,
      'high'
    );
    return new NextResponse('Too Many Attempts', { status: 429 });
  }

  // Patrones de ataque
  const threats = detectAttackPatterns(request);
  if (threats.length > 0) {
    await logSecurityEvent(
      'attack_detected',
      `Patrones de ataque detectados: ${threats.join(', ')}`,
      ip,
      userAgent,
      'critical',
      { threats, url: request.url }
    );

    if (threats.includes('sql_injection') || threats.includes('xss_attempt')) {
      return new NextResponse('Forbidden', { status: 403 });
    }
  }

  // Uploads (solo audit)
  if (request.method === 'POST' && request.url.includes('/upload')) {
    const contentType = request.headers.get('content-type') ?? '';
    if (contentType.includes('multipart/form-data')) {
      await logSecurityEvent('file_upload', 'Intento de subida de archivo', ip, userAgent, 'info', {
        content_type: contentType,
      });
      // Aquí podrías validar partes del form-data si lo deseas
    }
  }

  // Rate limiting: placeholder (usa Redis en prod)
  // const rateLimitKey = `rate_limit:${ip}`;

  return null; // continuar con el request
}

/**
 * Middleware para validación de sesiones
 */
export async function sessionValidationMiddleware(request: NextRequest): Promise<NextResponse | null> {
  const sessionToken = request.cookies.get('session-token')?.value;
  if (!sessionToken) return null;

  try {
    const supabase = await createServerClient();

    const { data: session, error } = await supabase
      .from('user_sessions')
      .select('*')
      .eq('session_token', sessionToken)
      .eq('is_active', true)
      .maybeSingle();

    if (error || !session) {
      const response = NextResponse.next();
      response.cookies.delete('session-token');
      return response;
    }

    // expires_at puede ser null
    const exp = session.expires_at ? new Date(session.expires_at) : null;
    if (!exp || exp < new Date()) {
      await supabase
        .from('user_sessions')
        .update({ is_active: false, ended_at: new Date().toISOString() })
        .eq('id', session.id);

      const response = NextResponse.next();
      response.cookies.delete('session-token');
      return response;
    }

    // Actualizar última actividad (best-effort)
    await supabase
      .from('user_sessions')
      .update({ last_activity: new Date().toISOString() })
      .eq('id', session.id);
  } catch (error) {
    console.error('Error in session validation:', error);
  }

  return null; // continuar
}

/**
 * Headers de seguridad
 */
export function addSecurityHeaders(response: NextResponse): NextResponse {
  response.headers.set(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' https:; frame-ancestors 'none';"
  );
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  response.headers.set('X-XSS-Protection', '1; mode=block');

  if (process.env.NODE_ENV === 'production') {
    response.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }

  return response;
}
