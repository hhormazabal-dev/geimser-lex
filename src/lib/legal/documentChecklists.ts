export type ChecklistMateria = 'Laboral' | 'Civil' | 'Penal';

export type DocumentChecklistItem = {
  key: string;
  label: string;
  hint?: string;
};

export const DOCUMENT_CHECKLISTS: Record<ChecklistMateria, DocumentChecklistItem[]> = {
  Laboral: [
    { key: 'contrato_trabajo', label: 'Contrato de trabajo' },
    { key: 'anexos', label: 'Anexos de contrato (si aplica)' },
    { key: 'liquidaciones', label: 'Liquidaciones de sueldo (últimos 6–12 meses)' },
    { key: 'finiquito', label: 'Finiquito y comprobantes asociados (si existe)' },
    { key: 'carta_despido', label: 'Carta de despido / término' },
    { key: 'comunicaciones', label: 'Correos/WhatsApp relevantes (instrucciones, sanciones, etc.)' },
    { key: 'certificado_cotizaciones', label: 'Certificado de cotizaciones previsionales' },
    { key: 'reglamento_interno', label: 'Reglamento interno / políticas aplicables' },
    { key: 'asistencia_turnos', label: 'Registro de asistencia / turnos / horas extra' },
    { key: 'calculo_prestaciones', label: 'Cálculo de prestaciones adeudadas' },
  ],
  Civil: [
    { key: 'contrato', label: 'Contrato principal (y anexos)' },
    { key: 'facturas', label: 'Facturas/boletas/órdenes de compra (si aplica)' },
    { key: 'comprobantes_pago', label: 'Comprobantes de pago / transferencias' },
    { key: 'correspondencia', label: 'Correspondencia (emails/cartas) relevante' },
    { key: 'garantias', label: 'Garantías/boletas de garantía' },
    { key: 'actas', label: 'Actas / minutas / acuerdos' },
    { key: 'poder', label: 'Poder / representación' },
    { key: 'avaluos', label: 'Avalúos / tasaciones (si aplica)' },
    { key: 'informes', label: 'Informes periciales o técnicos (si aplica)' },
    { key: 'pruebas', label: 'Medios de prueba adicionales' },
  ],
  Penal: [
    { key: 'denuncia', label: 'Denuncia/querella y antecedentes' },
    { key: 'carpeta_investigativa', label: 'Carpeta investigativa (si se tiene acceso)' },
    { key: 'citaciones', label: 'Citaciones / notificaciones / resoluciones' },
    { key: 'declaraciones', label: 'Declaraciones (cliente/testigos) y registros' },
    { key: 'pruebas', label: 'Evidencia (documental, digital, audios, videos)' },
    { key: 'informes', label: 'Informes periciales / policiales' },
    { key: 'medidas_cautelares', label: 'Medidas cautelares y resoluciones asociadas' },
    { key: 'certificados', label: 'Certificados relevantes (antecedentes, etc.)' },
    { key: 'poder', label: 'Poder / patrocinio y poder' },
  ],
};

