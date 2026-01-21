export type CaseMilestone = {
  key: string;
  label: string;
  date: string; // YYYY-MM-DD
  detail?: string | null;
};

function normalizeDateOnly(value: unknown): string | null {
  const raw = String(value ?? '').trim();
  if (!raw) return null;
  const dateOnly = raw.includes('T') ? raw.split('T')[0] : raw;
  if (!dateOnly) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateOnly)) return null;
  return dateOnly;
}

function normalizeText(value: unknown): string | null {
  const raw = String(value ?? '').trim();
  return raw.length ? raw : null;
}

export function deriveCaseMilestones(caseRow: Record<string, any>): CaseMilestone[] {
  const milestones: CaseMilestone[] = [];

  const fechaInicio = normalizeDateOnly(caseRow.fecha_inicio);
  if (fechaInicio) {
    milestones.push({ key: 'fecha_inicio', label: 'Inicio', date: fechaInicio });
  }

  const notifFecha = normalizeDateOnly(caseRow.notificacion_demanda_fecha);
  if (notifFecha) {
    const estado = normalizeText(caseRow.notificacion_demanda_estado);
    milestones.push({
      key: 'notificacion_demanda_fecha',
      label: 'Notificación demanda',
      date: notifFecha,
      detail: estado ? estado.replace(/_/g, ' ') : null,
    });
  }

  const stagesRaw = Array.isArray(caseRow.case_stages) ? caseRow.case_stages : [];
  if (stagesRaw.length > 0) {
    const normalize = (value: string) =>
      value
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');

    const audienceStages = stagesRaw.filter((stage: any) => {
      if (stage?.audiencia_tipo) return true;
      const name = normalize(String(stage?.etapa ?? ''));
      // Si no hay audiencia_tipo, solo consideramos audiencias ya cumplidas (fecha_cumplida),
      // para evitar mostrar "fechas estimadas" de preparación interna.
      return name.includes('audiencia') && Boolean(stage?.fecha_cumplida);
    });

    for (const stage of audienceStages) {
      const date = normalizeDateOnly(stage.fecha_cumplida ?? stage.fecha_programada);
      if (!date) continue;

      const tipoRaw = normalizeText(stage.audiencia_tipo) ?? '';
      const label =
        tipoRaw === 'preparatoria'
          ? 'Audiencia preparatoria'
          : tipoRaw === 'juicio'
            ? 'Audiencia de juicio'
            : 'Audiencia';

      milestones.push({
        key: `audiencia_${tipoRaw || 'general'}_${String(stage.id ?? stage.orden ?? stage.etapa ?? date)}`,
        label,
        date,
        detail: normalizeText(stage.etapa),
      });
    }
  }

  const sentenciaFecha = normalizeDateOnly(caseRow.sentencia_fecha);
  if (sentenciaFecha) {
    const estado = normalizeText(caseRow.sentencia_estado);
    milestones.push({
      key: 'sentencia_fecha',
      label: 'Sentencia',
      date: sentenciaFecha,
      detail: estado ? estado.replace(/_/g, ' ') : null,
    });
  }

  const fechaDesistimiento = normalizeDateOnly(caseRow.fecha_desistimiento);
  if (fechaDesistimiento) {
    milestones.push({ key: 'fecha_desistimiento', label: 'Desistimiento', date: fechaDesistimiento });
  }

  const nextActionAt = normalizeDateOnly(caseRow.next_action_at);
  if (nextActionAt) {
    milestones.push({
      key: 'next_action_at',
      label: 'Próxima acción',
      date: nextActionAt,
      detail: normalizeText(caseRow.next_action_title),
    });
  }

  milestones.sort((a, b) => a.date.localeCompare(b.date));
  return milestones;
}
