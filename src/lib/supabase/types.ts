// src/lib/supabase/types.ts
// Importa para USAR los tipos localmente…
import type { Database as DB } from './database.types';
// (Json puede no existir en tu archivo generado; por eso lo tratamos con fallback)
import type { Json as DBJson } from './database.types';

// …y re-exporta para que otros módulos puedan importarlos desde aquí.
export type { Database } from './database.types';
/** Exporta Json si existe en database.types; si no, usa el fallback de abajo */
export type Json = DBJson extends never ? JsonFallback : DBJson;

// ===== Helpers de tablas genéricos (usar `DB` en vez de `Database` aquí)
export type Tables<T extends keyof DB["public"]["Tables"]> =
  DB["public"]["Tables"][T]["Row"];

export type TablesInsert<T extends keyof DB["public"]["Tables"]> =
  DB["public"]["Tables"][T]["Insert"];

export type TablesUpdate<T extends keyof DB["public"]["Tables"]> =
  DB["public"]["Tables"][T]["Update"];

// ===== Enums convenientes
export type UserRole          = DB["public"]["Enums"]["user_role"];
export type CaseStatus        = DB["public"]["Enums"]["case_status"];
export type CasePriority      = DB["public"]["Enums"]["case_priority"];
export type CaseWorkflowState = DB["public"]["Enums"]["case_workflow_state"];
export type StageStatus       = DB["public"]["Enums"]["stage_status"];
export type StagePaymentStatus= DB["public"]["Enums"]["stage_payment_status"];
export type NoteType          = DB["public"]["Enums"]["note_type"];
export type DocumentVisibility= DB["public"]["Enums"]["document_visibility"];
export type RequestType       = DB["public"]["Enums"]["request_type"];
export type RequestStatus     = DB["public"]["Enums"]["request_status"];

// ===== Aliases de tablas
export type Profile       = Tables<"profiles">;
export type Case          = Tables<"cases">;
export type CaseStage     = Tables<"case_stages">;
export type CaseMessage   = Tables<"case_messages">;
export type Note          = Tables<"notes">;
export type Document      = Tables<"documents">;
export type InfoRequest   = Tables<"info_requests">;
export type LegalTemplate = Tables<"legal_templates">;
export type QuickLink     = Tables<"quick_links">;
export type AuditLog      = Tables<"audit_log">;
export type PortalToken   = Tables<"portal_tokens">;
export type UserSession   = Tables<"user_sessions">;
export type LoginAttempt  = Tables<"login_attempts">;

// ===== Inserts
export type ProfileInsert       = TablesInsert<"profiles">;
export type CaseInsert          = TablesInsert<"cases">;
export type CaseStageInsert     = TablesInsert<"case_stages">;
export type CaseMessageInsert   = TablesInsert<"case_messages">;
export type NoteInsert          = TablesInsert<"notes">;
export type DocumentInsert      = TablesInsert<"documents">;
export type InfoRequestInsert   = TablesInsert<"info_requests">;
export type LegalTemplateInsert = TablesInsert<"legal_templates">;
export type QuickLinkInsert     = TablesInsert<"quick_links">;
export type AuditLogInsert      = TablesInsert<"audit_log">;
export type PortalTokenInsert   = TablesInsert<"portal_tokens">;
export type UserSessionInsert   = TablesInsert<"user_sessions">;
export type LoginAttemptInsert  = TablesInsert<"login_attempts">;

// ===== Updates
export type ProfileUpdate       = TablesUpdate<"profiles">;
export type CaseUpdate          = TablesUpdate<"cases">;
export type CaseStageUpdate     = TablesUpdate<"case_stages">;
export type CaseMessageUpdate   = TablesUpdate<"case_messages">;
export type NoteUpdate          = TablesUpdate<"notes">;
export type DocumentUpdate      = TablesUpdate<"documents">;
export type InfoRequestUpdate   = TablesUpdate<"info_requests">;
export type LegalTemplateUpdate = TablesUpdate<"legal_templates">;
export type QuickLinkUpdate     = TablesUpdate<"quick_links">;
export type AuditLogUpdate      = TablesUpdate<"audit_log">;
export type PortalTokenUpdate   = TablesUpdate<"portal_tokens">;
export type UserSessionUpdate   = TablesUpdate<"user_sessions">;
export type LoginAttemptUpdate  = TablesUpdate<"login_attempts">;

// ===== Tipos derivados
export type SecurityAlert = {
  severity: "low" | "info" | "warning" | "high" | "critical";
  description: string;
  user_email?: string | null;
  ip_address?: string | null;
  event_count: number;
  first_seen: string;
  last_seen: string;
};

// ===== Fallback para Json si tu archivo generado no lo exporta
type JsonFallback =
  | string
  | number
  | boolean
  | null
  | { [key: string]: JsonFallback | undefined }
  | JsonFallback[];
