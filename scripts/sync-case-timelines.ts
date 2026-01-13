import dotenv from 'dotenv'
import { createClient } from '@supabase/supabase-js'
import { getStageTemplatesByMateria } from '../src/lib/validators/stages'
import { findLegalFeeItemById } from '../src/lib/pricing/legalFees'

dotenv.config({ path: '.env.local' })
dotenv.config()

type CaseRow = {
  id: string
  estado: string | null
  sentencia_estado: string | null
  sentencia_fecha: string | null
  materia: string | null
  fecha_inicio: string | null
  modalidad_cobro: string | null
  honorario_total_uf: number | null
  honorario_moneda: string | null
  tarifa_referencia: string | null
}

type StageRow = {
  id: string
  case_id: string
  orden: number | null
  etapa: string | null
  descripcion: string | null
  estado: string | null
  fecha_programada: string | null
  fecha_cumplida: string | null
  es_publica: boolean | null
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || ''

if (!SUPABASE_URL || !SERVICE_ROLE) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } })

const args = process.argv.slice(2)
const APPLY = args.includes('--apply')
const caseArg = args.find((arg) => arg.startsWith('--case-id='))
const CASE_ID = caseArg ? caseArg.split('=')[1] : null

const BATCH = 200

const buildSchedule = (baseIso: string | null, templates: Array<{ diasEstimados: number }>) => {
  const schedule = new Map<number, string>()
  if (!baseIso) return schedule
  const baseDate = new Date(baseIso)
  if (Number.isNaN(baseDate.getTime())) return schedule

  let cumulativeDays = 0
  templates.forEach((template, index) => {
    cumulativeDays += template.diasEstimados
    const scheduledDate = new Date(baseDate.getTime())
    scheduledDate.setDate(scheduledDate.getDate() + cumulativeDays)
    schedule.set(index + 1, scheduledDate.toISOString().split('T')[0]!)
  })

  return schedule
}

const computeStageCosts = (caseRow: CaseRow, templates: Array<{ porcentajeHonorario?: number }>) => {
  const modalidad = caseRow.modalidad_cobro ?? 'prepago'
  const moneda = caseRow.honorario_moneda ?? 'UF'
  if (modalidad !== 'prepago' || moneda !== 'UF') return null

  const tarifa = caseRow.tarifa_referencia ? findLegalFeeItemById(caseRow.tarifa_referencia) : null
  const total =
    typeof caseRow.honorario_total_uf === 'number'
      ? Number(caseRow.honorario_total_uf)
      : tarifa?.montoUf ?? null
  if (total === null) return null

  const costs: Array<number | null> = []
  let allocated = 0
  templates.forEach((template, index) => {
    const porcentaje = template.porcentajeHonorario ?? 0
    if (porcentaje <= 0) {
      costs.push(null)
      return
    }
    if (index === templates.length - 1) {
      costs.push(Number((total - allocated).toFixed(2)))
      return
    }
    const value = Number((total * porcentaje).toFixed(2))
    allocated += value
    costs.push(value)
  })
  return costs
}

const shouldCloseTimeline = (caseRow: CaseRow) => {
  if (caseRow.sentencia_estado === 'dictada') return true
  const estado = caseRow.estado ?? ''
  return ['terminado', 'terminado_apelacion', 'terminado_desistido_demandante', 'archivado'].includes(estado)
}

const normalizeDateOnly = (value: string | null) => {
  if (!value) return null
  return value.includes('T') ? value.split('T')[0]! : value
}

