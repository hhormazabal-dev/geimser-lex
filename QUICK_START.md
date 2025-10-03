# LEXCHILE - Guía de Instalación Rápida

Esta guía te permitirá tener LEXCHILE funcionando en menos de 10 minutos.

## Requisitos Previos

- Node.js 18+ y npm 8+
- Docker (para Supabase local)
- Git

## Instalación en 5 Pasos

### 1. Clonar e Instalar
```bash
git clone https://github.com/lexchile/lexchile-platform.git
cd lexchile-platform
npm install
```

### 2. Configurar Supabase
```bash
# Instalar Supabase CLI
npm install -g supabase

# Iniciar servicios locales
supabase start
```

### 3. Configurar Variables de Entorno
```bash
cp .env.example .env.local
# Editar .env.local con las credenciales que aparecen en la terminal
```

### 4. Configurar Base de Datos
```bash
supabase db reset
```

### 5. Ejecutar la Aplicación
```bash
npm run dev
```

¡Listo! La aplicación estará disponible en http://localhost:3000

## Credenciales de Prueba

- **Admin**: admin@lexchile.com / admin123
- **Abogado**: abogado@lexchile.com / password123

## Comandos Útiles

```bash
# Ejecutar tests
npm test

# Solo tests unitarios
npm run test:unit

# Solo tests e2e
npm run test:e2e

# Verificar código
npm run lint

# Formatear código
npm run format

# Construir para producción
npm run build
```

## Estructura de Archivos Importantes

```
/lexchile
├── src/app/                # Rutas de la aplicación
├── src/components/         # Componentes React
├── src/lib/               # Lógica de negocio
├── supabase/              # Configuración de base de datos
├── tests/                 # Tests unitarios y e2e
└── scripts/               # Scripts de utilidad
```

## Solución de Problemas

### Error: "Supabase not found"
```bash
npm install -g supabase
```

### Error: "Port 3000 already in use"
```bash
npm run dev -- -p 3001
```

### Error de permisos en Docker
```bash
sudo usermod -aG docker $USER
# Reiniciar sesión
```

## Próximos Pasos

1. Lee el [README.md](README.md) completo
2. Revisa la [documentación de contribución](CONTRIBUTING.md)
3. Explora los tests en `/tests`
4. Personaliza la configuración según tus necesidades

¿Necesitas ayuda? Abre un issue en GitHub o contacta al equipo de desarrollo.
