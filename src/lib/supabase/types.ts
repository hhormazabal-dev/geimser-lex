// Wrapper de tipos para reexportar helpers legibles
import type { Database as GeneratedDatabase } from './database.types';

export type { Database } from './database.types';

type PublicTables = GeneratedDatabase['public']['Tables'];
type PublicEnums = GeneratedDatabase['public']['Enums'];

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Tables<T extends keyof PublicTables> = PublicTables[T]['Row'];
export type TablesInsert<T extends keyof PublicTables> = PublicTables[T]['Insert'];
export type TablesUpdate<T extends keyof PublicTables> = PublicTables[T]['Update'];

export type UserRole = PublicEnums['user_role'];
export type CaseStatus = PublicEnums['case_status'];
export type CasePriority = PublicEnums['case_priority'];
export type CaseWorkflowState = PublicEnums['case_workflow_state'];
export type StageStatus = PublicEnums['stage_status'];
export type StagePaymentStatus = PublicEnums['stage_payment_status'];
export type NoteType = PublicEnums['note_type'];
export type DocumentVisibility = PublicEnums['document_visibility'];
export type RequestType = PublicEnums['request_type'];
export type RequestStatus = PublicEnums['request_status'];

export type Profile = Tables<'profiles'>;
export type Case = Tables<'cases'>;
export type CaseStage = Tables<'case_stages'>;
export type CaseMessage = Tables<'case_messages'>;
export type Note = Tables<'notes'>;
export type Document = Tables<'documents'>;
export type InfoRequest = Tables<'info_requests'>;
export type LegalTemplate = Tables<'legal_templates'>;
export type QuickLink = Tables<'quick_links'>;
export type AuditLog = Tables<'audit_log'>;
export type PortalToken = Tables<'portal_tokens'>;
export type UserSession = Tables<'user_sessions'>;
export type LoginAttempt = Tables<'login_attempts'>;
export type CaseCounterparty = Tables<'case_counterparties'>;

export type ProfileInsert = TablesInsert<'profiles'>;
export type CaseInsert = TablesInsert<'cases'>;
export type CaseStageInsert = TablesInsert<'case_stages'>;
export type CaseMessageInsert = TablesInsert<'case_messages'>;
export type NoteInsert = TablesInsert<'notes'>;
export type DocumentInsert = TablesInsert<'documents'>;
export type InfoRequestInsert = TablesInsert<'info_requests'>;
export type LegalTemplateInsert = TablesInsert<'legal_templates'>;
export type QuickLinkInsert = TablesInsert<'quick_links'>;
export type AuditLogInsert = TablesInsert<'audit_log'>;
export type PortalTokenInsert = TablesInsert<'portal_tokens'>;
export type UserSessionInsert = TablesInsert<'user_sessions'>;
export type LoginAttemptInsert = TablesInsert<'login_attempts'>;
export type CaseCounterpartyInsert = TablesInsert<'case_counterparties'>;

export type ProfileUpdate = TablesUpdate<'profiles'>;
export type CaseUpdate = TablesUpdate<'cases'>;
export type CaseStageUpdate = TablesUpdate<'case_stages'>;
export type CaseMessageUpdate = TablesUpdate<'case_messages'>;
export type NoteUpdate = TablesUpdate<'notes'>;
export type DocumentUpdate = TablesUpdate<'documents'>;
export type InfoRequestUpdate = TablesUpdate<'info_requests'>;
export type LegalTemplateUpdate = TablesUpdate<'legal_templates'>;
export type QuickLinkUpdate = TablesUpdate<'quick_links'>;
export type AuditLogUpdate = TablesUpdate<'audit_log'>;
export type PortalTokenUpdate = TablesUpdate<'portal_tokens'>;
export type UserSessionUpdate = TablesUpdate<'user_sessions'>;
export type LoginAttemptUpdate = TablesUpdate<'login_attempts'>;
export type CaseCounterpartyUpdate = TablesUpdate<'case_counterparties'>;

export type SecurityAlert = {
  severity: 'low' | 'info' | 'warning' | 'high' | 'critical';
  description: string;
  user_email?: string | null;
  ip_address?: string | null;
  event_count: number;
  first_seen: string;
  last_seen: string;
};
