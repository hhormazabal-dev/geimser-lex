# LEXCHILE - Guía de Deployment

Esta guía explica cómo desplegar LEXCHILE en diferentes entornos de producción.

## Opciones de Deployment

### 1. Vercel + Supabase Cloud (Recomendado)

La opción más sencilla y escalable para producción.

#### Configuración de Supabase Cloud

1. **Crear proyecto en Supabase**:
   - Ve a [supabase.com](https://supabase.com)
   - Crea una nueva organización y proyecto
   - Anota la URL del proyecto y las API keys

2. **Configurar base de datos**:
   ```bash
   # Conectar al proyecto remoto
   supabase link --project-ref YOUR_PROJECT_REF
   
   # Aplicar migraciones
   supabase db push
   
   # Aplicar datos de prueba (opcional)
   supabase db seed
   ```

3. **Configurar Storage**:
   - En el dashboard de Supabase, ve a Storage
   - Crea un bucket llamado `documents`
   - Configura las políticas de acceso según tus necesidades

#### Deployment en Vercel

1. **Preparar el proyecto**:
   ```bash
   # Construir localmente para verificar
   npm run build
   ```

2. **Configurar variables de entorno en Vercel**:
   ```
   NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
   SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
   ```

3. **Desplegar**:
   ```bash
   # Instalar Vercel CLI
   npm install -g vercel
   
   # Desplegar
   vercel --prod
   ```

### 2. Docker + Railway/Render

Para mayor control sobre el entorno de ejecución.

#### Dockerfile

```dockerfile
FROM node:18-alpine AS base

# Install dependencies only when needed
FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci

# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

ENV NEXT_TELEMETRY_DISABLED 1

RUN npm run build

# Production image, copy all the files and run next
FROM base AS runner
WORKDIR /app

ENV NODE_ENV production
ENV NEXT_TELEMETRY_DISABLED 1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public

COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

ENV PORT 3000

CMD ["node", "server.js"]
```

#### docker-compose.yml

```yaml
version: '3.8'
services:
  lexchile:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NEXT_PUBLIC_SUPABASE_URL=${NEXT_PUBLIC_SUPABASE_URL}
      - NEXT_PUBLIC_SUPABASE_ANON_KEY=${NEXT_PUBLIC_SUPABASE_ANON_KEY}
      - SUPABASE_SERVICE_ROLE_KEY=${SUPABASE_SERVICE_ROLE_KEY}
    restart: unless-stopped
```

### 3. Self-Hosted con Supabase Self-Hosted

Para máximo control y privacidad de datos.

#### Configuración de Supabase Self-Hosted

1. **Clonar Supabase**:
   ```bash
   git clone --depth 1 https://github.com/supabase/supabase
   cd supabase/docker
   ```

2. **Configurar variables**:
   ```bash
   cp .env.example .env
   # Editar .env con configuraciones de producción
   ```

3. **Iniciar servicios**:
   ```bash
   docker-compose up -d
   ```

## Configuraciones de Producción

### Variables de Entorno Requeridas

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Next.js
NEXTAUTH_URL=https://your-domain.com
NEXTAUTH_SECRET=your-secret-key

# Email (opcional, para notificaciones)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password

# Monitoring (opcional)
SENTRY_DSN=your-sentry-dsn
```

### Configuración de Seguridad

1. **Headers de Seguridad**:
   Ya configurados en `middleware.ts`

2. **CORS**:
   ```typescript
   // next.config.mjs
   const nextConfig = {
     async headers() {
       return [
         {
           source: '/api/:path*',
           headers: [
             { key: 'Access-Control-Allow-Origin', value: 'https://your-domain.com' },
             { key: 'Access-Control-Allow-Methods', value: 'GET,POST,PUT,DELETE' },
           ],
         },
       ];
     },
   };
   ```

3. **Rate Limiting**:
   Configurar en tu proxy reverso (Nginx, Cloudflare, etc.)

### Monitoreo y Logging

#### Sentry (Recomendado)

```bash
npm install @sentry/nextjs
```

```javascript
// sentry.client.config.js
import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  tracesSampleRate: 1.0,
});
```

#### Logs Estructurados

```typescript
// lib/logger.ts
import winston from 'winston';

export const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' }),
  ],
});
```

## CI/CD Pipeline

### GitHub Actions

```yaml
# .github/workflows/deploy.yml
name: Deploy to Production

on:
  push:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm ci
      - run: npm run test
      - run: npm run build

  deploy:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: amondnet/vercel-action@v20
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.ORG_ID }}
          vercel-project-id: ${{ secrets.PROJECT_ID }}
          vercel-args: '--prod'
```

## Backup y Recuperación

### Backup de Base de Datos

```bash
# Backup automático con Supabase
supabase db dump --file backup-$(date +%Y%m%d).sql

# Restaurar backup
supabase db reset --file backup-20241203.sql
```

### Backup de Storage

```bash
# Script de backup de archivos
#!/bin/bash
DATE=$(date +%Y%m%d)
supabase storage cp --recursive supabase://documents ./backups/documents-$DATE/
```

## Escalabilidad

### Optimizaciones de Performance

1. **Next.js Optimizations**:
   ```javascript
   // next.config.mjs
   const nextConfig = {
     experimental: {
       ppr: true, // Partial Prerendering
     },
     images: {
       formats: ['image/webp', 'image/avif'],
     },
   };
   ```

2. **Database Indexing**:
   ```sql
   -- Índices adicionales para producción
   CREATE INDEX CONCURRENTLY idx_cases_search ON cases USING gin(to_tsvector('spanish', caratulado || ' ' || nombre_cliente));
   CREATE INDEX CONCURRENTLY idx_audit_logs_performance ON audit_logs(created_at, user_id, table_name);
   ```

3. **CDN Configuration**:
   - Configurar Cloudflare o AWS CloudFront
   - Cachear assets estáticos
   - Optimizar imágenes automáticamente

### Monitoring de Performance

```typescript
// lib/monitoring.ts
export function trackPerformance(name: string, fn: () => Promise<any>) {
  const start = performance.now();
  return fn().finally(() => {
    const duration = performance.now() - start;
    console.log(`${name} took ${duration}ms`);
  });
}
```

## Checklist de Deployment

- [ ] Variables de entorno configuradas
- [ ] Base de datos migrada
- [ ] Tests pasando
- [ ] Build exitoso
- [ ] Configuración de dominio
- [ ] Certificados SSL
- [ ] Monitoreo configurado
- [ ] Backups programados
- [ ] Documentación actualizada

## Solución de Problemas

### Error: "Database connection failed"
- Verificar variables de entorno
- Comprobar conectividad de red
- Revisar logs de Supabase

### Error: "Build failed"
- Verificar versión de Node.js
- Limpiar cache: `npm run clean && npm ci`
- Revisar errores de TypeScript

### Performance Issues
- Analizar con `npm run analyze`
- Revisar queries de base de datos
- Optimizar imágenes y assets

¿Necesitas ayuda con el deployment? Contacta al equipo de desarrollo o abre un issue en GitHub.
