export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      audit_log: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          diff_json: Json | null
          entity_id: string | null
          entity_type: string
          id: string
          ip_address: unknown | null
          user_agent: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          diff_json?: Json | null
          entity_id?: string | null
          entity_type: string
          id?: string
          ip_address?: unknown | null
          user_agent?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          diff_json?: Json | null
          entity_id?: string | null
          entity_type?: string
          id?: string
          ip_address?: unknown | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_log_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          }
        ]
      }
      case_clients: {
        Row: {
          case_id: string
          client_profile_id: string
          created_at: string
          id: string
        }
        Insert: {
          case_id: string
          client_profile_id: string
          created_at?: string
          id?: string
        }
        Update: {
          case_id?: string
          client_profile_id?: string
          created_at?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "case_clients_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "case_clients_client_profile_id_fkey"
            columns: ["client_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          }
        ]
      }
      case_collaborators: {
        Row: {
          abogado_id: string
          case_id: string
          created_at: string
          id: string
        }
        Insert: {
          abogado_id: string
          case_id: string
          created_at?: string
          id?: string
        }
        Update: {
          abogado_id?: string
          case_id?: string
          created_at?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "case_collaborators_abogado_id_fkey"
            columns: ["abogado_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "case_collaborators_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          }
        ]
      }
      case_stages: {
        Row: {
          case_id: string
          created_at: string
          descripcion: string | null
          es_publica: boolean | null
          estado: Database["public"]["Enums"]["stage_status"] | null
          etapa: string
          fecha_cumplida: string | null
          fecha_programada: string | null
          id: string
          orden: number | null
          responsable_id: string | null
          updated_at: string
        }
        Insert: {
          case_id: string
          created_at?: string
          descripcion?: string | null
          es_publica?: boolean | null
          estado?: Database["public"]["Enums"]["stage_status"] | null
          etapa: string
          fecha_cumplida?: string | null
          fecha_programada?: string | null
          id?: string
          orden?: number | null
          responsable_id?: string | null
          updated_at?: string
        }
        Update: {
          case_id?: string
          created_at?: string
          descripcion?: string | null
          es_publica?: boolean | null
          estado?: Database["public"]["Enums"]["stage_status"] | null
          etapa?: string
          fecha_cumplida?: string | null
          fecha_programada?: string | null
          id?: string
          orden?: number | null
          responsable_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "case_stages_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "case_stages_responsable_id_fkey"
            columns: ["responsable_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          }
        ]
      }
      cases: {
        Row: {
          abogado_responsable: string | null
          caratulado: string
          comuna: string | null
          contraparte: string | null
          created_at: string
          estado: Database["public"]["Enums"]["case_status"] | null
          etapa_actual: string | null
          fecha_inicio: string | null
          id: string
          materia: string | null
          nombre_cliente: string
          numero_causa: string | null
          observaciones: string | null
          prioridad: Database["public"]["Enums"]["case_priority"] | null
          region: string | null
          rut_cliente: string | null
          tribunal: string | null
          updated_at: string
          valor_estimado: number | null
        }
        Insert: {
          abogado_responsable?: string | null
          caratulado: string
          comuna?: string | null
          contraparte?: string | null
          created_at?: string
          estado?: Database["public"]["Enums"]["case_status"] | null
          etapa_actual?: string | null
          fecha_inicio?: string | null
          id?: string
          materia?: string | null
          nombre_cliente: string
          numero_causa?: string | null
          observaciones?: string | null
          prioridad?: Database["public"]["Enums"]["case_priority"] | null
          region?: string | null
          rut_cliente?: string | null
          tribunal?: string | null
          updated_at?: string
          valor_estimado?: number | null
        }
        Update: {
          abogado_responsable?: string | null
          caratulado?: string
          comuna?: string | null
          contraparte?: string | null
          created_at?: string
          estado?: Database["public"]["Enums"]["case_status"] | null
          etapa_actual?: string | null
          fecha_inicio?: string | null
          id?: string
          materia?: string | null
          nombre_cliente?: string
          numero_causa?: string | null
          observaciones?: string | null
          prioridad?: Database["public"]["Enums"]["case_priority"] | null
          region?: string | null
          rut_cliente?: string | null
          tribunal?: string | null
          updated_at?: string
          valor_estimado?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "cases_abogado_responsable_fkey"
            columns: ["abogado_responsable"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          }
        ]
      }
      documents: {
        Row: {
          case_id: string
          created_at: string
          id: string
          nombre: string
          size_bytes: number | null
          tipo_mime: string | null
          updated_at: string
          uploader_id: string
          url: string
          visibilidad: Database["public"]["Enums"]["document_visibility"] | null
        }
        Insert: {
          case_id: string
          created_at?: string
          id?: string
          nombre: string
          size_bytes?: number | null
          tipo_mime?: string | null
          updated_at?: string
          uploader_id: string
          url: string
          visibilidad?: Database["public"]["Enums"]["document_visibility"] | null
        }
        Update: {
          case_id?: string
          created_at?: string
          id?: string
          nombre?: string
          size_bytes?: number | null
          tipo_mime?: string | null
          updated_at?: string
          uploader_id?: string
          url?: string
          visibilidad?: Database["public"]["Enums"]["document_visibility"] | null
        }
        Relationships: [
          {
            foreignKeyName: "documents_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_uploader_id_fkey"
            columns: ["uploader_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          }
        ]
      }
      info_requests: {
        Row: {
          case_id: string
          created_at: string
          creador_id: string
          descripcion: string
          documento_respuesta_id: string | null
          estado: Database["public"]["Enums"]["request_status"] | null
          fecha_limite: string | null
          id: string
          respuesta: string | null
          tipo: Database["public"]["Enums"]["request_type"] | null
          updated_at: string
        }
        Insert: {
          case_id: string
          created_at?: string
          creador_id: string
          descripcion: string
          documento_respuesta_id?: string | null
          estado?: Database["public"]["Enums"]["request_status"] | null
          fecha_limite?: string | null
          id?: string
          respuesta?: string | null
          tipo?: Database["public"]["Enums"]["request_type"] | null
          updated_at?: string
        }
        Update: {
          case_id?: string
          created_at?: string
          creador_id?: string
          descripcion?: string
          documento_respuesta_id?: string | null
          estado?: Database["public"]["Enums"]["request_status"] | null
          fecha_limite?: string | null
          id?: string
          respuesta?: string | null
          tipo?: Database["public"]["Enums"]["request_type"] | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "info_requests_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "info_requests_creador_id_fkey"
            columns: ["creador_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "info_requests_documento_respuesta_id_fkey"
            columns: ["documento_respuesta_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          }
        ]
      }
      notes: {
        Row: {
          author_id: string
          case_id: string
          contenido: string
          created_at: string
          id: string
          tipo: Database["public"]["Enums"]["note_type"]
          updated_at: string
        }
        Insert: {
          author_id: string
          case_id: string
          contenido: string
          created_at?: string
          id?: string
          tipo?: Database["public"]["Enums"]["note_type"]
          updated_at?: string
        }
        Update: {
          author_id?: string
          case_id?: string
          contenido?: string
          created_at?: string
          id?: string
          tipo?: Database["public"]["Enums"]["note_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "notes_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notes_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          }
        ]
      }
      portal_tokens: {
        Row: {
          case_id: string
          client_profile_id: string
          created_at: string
          expires_at: string
          id: string
          token: string
          used_at: string | null
        }
        Insert: {
          case_id: string
          client_profile_id: string
          created_at?: string
          expires_at: string
          id?: string
          token: string
          used_at?: string | null
        }
        Update: {
          case_id?: string
          client_profile_id?: string
          created_at?: string
          expires_at?: string
          id?: string
          token?: string
          used_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "portal_tokens_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "portal_tokens_client_profile_id_fkey"
            columns: ["client_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          }
        ]
      }
      profiles: {
        Row: {
          activo: boolean | null
          created_at: string
          id: string
          nombre: string
          role: Database["public"]["Enums"]["user_role"]
          rut: string | null
          telefono: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          activo?: boolean | null
          created_at?: string
          id?: string
          nombre: string
          role?: Database["public"]["Enums"]["user_role"]
          rut?: string | null
          telefono?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          activo?: boolean | null
          created_at?: string
          id?: string
          nombre?: string
          role?: Database["public"]["Enums"]["user_role"]
          rut?: string | null
          telefono?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_current_profile: {
        Args: Record<PropertyKey, never>
        Returns: {
          activo: boolean | null
          created_at: string
          id: string
          nombre: string
          role: Database["public"]["Enums"]["user_role"]
          rut: string | null
          telefono: string | null
          updated_at: string
          user_id: string
        }
      }
      has_case_access: {
        Args: {
          case_uuid: string
        }
        Returns: boolean
      }
      is_abogado: {
        Args: Record<PropertyKey, never>
        Returns: boolean
      }
      is_admin: {
        Args: Record<PropertyKey, never>
        Returns: boolean
      }
      is_cliente: {
        Args: Record<PropertyKey, never>
        Returns: boolean
      }
    }
    Enums: {
      case_priority: "baja" | "media" | "alta" | "urgente"
      case_status: "activo" | "suspendido" | "archivado" | "terminado"
      document_visibility: "privado" | "cliente"
      note_type: "privada" | "publica"
      request_status: "pendiente" | "recibido" | "vencido"
      request_type: "documento" | "dato" | "pago" | "otro"
      stage_status: "pendiente" | "en_proceso" | "completado"
      user_role: "admin_firma" | "abogado" | "cliente"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

// Convenience types
export type UserRole = Database['public']['Enums']['user_role'];
export type CaseStatus = Database['public']['Enums']['case_status'];
export type CasePriority = Database['public']['Enums']['case_priority'];
export type StageStatus = Database['public']['Enums']['stage_status'];
export type NoteType = Database['public']['Enums']['note_type'];
export type DocumentVisibility = Database['public']['Enums']['document_visibility'];
export type RequestType = Database['public']['Enums']['request_type'];
export type RequestStatus = Database['public']['Enums']['request_status'];

export type Profile = Database['public']['Tables']['profiles']['Row'];
export type Case = Database['public']['Tables']['cases']['Row'];
export type CaseStage = Database['public']['Tables']['case_stages']['Row'];
export type Note = Database['public']['Tables']['notes']['Row'];
export type Document = Database['public']['Tables']['documents']['Row'];
export type InfoRequest = Database['public']['Tables']['info_requests']['Row'];
export type AuditLog = Database['public']['Tables']['audit_log']['Row'];
export type PortalToken = Database['public']['Tables']['portal_tokens']['Row'];

// Insert types
export type ProfileInsert = Database['public']['Tables']['profiles']['Insert'];
export type CaseInsert = Database['public']['Tables']['cases']['Insert'];
export type CaseStageInsert = Database['public']['Tables']['case_stages']['Insert'];
export type NoteInsert = Database['public']['Tables']['notes']['Insert'];
export type DocumentInsert = Database['public']['Tables']['documents']['Insert'];
export type InfoRequestInsert = Database['public']['Tables']['info_requests']['Insert'];
export type AuditLogInsert = Database['public']['Tables']['audit_log']['Insert'];

// Update types
export type ProfileUpdate = Database['public']['Tables']['profiles']['Update'];
export type CaseUpdate = Database['public']['Tables']['cases']['Update'];
export type CaseStageUpdate = Database['public']['Tables']['case_stages']['Update'];
export type NoteUpdate = Database['public']['Tables']['notes']['Update'];
export type DocumentUpdate = Database['public']['Tables']['documents']['Update'];
export type InfoRequestUpdate = Database['public']['Tables']['info_requests']['Update'];
