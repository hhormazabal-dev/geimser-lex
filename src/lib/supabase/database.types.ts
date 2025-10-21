export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      audit_log: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string | null
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
          created_at?: string | null
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
          created_at?: string | null
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
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          category: string | null
          changed_fields: string[] | null
          created_at: string | null
          description: string | null
          id: string
          ip_address: unknown | null
          metadata: Json | null
          new_values: Json | null
          old_values: Json | null
          record_id: string
          request_id: string | null
          session_id: string | null
          severity: string | null
          table_name: string
          user_agent: string | null
          user_email: string | null
          user_id: string | null
          user_role: string | null
        }
        Insert: {
          action: string
          category?: string | null
          changed_fields?: string[] | null
          created_at?: string | null
          description?: string | null
          id?: string
          ip_address?: unknown | null
          metadata?: Json | null
          new_values?: Json | null
          old_values?: Json | null
          record_id: string
          request_id?: string | null
          session_id?: string | null
          severity?: string | null
          table_name: string
          user_agent?: string | null
          user_email?: string | null
          user_id?: string | null
          user_role?: string | null
        }
        Update: {
          action?: string
          category?: string | null
          changed_fields?: string[] | null
          created_at?: string | null
          description?: string | null
          id?: string
          ip_address?: unknown | null
          metadata?: Json | null
          new_values?: Json | null
          old_values?: Json | null
          record_id?: string
          request_id?: string | null
          session_id?: string | null
          severity?: string | null
          table_name?: string
          user_agent?: string | null
          user_email?: string | null
          user_id?: string | null
          user_role?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      case_clients: {
        Row: {
          case_id: string
          client_profile_id: string
          created_at: string | null
          id: string
        }
        Insert: {
          case_id: string
          client_profile_id: string
          created_at?: string | null
          id?: string
        }
        Update: {
          case_id?: string
          client_profile_id?: string
          created_at?: string | null
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
          },
        ]
      }
      case_collaborators: {
        Row: {
          abogado_id: string
          case_id: string
          created_at: string | null
          id: string
        }
        Insert: {
          abogado_id: string
          case_id: string
          created_at?: string | null
          id?: string
        }
        Update: {
          abogado_id?: string
          case_id?: string
          created_at?: string | null
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
          },
        ]
      }
      case_messages: {
        Row: {
          attachment_url: string | null
          audience: string | null
          case_id: string
          contenido: string
          created_at: string | null
          id: string
          sender_profile_id: string
        }
        Insert: {
          attachment_url?: string | null
          audience?: string | null
          case_id: string
          contenido: string
          created_at?: string | null
          id?: string
          sender_profile_id: string
        }
        Update: {
          attachment_url?: string | null
          audience?: string | null
          case_id?: string
          contenido?: string
          created_at?: string | null
          id?: string
          sender_profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "case_messages_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "case_messages_sender_profile_id_fkey"
            columns: ["sender_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      case_stages: {
        Row: {
          case_id: string
          created_at: string | null
          descripcion: string | null
          enlace_pago: string | null
          es_publica: boolean | null
          estado: Database["public"]["Enums"]["stage_status"] | null
          estado_pago: Database["public"]["Enums"]["stage_payment_status"] | null
          etapa: string
          fecha_cumplida: string | null
          fecha_programada: string | null
          id: string
          monto_pagado_uf: number | null
          monto_variable_base: string | null
          orden: number | null
          porcentaje_variable: number | null
          costo_uf: number | null
          notas_pago: string | null
          pagado_en: string | null
          payku_payment_id: string | null
          requiere_pago: boolean
          responsable_id: string | null
          updated_at: string | null
        }
        Insert: {
          case_id: string
          created_at?: string | null
          descripcion?: string | null
          enlace_pago?: string | null
          es_publica?: boolean | null
          estado?: Database["public"]["Enums"]["stage_status"] | null
          estado_pago?: Database["public"]["Enums"]["stage_payment_status"] | null
          etapa: string
          fecha_cumplida?: string | null
          fecha_programada?: string | null
          id?: string
          monto_pagado_uf?: number | null
          monto_variable_base?: string | null
          orden?: number | null
          porcentaje_variable?: number | null
          costo_uf?: number | null
          notas_pago?: string | null
          pagado_en?: string | null
          payku_payment_id?: string | null
          requiere_pago?: boolean
          responsable_id?: string | null
          updated_at?: string | null
        }
        Update: {
          case_id?: string
          created_at?: string | null
          descripcion?: string | null
          enlace_pago?: string | null
          es_publica?: boolean | null
          estado?: Database["public"]["Enums"]["stage_status"] | null
          estado_pago?: Database["public"]["Enums"]["stage_payment_status"] | null
          etapa?: string
          fecha_cumplida?: string | null
          fecha_programada?: string | null
          id?: string
          monto_pagado_uf?: number | null
          monto_variable_base?: string | null
          orden?: number | null
          porcentaje_variable?: number | null
          costo_uf?: number | null
          notas_pago?: string | null
          pagado_en?: string | null
          payku_payment_id?: string | null
          requiere_pago?: boolean
          responsable_id?: string | null
          updated_at?: string | null
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
          },
        ]
      }
      cases: {
        Row: {
          abogado_responsable: string | null
          analista_id: string | null
          caratulado: string
          cliente_principal_id: string | null
          comuna: string | null
          contraparte: string | null
          created_at: string | null
          descripcion_inicial: string | null
          documentacion_recibida: string | null
          estado: Database["public"]["Enums"]["case_status"] | null
          etapa_actual: string | null
          fecha_inicio: string | null
          honorario_total_uf: number | null
          honorario_variable_porcentaje: number | null
          honorario_variable_base: string | null
          honorario_moneda: string
          honorario_notas: string | null
          honorario_pagado_uf: number
          id: string
          modalidad_cobro: string
          materia: string | null
          nombre_cliente: string
          numero_causa: string | null
          objetivo_cliente: string | null
          observaciones: string | null
          prioridad: Database["public"]["Enums"]["case_priority"] | null
          region: string | null
          rut_cliente: string | null
          tarifa_referencia: string | null
          tribunal: string | null
          updated_at: string | null
          validado_at: string | null
          valor_estimado: number | null
          workflow_state: string | null
        }
        Insert: {
          abogado_responsable?: string | null
          analista_id?: string | null
          caratulado: string
          cliente_principal_id?: string | null
          comuna?: string | null
          contraparte?: string | null
          created_at?: string | null
          descripcion_inicial?: string | null
          documentacion_recibida?: string | null
          estado?: Database["public"]["Enums"]["case_status"] | null
          etapa_actual?: string | null
          fecha_inicio?: string | null
          honorario_total_uf?: number | null
          honorario_variable_porcentaje?: number | null
          honorario_variable_base?: string | null
          honorario_moneda?: string | null
          honorario_notas?: string | null
          honorario_pagado_uf?: number | null
          id?: string
          modalidad_cobro?: string | null
          materia?: string | null
          nombre_cliente: string
          numero_causa?: string | null
          objetivo_cliente?: string | null
          observaciones?: string | null
          prioridad?: Database["public"]["Enums"]["case_priority"] | null
          region?: string | null
          rut_cliente?: string | null
          tarifa_referencia?: string | null
          tribunal?: string | null
          updated_at?: string | null
          validado_at?: string | null
          valor_estimado?: number | null
          workflow_state?: string | null
        }
        Update: {
          abogado_responsable?: string | null
          analista_id?: string | null
          caratulado?: string
          cliente_principal_id?: string | null
          comuna?: string | null
          contraparte?: string | null
          created_at?: string | null
          descripcion_inicial?: string | null
          documentacion_recibida?: string | null
          estado?: Database["public"]["Enums"]["case_status"] | null
          etapa_actual?: string | null
          fecha_inicio?: string | null
          honorario_total_uf?: number | null
          honorario_variable_porcentaje?: number | null
          honorario_variable_base?: string | null
          honorario_moneda?: string | null
          honorario_notas?: string | null
          honorario_pagado_uf?: number | null
          id?: string
          modalidad_cobro?: string | null
          materia?: string | null
          nombre_cliente?: string
          numero_causa?: string | null
          objetivo_cliente?: string | null
          observaciones?: string | null
          prioridad?: Database["public"]["Enums"]["case_priority"] | null
          region?: string | null
          rut_cliente?: string | null
          tarifa_referencia?: string | null
          tribunal?: string | null
          updated_at?: string | null
          validado_at?: string | null
          valor_estimado?: number | null
          workflow_state?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cases_abogado_responsable_fkey"
            columns: ["abogado_responsable"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cases_analista_id_fkey"
            columns: ["analista_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cases_cliente_principal_id_fkey"
            columns: ["cliente_principal_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      documents: {
        Row: {
          case_id: string
          created_at: string | null
          id: string
          nombre: string
          size_bytes: number | null
          tipo_mime: string | null
          updated_at: string | null
          uploader_id: string
          url: string
          visibilidad: Database["public"]["Enums"]["document_visibility"] | null
        }
        Insert: {
          case_id: string
          created_at?: string | null
          id?: string
          nombre: string
          size_bytes?: number | null
          tipo_mime?: string | null
          updated_at?: string | null
          uploader_id: string
          url: string
          visibilidad?:
            | Database["public"]["Enums"]["document_visibility"]
            | null
        }
        Update: {
          case_id?: string
          created_at?: string | null
          id?: string
          nombre?: string
          size_bytes?: number | null
          tipo_mime?: string | null
          updated_at?: string | null
          uploader_id?: string
          url?: string
          visibilidad?:
            | Database["public"]["Enums"]["document_visibility"]
            | null
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
          },
        ]
      }
      info_requests: {
        Row: {
          archivo_adjunto: string | null
          case_id: string
          creador_id: string
          created_at: string | null
          descripcion: string
          documento_respuesta_id: string | null
          es_publica: boolean | null
          estado: Database["public"]["Enums"]["request_status"] | null
          fecha_limite: string | null
          id: string
          prioridad: Database["public"]["Enums"]["case_priority"] | null
          respondido_at: string | null
          respondido_por: string | null
          respuesta: string | null
          tipo: Database["public"]["Enums"]["request_type"] | null
          titulo: string
          updated_at: string | null
        }
        Insert: {
          archivo_adjunto?: string | null
          case_id: string
          creador_id: string
          created_at?: string | null
          descripcion: string
          documento_respuesta_id?: string | null
          es_publica?: boolean | null
          estado?: Database["public"]["Enums"]["request_status"] | null
          fecha_limite?: string | null
          id?: string
          prioridad?: Database["public"]["Enums"]["case_priority"] | null
          respondido_at?: string | null
          respondido_por?: string | null
          respuesta?: string | null
          tipo?: Database["public"]["Enums"]["request_type"] | null
          titulo: string
          updated_at?: string | null
        }
        Update: {
          archivo_adjunto?: string | null
          case_id?: string
          creador_id?: string
          created_at?: string | null
          descripcion?: string
          documento_respuesta_id?: string | null
          es_publica?: boolean | null
          estado?: Database["public"]["Enums"]["request_status"] | null
          fecha_limite?: string | null
          id?: string
          prioridad?: Database["public"]["Enums"]["case_priority"] | null
          respondido_at?: string | null
          respondido_por?: string | null
          respuesta?: string | null
          tipo?: Database["public"]["Enums"]["request_type"] | null
          titulo?: string
          updated_at?: string | null
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
          },
          {
            foreignKeyName: "info_requests_respondido_por_fkey"
            columns: ["respondido_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      legal_templates: {
        Row: {
          category: string | null
          content: string
          created_at: string | null
          created_by: string | null
          id: string
          is_shared: boolean | null
          title: string
          updated_at: string | null
        }
        Insert: {
          category?: string | null
          content: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_shared?: boolean | null
          title: string
          updated_at?: string | null
        }
        Update: {
          category?: string | null
          content?: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_shared?: boolean | null
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "legal_templates_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      login_attempts: {
        Row: {
          created_at: string | null
          email: string
          failure_reason: string | null
          id: string
          ip_address: unknown
          metadata: Json | null
          session_id: string | null
          success: boolean
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          email: string
          failure_reason?: string | null
          id?: string
          ip_address: unknown
          metadata?: Json | null
          session_id?: string | null
          success: boolean
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string
          failure_reason?: string | null
          id?: string
          ip_address?: unknown
          metadata?: Json | null
          session_id?: string | null
          success?: boolean
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "login_attempts_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "user_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "login_attempts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      magic_links: {
        Row: {
          case_id: string
          client_profile_id: string | null
          created_at: string | null
          created_by: string | null
          email: string
          expires_at: string
          id: string
          is_used: boolean | null
          permissions: string[] | null
          single_use: boolean | null
          token: string
          updated_at: string | null
          used_at: string | null
        }
        Insert: {
          case_id: string
          client_profile_id?: string | null
          created_at?: string | null
          created_by?: string | null
          email: string
          expires_at: string
          id?: string
          is_used?: boolean | null
          permissions?: string[] | null
          single_use?: boolean | null
          token: string
          updated_at?: string | null
          used_at?: string | null
        }
        Update: {
          case_id?: string
          client_profile_id?: string | null
          created_at?: string | null
          created_by?: string | null
          email?: string
          expires_at?: string
          id?: string
          is_used?: boolean | null
          permissions?: string[] | null
          single_use?: boolean | null
          token?: string
          updated_at?: string | null
          used_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "magic_links_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "magic_links_client_profile_id_fkey"
            columns: ["client_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "magic_links_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notes: {
        Row: {
          author_id: string
          case_id: string
          contenido: string
          created_at: string | null
          id: string
          tipo: Database["public"]["Enums"]["note_type"]
          updated_at: string | null
        }
        Insert: {
          author_id: string
          case_id: string
          contenido: string
          created_at?: string | null
          id?: string
          tipo?: Database["public"]["Enums"]["note_type"]
          updated_at?: string | null
        }
        Update: {
          author_id?: string
          case_id?: string
          contenido?: string
          created_at?: string | null
          id?: string
          tipo?: Database["public"]["Enums"]["note_type"]
          updated_at?: string | null
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
          },
        ]
      }
      notification_logs: {
        Row: {
          created_at: string | null
          data: Json | null
          error_message: string | null
          id: string
          recipient: string
          sent_at: string | null
          status: string
          subject: string | null
          template: string
          type: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          data?: Json | null
          error_message?: string | null
          id?: string
          recipient: string
          sent_at?: string | null
          status?: string
          subject?: string | null
          template: string
          type: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          data?: Json | null
          error_message?: string | null
          id?: string
          recipient?: string
          sent_at?: string | null
          status?: string
          subject?: string | null
          template?: string
          type?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      portal_tokens: {
        Row: {
          case_id: string
          client_profile_id: string
          created_at: string | null
          expires_at: string
          id: string
          token: string
          used_at: string | null
        }
        Insert: {
          case_id: string
          client_profile_id: string
          created_at?: string | null
          expires_at: string
          id?: string
          token: string
          used_at?: string | null
        }
        Update: {
          case_id?: string
          client_profile_id?: string
          created_at?: string | null
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
          },
        ]
      }
      profiles: {
        Row: {
          activo: boolean | null
          created_at: string | null
          email: string
          id: string
          nombre: string
          role: Database["public"]["Enums"]["user_role"]
          rut: string | null
          telefono: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          activo?: boolean | null
          created_at?: string | null
          email: string
          id?: string
          nombre: string
          role?: Database["public"]["Enums"]["user_role"]
          rut?: string | null
          telefono?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          activo?: boolean | null
          created_at?: string | null
          email?: string
          id?: string
          nombre?: string
          role?: Database["public"]["Enums"]["user_role"]
          rut?: string | null
          telefono?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      quick_links: {
        Row: {
          category: string | null
          created_at: string | null
          created_by: string | null
          icon: string | null
          id: string
          is_default: boolean | null
          title: string
          url: string
        }
        Insert: {
          category?: string | null
          created_at?: string | null
          created_by?: string | null
          icon?: string | null
          id?: string
          is_default?: boolean | null
          title: string
          url: string
        }
        Update: {
          category?: string | null
          created_at?: string | null
          created_by?: string | null
          icon?: string | null
          id?: string
          is_default?: boolean | null
          title?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "quick_links_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      security_settings: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          is_active: boolean | null
          setting_key: string
          setting_value: Json
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          setting_key: string
          setting_value: Json
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          setting_key?: string
          setting_value?: Json
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "security_settings_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_sessions: {
        Row: {
          browser: string | null
          created_at: string | null
          device_type: string | null
          ended_at: string | null
          expires_at: string
          id: string
          ip_address: unknown | null
          is_active: boolean | null
          last_activity: string | null
          location_city: string | null
          location_country: string | null
          os: string | null
          session_token: string
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          browser?: string | null
          created_at?: string | null
          device_type?: string | null
          ended_at?: string | null
          expires_at: string
          id?: string
          ip_address?: unknown | null
          is_active?: boolean | null
          last_activity?: string | null
          location_city?: string | null
          location_country?: string | null
          os?: string | null
          session_token: string
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          browser?: string | null
          created_at?: string | null
          device_type?: string | null
          ended_at?: string | null
          expires_at?: string
          id?: string
          ip_address?: unknown | null
          is_active?: boolean | null
          last_activity?: string | null
          location_city?: string | null
          location_country?: string | null
          os?: string | null
          session_token?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_sessions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      cleanup_old_audit_logs: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      detect_suspicious_activity: {
        Args: Record<PropertyKey, never>
        Returns: {
          alert_type: string
          description: string
          event_count: number
          first_seen: string
          ip_address: unknown
          last_seen: string
          severity: string
          user_email: string
        }[]
      }
      get_current_profile: {
        Args: Record<PropertyKey, never>
        Returns: {
          activo: boolean | null
          created_at: string | null
          email: string
          id: string
          nombre: string
          role: Database["public"]["Enums"]["user_role"]
          rut: string | null
          telefono: string | null
          updated_at: string | null
          user_id: string
        }
      }
      has_case_access: {
        Args: { case_uuid: string }
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
      case_workflow_state: "preparacion" | "en_revision" | "activo" | "cerrado"
      document_visibility: "privado" | "cliente"
      note_type: "privada" | "publica"
      request_status:
        | "pendiente"
        | "recibido"
        | "vencido"
        | "en_revision"
        | "respondida"
        | "cerrada"
      request_type:
        | "documento"
        | "dato"
        | "pago"
        | "otro"
        | "informacion"
        | "reunion"
      stage_status: "pendiente" | "en_proceso" | "completado"
      stage_payment_status: "pendiente" | "en_proceso" | "parcial" | "pagado" | "vencido"
      user_role: "admin_firma" | "abogado" | "cliente" | "analista"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      case_priority: ["baja", "media", "alta", "urgente"],
      case_status: ["activo", "suspendido", "archivado", "terminado"],
      case_workflow_state: ["preparacion", "en_revision", "activo", "cerrado"],
      document_visibility: ["privado", "cliente"],
      note_type: ["privada", "publica"],
      request_status: [
        "pendiente",
        "recibido",
        "vencido",
        "en_revision",
        "respondida",
        "cerrada",
      ],
      request_type: [
        "documento",
        "dato",
        "pago",
        "otro",
        "informacion",
        "reunion",
      ],
      stage_status: ["pendiente", "en_proceso", "completado"],
      user_role: ["admin_firma", "abogado", "cliente", "analista"],
    },
  },
} as const
