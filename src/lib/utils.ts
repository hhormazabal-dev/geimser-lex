import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

/* ───────────────── helpers internos ───────────────── */

function s(val: string | null | undefined): string {
  return val ?? ''
}

function toDate(input: string | Date | null | undefined): Date {
  if (!input) return new Date('Invalid Date')
  const d = typeof input === 'string' ? new Date(input) : input
  return isNaN(d.getTime()) ? new Date('Invalid Date') : d
}

/* ───────────────── utilidad tailwind ───────────────── */

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/* ───────────────── formatos de dinero/fecha ───────────────── */

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency: 'CLP',
    minimumFractionDigits: 0,
  }).format(amount)
}

export function formatDate(date?: string | Date | null): string {
  const d = toDate(date ?? null)
  if (isNaN(d.getTime())) return ''
  return new Intl.DateTimeFormat('es-CL', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(d)
}

export function formatDateShort(date?: string | Date | null): string {
  const d = toDate(date ?? null)
  if (isNaN(d.getTime())) return ''
  return new Intl.DateTimeFormat('es-CL', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d)
}

export function formatDateTime(date?: string | Date | null): string {
  const d = toDate(date ?? null)
  if (isNaN(d.getTime())) return ''
  return new Intl.DateTimeFormat('es-CL', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d)
}

export function formatRelativeTime(date?: string | Date | null): string {
  const d = toDate(date ?? null)
  if (isNaN(d.getTime())) return 'Fecha inválida'

  const diff = (Date.now() - d.getTime()) / 1000
  if (diff < 60) return 'hace unos segundos'
  if (diff < 3600) return `hace ${Math.floor(diff / 60)} minutos`
  if (diff < 86400) return `hace ${Math.floor(diff / 3600)} horas`
  if (diff < 2592000) return `hace ${Math.floor(diff / 86400)} días`
  if (diff < 31104000) return `hace ${Math.floor(diff / 2592000)} meses`
  return `hace ${Math.floor(diff / 31104000)} años`
}

/* ───────────────── RUT ───────────────── */

export function validateRUT(rut?: string | null): boolean {
  const clean = s(rut).replace(/[^0-9kK]/g, '')
  if (clean.length < 8 || clean.length > 9) return false

  const body = clean.slice(0, -1)
  const dv = clean.slice(-1).toUpperCase()

  let sum = 0
  let mul = 2
  for (let i = body.length - 1; i >= 0; i--) {
    sum += parseInt(body[i]!, 10) * mul
    mul = mul === 7 ? 2 : mul + 1
  }
  const res = 11 - (sum % 11)
  const calc = res === 11 ? '0' : res === 10 ? 'K' : String(res)
  return dv === calc
}

export function formatRUT(rut?: string | null): string {
  const clean = s(rut).replace(/[^0-9kK]/g, '')
  if (clean.length < 8) return clean
  const body = clean.slice(0, -1)
  const dv = clean.slice(-1)
  const formatted = body.replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  return `${formatted}-${dv}`
}

/* ───────────────── texto ───────────────── */

export function truncateText(text?: string | null, maxLength = 50): string {
  const t = s(text)
  return t.length <= maxLength ? t : t.slice(0, maxLength) + '...'
}

export function capitalizeWords(text?: string | null): string {
  const t = s(text)
  return t.replace(/\w\S*/g, (w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
}

export function generateSlug(text?: string | null): string {
  const t = s(text)
  return t
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
}

export function getInitials(name?: string | null): string {
  const n = s(name).trim()
  if (!n) return ''
  return n.split(/\s+/).map(w => w[0]!).join('').toUpperCase().slice(0, 2)
}

/* ───────────────── fechas varias ───────────────── */

export function isOverdue(date?: string | Date | null): boolean {
  const d = toDate(date ?? null)
  return !isNaN(d.getTime()) && d.getTime() < Date.now()
}

export function isDateInPast(date?: string | Date | null): boolean {
  const d = toDate(date ?? null)
  if (isNaN(d.getTime())) return false

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const cmp = new Date(d)
  cmp.setHours(0, 0, 0, 0)

  return cmp < today
}

export function daysUntil(date?: string | Date | null): number {
  const d = toDate(date ?? null)
  if (isNaN(d.getTime())) return 0
  const ms = d.getTime() - Date.now()
  return Math.ceil(ms / (1000 * 60 * 60 * 24))
}

/* ───────────────── archivos ───────────────── */

export function formatFileSize(bytes?: number | null): string {
  const b = typeof bytes === 'number' && !isNaN(bytes) ? bytes : 0
  if (b <= 0) return '0 Bytes'
  const k = 1024
  const units = ['Bytes', 'KB', 'MB', 'GB'] as const
  const i = Math.min(Math.floor(Math.log(b) / Math.log(k)), units.length - 1)
  const val = (b / Math.pow(k, i)).toFixed(2)
  return `${val} ${units[i]}`
}

/* ───────────────── otros ───────────────── */

export function debounce<T extends (...args: any[]) => void>(fn: T, wait: number) {
  let t: ReturnType<typeof setTimeout>
  return (...args: Parameters<T>): void => {
    clearTimeout(t)
    t = setTimeout(() => fn(...args), wait)
  }
}

export function stringToColor(str?: string | null): string {
  const txt = s(str)
  let hash = 0
  for (let i = 0; i < txt.length; i++) {
    hash = txt.charCodeAt(i) + ((hash << 5) - hash)
  }
  const hue = ((hash % 360) + 360) % 360
  return `hsl(${hue}, 70%, 50%)`
}
