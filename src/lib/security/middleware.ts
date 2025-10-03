import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { logLoginAttempt, createUserSession } from '@/lib/actions/audit';

interface SecurityConfig {
  maxLoginAttempts: number;
  lockoutDurationMinutes: number;
  sessionTimeoutHours: number;
  maxConcurrentSessions: number;
  enableIpWhitelist: boolean;
  allowedFileTypes: string[];
}

/**
 * Obtiene la configuración de seguridad
 */
async function getSecurityConfig(): Promise<SecurityConfig> {
  try {
    const supabase = createClient();
    
    const { data: settings, error } = await supabase
      .from('security_settings')
      .select('setting_key, setting_value')
      .eq('is_active', true);

    if (error) {
      console.error('Error fetching security settings:', error);
      return getDefaultSecurityConfig();
    }

    const config: Partial<SecurityConfig> = {};
    
    settings?.forEach(setting => {
      switch (setting.setting_key) {
        case 'max_login_attempts':
          config.maxLoginAttempts = parseInt(setting.setting_value);
          break;
        case 'lockout_duration_minutes':
          config.lockoutDurationMinutes = parseInt(setting.setting_value);
          break;
        case 'session_timeout_hours':
          config.sessionTimeoutHours = parseInt(setting.setting_value);
          break;
        case 'max_concurrent_sessions':
          config.maxConcurrentSessions = parseInt(setting.setting_value);
          break;
        case 'enable_ip_whitelist':
          config.enableIpWhitelist = setting.setting_value === 'true';
          break;
        case 'allowed_file_types':
          config.allowedFileTypes = JSON.parse(setting.setting_value);
          break;
      }
    });

    return { ...getDefaultSecurityConfig(), ...config };
  } catch (error) {
    console.error('Error in getSecurityConfig:', error);
    return getDefaultSecurityConfig();
  }
}

/**
 * Configuración de seguridad por defecto
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
 * Obtiene la IP real del cliente
 */
function getClientIP(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for');
  const realIP = request.headers.get('x-real-ip');
  
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  
  if (realIP) {
    return realIP;
  }
  
  return request.ip || 'unknown';
}

/**
 * Verifica si una IP está en la lista blanca
 */
async function isIPWhitelisted(ip: string): Promise<boolean> {
  try {
    const supabase = createClient();
    
    const { data: whitelist, error } = await supabase
      .from('security_settings')
      .select('setting_value')
      .eq('setting_key', 'ip_whitelist')
      .eq('is_active', true)
      .single();

    if (error || !whitelist) {
      return true; // Si no hay lista blanca, permitir acceso
    }

    const allowedIPs: string[] = JSON.parse(whitelist.setting_value);
    return allowedIPs.includes(ip) || allowedIPs.includes('*');
  } catch (error) {
    console.error('Error checking IP whitelist:', error);
    return true; // En caso de error, permitir acceso
  }
}

/**
 * Verifica si una IP está bloqueada por intentos fallidos
 */
async function isIPBlocked(ip: string, config: SecurityConfig): Promise<boolean> {
  try {
    const supabase = createClient();
    
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

    return (attempts?.length || 0) >= config.maxLoginAttempts;
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
    const supabase = createClient();
    
    const { data: sessions, error } = await supabase
      .from('user_sessions')
      .select('id')
      .eq('user_id', userId)
      .eq('is_active', true)
      .gt('expires_at', new Date().toISOString());

    if (error) {
      console.error('Error checking concurrent sessions:', error);
      return true; // En caso de error, permitir
    }

    return (sessions?.length || 0) < config.maxConcurrentSessions;
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
  const userAgent = request.headers.get('user-agent')?.toLowerCase() || '';
  
  // SQL Injection patterns
  const sqlPatterns = [
    'union select', 'drop table', 'insert into', 'delete from',
    'update set', 'exec(', 'execute(', 'sp_', 'xp_'
  ];
  
  sqlPatterns.forEach(pattern => {
    if (url.includes(pattern)) {
      threats.push('sql_injection');
    }
  });
  
  // XSS patterns
  const xssPatterns = [
    '<script', 'javascript:', 'onerror=', 'onload=', 'onclick='
  ];
  
  xssPatterns.forEach(pattern => {
    if (url.includes(pattern)) {
      threats.push('xss_attempt');
    }
  });
  
  // Path traversal
  if (url.includes('../') || url.includes('..\\')) {
    threats.push('path_traversal');
  }
  
  // Bot detection
  const botPatterns = [
    'bot', 'crawler', 'spider', 'scraper', 'curl', 'wget'
  ];
  
  botPatterns.forEach(pattern => {
    if (userAgent.includes(pattern)) {
      threats.push('bot_access');
    }
  });
  
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
    const supabase = createClient();
    
    await supabase
      .from('audit_logs')
      .insert({
        table_name: 'security_events',
        record_id: crypto.randomUUID(),
        action: 'SECURITY_EVENT',
        new_values: {
          type,
          description,
          ip_address: ip,
          user_agent: userAgent,
          metadata
        },
        ip_address: ip,
        user_agent: userAgent,
        severity,
        category: 'security',
        description
      });
  } catch (error) {
    console.error('Error logging security event:', error);
  }
}

