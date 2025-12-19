export function formatRoleLabel(role: string): string {
  const key = String(role ?? '').trim().toLowerCase();
  if (key === 'admin_firma') return 'Admin';
  if (key === 'abogado') return 'Abogado';
  if (key === 'analista') return 'Analista';
  if (key === 'cliente') return 'Usuario';
  return key.replace(/[_-]+/g, ' ').trim() || 'Usuario';
}

