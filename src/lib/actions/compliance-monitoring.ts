'use server';

import { createServerClient } from '@/lib/supabase/server';
import { canAccessCase, requireAuth } from '@/lib/auth/roles';

export type ComplianceSubjectKind = 'client' | 'counterparty' | 'other';

export type ComplianceSubjectDTO = {
  id: string;
  rut: string;
  display_name: string;
  kind: ComplianceSubjectKind;
  role: string | null;
  latest_snapshot: ComplianceSnapshotDTO | null;
  latest_snapshots: Record<string, ComplianceSnapshotDTO>;
};

export type ComplianceSnapshotDTO = {
  id: string;
  fetched_at: string;
  source: string;
  summary: Record<string, any>;
  payload: Record<string, any>;
  error: string | null;
};

export async function listComplianceSubjectsForCase(caseId: string): Promise<{
  success: boolean;
  subjects?: ComplianceSubjectDTO[];
  error?: string;
}> {
  try {
    await requireAuth();
    if (!(await canAccessCase(caseId))) return { success: false, error: 'Sin permisos' };

    const supabase = (await createServerClient()) as any;

    const { data: links, error: linksErr } = await supabase
      .from('compliance_subject_case_links')
      .select(
        `
        subject:compliance_subjects (
          id,
          rut,
          display_name,
          kind
        ),
        role
      `,
      )
      .eq('case_id', caseId);

    if (linksErr) throw linksErr;

    const subjectsRaw = (links ?? [])
      .map((l: any) => ({
        ...(l.subject ?? null),
        role: l.role ?? null,
      }))
      .filter(Boolean) as Array<{
      id: string;
      rut: string;
      display_name: string;
      kind: ComplianceSubjectKind;
      role: string | null;
    }>;

    if (subjectsRaw.length === 0) {
      return { success: true, subjects: [] };
    }

    const subjectIds = subjectsRaw.map((s) => s.id);
    const { data: snaps, error: snapsErr } = await supabase
      .from('compliance_subject_snapshots')
      .select('id, subject_id, fetched_at, source, summary, payload, error')
      .eq('case_id', caseId)
      .in('subject_id', subjectIds)
      .order('fetched_at', { ascending: false })
      .limit(250);

    if (snapsErr) throw snapsErr;

    const latestBySubjectSource = new Map<string, ComplianceSnapshotDTO>();
    const latestAnyBySubject = new Map<string, ComplianceSnapshotDTO>();
    for (const row of (snaps ?? []) as any[]) {
      const subjectId = String(row.subject_id);
      const source = String(row.source ?? 'unknown');
      const key = `${subjectId}::${source}`;
      if (!latestBySubjectSource.has(key)) {
        latestBySubjectSource.set(key, {
          id: row.id,
          fetched_at: row.fetched_at,
          source,
          summary: row.summary ?? {},
          payload: row.payload ?? {},
          error: row.error ?? null,
        });
      }
      if (!latestAnyBySubject.has(subjectId)) {
        latestAnyBySubject.set(subjectId, latestBySubjectSource.get(key)!);
      }
    }

    const subjects: ComplianceSubjectDTO[] = subjectsRaw.map((s) => ({
      id: s.id,
      rut: s.rut,
      display_name: s.display_name,
      kind: s.kind,
      role: s.role,
      latest_snapshots: (() => {
        const out: Record<string, ComplianceSnapshotDTO> = {};
        for (const [key, snap] of latestBySubjectSource.entries()) {
          if (!key.startsWith(`${s.id}::`)) continue;
          out[snap.source] = snap;
        }
        return out;
      })(),
      latest_snapshot:
        latestBySubjectSource.get(`${s.id}::pjud_ojv`) ??
        latestAnyBySubject.get(s.id) ??
        null,
    }));

    subjects.sort((a, b) => a.display_name.localeCompare(b.display_name, 'es'));
    return { success: true, subjects };
  } catch (e: any) {
    console.error('[listComplianceSubjectsForCase] error', e);
    return { success: false, error: e?.message ?? 'Error interno' };
  }
}