async function run() {
  let offset = 0
  let totalCases = 0
  let totalInserted = 0
  let totalUpdated = 0
  let totalAudience = 0

  for (;;) {
    let casesQuery = supabase
      .from('cases')
      .select(
        'id, estado, sentencia_estado, sentencia_fecha, materia, fecha_inicio, modalidad_cobro, honorario_total_uf, honorario_moneda, tarifa_referencia',
      )
      .order('id', { ascending: true })
      .range(offset, offset + BATCH - 1)

    if (CASE_ID) {
      casesQuery = casesQuery.eq('id', CASE_ID).limit(1)
    }

    const { data: cases, error: casesError } = await casesQuery
    if (casesError) throw casesError
    if (!cases || cases.length === 0) break

    const ids = cases.map((row) => row.id)
    const { data: stages, error: stagesError } = await supabase
      .from('case_stages')
      .select('id, case_id, orden, etapa, descripcion, estado, fecha_programada, fecha_cumplida, es_publica')
      .in('case_id', ids)

    if (stagesError) throw stagesError

    const stageByCase = new Map<string, StageRow[]>()
    ;(stages ?? []).forEach((row) => {
      const list = stageByCase.get(row.case_id) ?? []
      list.push(row as StageRow)
      stageByCase.set(row.case_id, list)
    })

    for (const caseRow of cases as CaseRow[]) {
      totalCases += 1
      const templates = getStageTemplatesByMateria(caseRow.materia ?? 'Civil')
      const schedule = buildSchedule(caseRow.fecha_inicio ?? null, templates)
      const costs = computeStageCosts(caseRow, templates)
      const rows = stageByCase.get(caseRow.id) ?? []
      const stageByOrder = new Map<number, StageRow>()
      rows.forEach((row) => {
        const order = Number(row.orden ?? 0)
        if (order > 0) stageByOrder.set(order, row)
      })

      const inserts: any[] = []
      const updates: Array<{ id: string; payload: Record<string, any> }> = []
      const nowIso = new Date().toISOString()

      templates.forEach((template, index) => {
        const order = index + 1
        const existing = stageByOrder.get(order)
        const scheduleDate = schedule.get(order) ?? null
        if (!existing) {
          inserts.push({
            case_id: caseRow.id,
            etapa: template.etapa,
            descripcion: template.descripcion ?? null,
            estado: 'pendiente',
            orden: order,
            es_publica: template.esPublica ?? true,
            fecha_programada: scheduleDate,
            fecha_cumplida: null,
            responsable_id: null,
            requiere_pago: Boolean(costs),
            costo_uf: costs ? costs[index] ?? null : null,
            porcentaje_variable: template.porcentajeVariable ?? null,
            estado_pago: 'pendiente',
            notas_pago: template.notasPago ?? null,
            monto_variable_base: template.porcentajeVariable && template.notasPago ? template.notasPago : null,
            monto_pagado_uf: 0,
            created_at: nowIso,
            updated_at: nowIso,
          })
          return
        }

        const isCompleted = existing.estado === 'completado' || Boolean(existing.fecha_cumplida)
        if (isCompleted) return

        const payload: Record<string, any> = {}
        if (existing.etapa !== template.etapa) payload.etapa = template.etapa
        if ((existing.descripcion ?? '') !== (template.descripcion ?? '')) payload.descripcion = template.descripcion ?? null
        if ((existing.es_publica ?? true) !== (template.esPublica ?? true)) payload.es_publica = template.esPublica ?? true
        if (scheduleDate && existing.fecha_programada !== scheduleDate) payload.fecha_programada = scheduleDate
        if (Object.keys(payload).length > 0) {
          payload.updated_at = nowIso
          updates.push({ id: existing.id, payload })
        }
      })

      let mergedRows = [...rows]
      if (APPLY && inserts.length > 0) {
        const { data: insertedRows, error: insertError } = await supabase
          .from('case_stages')
          .insert(inserts)
          .select('id, case_id, orden, etapa')
        if (insertError) throw insertError
        totalInserted += inserts.length
        mergedRows = mergedRows.concat((insertedRows ?? []) as StageRow[])
      } else {
        totalInserted += inserts.length
      }

      if (APPLY && updates.length > 0) {
        for (const update of updates) {
          const { error } = await supabase.from('case_stages').update(update.payload).eq('id', update.id)
          if (error) throw error
        }
      }
      totalUpdated += updates.length

      if (shouldCloseTimeline(caseRow)) {
        const closeDate =
          normalizeDateOnly(caseRow.sentencia_fecha) ??
          new Date().toISOString().split('T')[0]!

        if (APPLY) {
          const { data: closedRows, error: closeError } = await supabase
            .from('case_stages')
            .update({
              estado: 'completado',
              fecha_cumplida: closeDate,
            })
            .eq('case_id', caseRow.id)
            .neq('estado', 'completado')
            .select('id')
          if (closeError) throw closeError
          totalUpdated += (closedRows ?? []).length
        }
      }

    }

    if (CASE_ID) break
    offset += BATCH
  }

  const mode = APPLY ? 'APPLY' : 'DRY-RUN'
  console.log(`[${mode}] cases=${totalCases} inserts=${totalInserted} updates=${totalUpdated} audiencia=${totalAudience}`)
}

run().catch((error) => {
  console.error('sync-case-timelines failed:', error)
  process.exit(1)
})