/**
 * Middleware principal de seguridad
 */
export async function securityMiddleware(request: NextRequest): Promise<NextResponse | null> {
  const ip = getClientIP(request);
  const userAgent = request.headers.get('user-agent') || '';
  const config = await getSecurityConfig();
  
  // Verificar lista blanca de IPs
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
  
  // Verificar si la IP está bloqueada
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
  
  // Detectar patrones de ataque
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
    
    // Bloquear ataques críticos
    if (threats.includes('sql_injection') || threats.includes('xss_attempt')) {
      return new NextResponse('Forbidden', { status: 403 });
    }
  }
  
  // Validar uploads de archivos
  if (request.method === 'POST' && request.url.includes('/upload')) {
    const contentType = request.headers.get('content-type') || '';
    
    if (contentType.includes('multipart/form-data')) {
      // Aquí se podría implementar validación adicional de archivos
      // Por ahora, registramos el evento
      await logSecurityEvent(
        'file_upload',
        'Intento de subida de archivo',
        ip,
        userAgent,
        'info',
        { content_type: contentType }
      );
    }
  }
  
  // Rate limiting básico (se podría implementar con Redis en producción)
  const rateLimitKey = `rate_limit:${ip}`;
  // Implementar rate limiting aquí si es necesario
  
  return null; // Continuar con el request
}

/**
 * Middleware para validación de sesiones
 */
export async function sessionValidationMiddleware(request: NextRequest): Promise<NextResponse | null> {
  const sessionToken = request.cookies.get('session-token')?.value;
  
  if (!sessionToken) {
    return null; // No hay sesión, continuar
  }
  
  try {
    const supabase = createClient();
    
    const { data: session, error } = await supabase
      .from('user_sessions')
      .select('*')
      .eq('session_token', sessionToken)
      .eq('is_active', true)
      .single();
    
    if (error || !session) {
      // Sesión inválida, limpiar cookie
      const response = NextResponse.next();
      response.cookies.delete('session-token');
      return response;
    }
    
    // Verificar expiración
    if (new Date(session.expires_at) < new Date()) {
      // Sesión expirada
      await supabase
        .from('user_sessions')
        .update({ is_active: false, ended_at: new Date().toISOString() })
        .eq('id', session.id);
      
      const response = NextResponse.next();
      response.cookies.delete('session-token');
      return response;
    }
    
    // Actualizar última actividad
    await supabase
      .from('user_sessions')
      .update({ last_activity: new Date().toISOString() })
      .eq('id', session.id);
    
  } catch (error) {
    console.error('Error in session validation:', error);
  }
  
  return null; // Continuar
}

/**
 * Headers de seguridad
 */
export function addSecurityHeaders(response: NextResponse): NextResponse {
  // Content Security Policy
  response.headers.set(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' https:; frame-ancestors 'none';"
  );
  
  // Otros headers de seguridad
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  response.headers.set('X-XSS-Protection', '1; mode=block');
  
  // HSTS (solo en HTTPS)
  if (process.env.NODE_ENV === 'production') {
    response.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
  
  return response;
}
