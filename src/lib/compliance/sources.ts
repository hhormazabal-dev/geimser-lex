export type ComplianceSource = {
  id: string;
  name: string;
  description: string;
  inputs: Array<'rut' | 'case_id' | 'court_region' | 'comuna_code'>;
  endpoints: string[];
  notes?: string;
};

export const COMPLIANCE_SOURCES: ComplianceSource[] = [
  {
    id: 'pjud_ojv_causes_per_legal_person',
    name: 'PJUD OJV · Causas por RUT',
    description: 'Listado de causas asociadas a un RUT vía Oficina Judicial Virtual.',
    inputs: ['rut'],
    endpoints: ['/api/compliance/refresh-case', '/v1/cl/services/pjud.cl/causes-per-legal-person'],
    notes: 'Puede fallar por bloqueo de red/región; ideal usar región LATAM o Companion.',
  },
  {
    id: 'datosgob_ckan_search',
    name: 'datos.gob.cl · Catálogo',
    description: 'Búsqueda de datasets públicos en el portal de datos abiertos (CKAN).',
    inputs: [],
    endpoints: ['/api/compliance/datosgob/search'],
    notes: 'Útil para descubrir fuentes; no es “real-time” por RUT salvo que un dataset tenga API propia.',
  },
  {
    id: 'chilecompra_supplier',
    name: 'ChileCompra · Proveedor',
    description: 'Detecta si el RUT corresponde a un proveedor de Mercado Público y su código interno.',
    inputs: ['rut'],
    endpoints: ['https://api.mercadopublico.cl/servicios/v1/Publico/Empresas/BuscarProveedor'],
    notes: 'Requiere `CHILECOMPRA_TICKET` (key/ticket de ChileCompra).',
  },
  {
    id: 'pjud_daily_statements',
    name: 'PJUD · Estado Diario',
    description: 'Estado diario y movimientos por causa (usa scraping + cache).',
    inputs: ['case_id', 'court_region', 'comuna_code'],
    endpoints: ['/api/causas/:id/estado-diario', '/api/causas/:id/estado-diario/historial', '/api/pjud/daily-statements/detect-tipo-juzgado'],
  },
  {
    id: 'pjud_courts_catalog',
    name: 'PJUD · Catálogo tribunales',
    description: 'Comunas y tribunales por región (para configurar Estado Diario).',
    inputs: ['court_region', 'comuna_code'],
    endpoints: ['/api/pjud/cities', '/api/pjud/courts'],
  },
  {
    id: 'mindicador_indicators',
    name: 'Indicadores (UF/UTM/USD)',
    description: 'UF/UTM/USD para cálculos (billing/contratos/reporting).',
    inputs: [],
    endpoints: ['/api/indicators'],
  },
];
