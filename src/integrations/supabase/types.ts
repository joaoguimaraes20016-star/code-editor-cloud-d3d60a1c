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
      activity_logs: {
        Row: {
          action_type: string
          actor_id: string | null
          actor_name: string
          appointment_id: string
          created_at: string
          id: string
          note: string | null
          team_id: string
        }
        Insert: {
          action_type: string
          actor_id?: string | null
          actor_name: string
          appointment_id: string
          created_at?: string
          id?: string
          note?: string | null
          team_id: string
        }
        Update: {
          action_type?: string
          actor_id?: string | null
          actor_name?: string
          appointment_id?: string
          created_at?: string
          id?: string
          note?: string | null
          team_id?: string
        }
        Relationships: []
      }
      appointments: {
        Row: {
          cc_collected: number | null
          closer_id: string | null
          closer_name: string | null
          created_at: string | null
          event_type_name: string | null
          event_type_uri: string | null
          id: string
          lead_email: string
          lead_name: string
          lead_phone: string | null
          mrr_amount: number | null
          mrr_months: number | null
          pipeline_stage: string | null
          product_name: string | null
          retarget_date: string | null
          retarget_reason: string | null
          revenue: number | null
          setter_id: string | null
          setter_name: string | null
          setter_notes: string | null
          start_at_utc: string
          status: Database["public"]["Enums"]["appointment_status"]
          team_id: string
          updated_at: string | null
        }
        Insert: {
          cc_collected?: number | null
          closer_id?: string | null
          closer_name?: string | null
          created_at?: string | null
          event_type_name?: string | null
          event_type_uri?: string | null
          id?: string
          lead_email: string
          lead_name: string
          lead_phone?: string | null
          mrr_amount?: number | null
          mrr_months?: number | null
          pipeline_stage?: string | null
          product_name?: string | null
          retarget_date?: string | null
          retarget_reason?: string | null
          revenue?: number | null
          setter_id?: string | null
          setter_name?: string | null
          setter_notes?: string | null
          start_at_utc: string
          status?: Database["public"]["Enums"]["appointment_status"]
          team_id: string
          updated_at?: string | null
        }
        Update: {
          cc_collected?: number | null
          closer_id?: string | null
          closer_name?: string | null
          created_at?: string | null
          event_type_name?: string | null
          event_type_uri?: string | null
          id?: string
          lead_email?: string
          lead_name?: string
          lead_phone?: string | null
          mrr_amount?: number | null
          mrr_months?: number | null
          pipeline_stage?: string | null
          product_name?: string | null
          retarget_date?: string | null
          retarget_reason?: string | null
          revenue?: number | null
          setter_id?: string | null
          setter_name?: string | null
          setter_notes?: string | null
          start_at_utc?: string
          status?: Database["public"]["Enums"]["appointment_status"]
          team_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "appointments_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      asset_field_templates: {
        Row: {
          created_at: string | null
          field_category: string
          field_name: string
          field_type: string
          help_text: string | null
          id: string
          is_active: boolean | null
          is_required: boolean | null
          order_index: number
          placeholder_text: string | null
          team_id: string | null
        }
        Insert: {
          created_at?: string | null
          field_category: string
          field_name: string
          field_type: string
          help_text?: string | null
          id?: string
          is_active?: boolean | null
          is_required?: boolean | null
          order_index: number
          placeholder_text?: string | null
          team_id?: string | null
        }
        Update: {
          created_at?: string | null
          field_category?: string
          field_name?: string
          field_type?: string
          help_text?: string | null
          id?: string
          is_active?: boolean | null
          is_required?: boolean | null
          order_index?: number
          placeholder_text?: string | null
          team_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "asset_field_templates_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      client_asset_audit_logs: {
        Row: {
          action: string
          client_asset_id: string
          created_at: string | null
          details: Json | null
          id: string
          ip_address: string | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          client_asset_id: string
          created_at?: string | null
          details?: Json | null
          id?: string
          ip_address?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          client_asset_id?: string
          created_at?: string | null
          details?: Json | null
          id?: string
          ip_address?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "client_asset_audit_logs_client_asset_id_fkey"
            columns: ["client_asset_id"]
            isOneToOne: false
            referencedRelation: "client_assets"
            referencedColumns: ["id"]
          },
        ]
      }
      client_asset_fields: {
        Row: {
          client_asset_id: string
          created_at: string | null
          field_category: string
          field_name: string
          field_type: string
          field_value: string | null
          help_text: string | null
          id: string
          is_required: boolean | null
          order_index: number
          placeholder_text: string | null
          updated_at: string | null
        }
        Insert: {
          client_asset_id: string
          created_at?: string | null
          field_category: string
          field_name: string
          field_type: string
          field_value?: string | null
          help_text?: string | null
          id?: string
          is_required?: boolean | null
          order_index: number
          placeholder_text?: string | null
          updated_at?: string | null
        }
        Update: {
          client_asset_id?: string
          created_at?: string | null
          field_category?: string
          field_name?: string
          field_type?: string
          field_value?: string | null
          help_text?: string | null
          id?: string
          is_required?: boolean | null
          order_index?: number
          placeholder_text?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "client_asset_fields_client_asset_id_fkey"
            columns: ["client_asset_id"]
            isOneToOne: false
            referencedRelation: "client_assets"
            referencedColumns: ["id"]
          },
        ]
      }
      client_asset_files: {
        Row: {
          client_asset_id: string
          file_category: string
          file_name: string
          file_path: string
          file_size: number
          id: string
          mime_type: string
          uploaded_at: string | null
          uploaded_by: string | null
        }
        Insert: {
          client_asset_id: string
          file_category: string
          file_name: string
          file_path: string
          file_size: number
          id?: string
          mime_type: string
          uploaded_at?: string | null
          uploaded_by?: string | null
        }
        Update: {
          client_asset_id?: string
          file_category?: string
          file_name?: string
          file_path?: string
          file_size?: number
          id?: string
          mime_type?: string
          uploaded_at?: string | null
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "client_asset_files_client_asset_id_fkey"
            columns: ["client_asset_id"]
            isOneToOne: false
            referencedRelation: "client_assets"
            referencedColumns: ["id"]
          },
        ]
      }
      client_assets: {
        Row: {
          access_token: string
          client_email: string
          client_name: string
          completion_percentage: number | null
          created_at: string | null
          created_by: string
          id: string
          last_updated_by: string | null
          status: string
          team_id: string | null
          token_expires_at: string
          updated_at: string | null
        }
        Insert: {
          access_token: string
          client_email: string
          client_name: string
          completion_percentage?: number | null
          created_at?: string | null
          created_by: string
          id?: string
          last_updated_by?: string | null
          status?: string
          team_id?: string | null
          token_expires_at?: string
          updated_at?: string | null
        }
        Update: {
          access_token?: string
          client_email?: string
          client_name?: string
          completion_percentage?: number | null
          created_at?: string | null
          created_by?: string
          id?: string
          last_updated_by?: string | null
          status?: string
          team_id?: string | null
          token_expires_at?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "client_assets_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          created_at: string | null
          id: string
          name: string
          team_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          name: string
          team_id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          name?: string
          team_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "clients_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      confirmation_tasks: {
        Row: {
          appointment_id: string
          assigned_at: string | null
          assigned_to: string | null
          auto_return_at: string | null
          claimed_manually: boolean | null
          completed_at: string | null
          created_at: string
          follow_up_date: string | null
          follow_up_reason: string | null
          id: string
          reschedule_date: string | null
          status: string
          task_type: Database["public"]["Enums"]["task_type"]
          team_id: string
        }
        Insert: {
          appointment_id: string
          assigned_at?: string | null
          assigned_to?: string | null
          auto_return_at?: string | null
          claimed_manually?: boolean | null
          completed_at?: string | null
          created_at?: string
          follow_up_date?: string | null
          follow_up_reason?: string | null
          id?: string
          reschedule_date?: string | null
          status?: string
          task_type?: Database["public"]["Enums"]["task_type"]
          team_id: string
        }
        Update: {
          appointment_id?: string
          assigned_at?: string | null
          assigned_to?: string | null
          auto_return_at?: string | null
          claimed_manually?: boolean | null
          completed_at?: string | null
          created_at?: string
          follow_up_date?: string | null
          follow_up_reason?: string | null
          id?: string
          reschedule_date?: string | null
          status?: string
          task_type?: Database["public"]["Enums"]["task_type"]
          team_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "confirmation_tasks_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
        ]
      }
      creator_codes: {
        Row: {
          code: string
          created_at: string | null
          created_by: string | null
          id: string
          is_active: boolean | null
          uses_count: number | null
        }
        Insert: {
          code: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_active?: boolean | null
          uses_count?: number | null
        }
        Update: {
          code?: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_active?: boolean | null
          uses_count?: number | null
        }
        Relationships: []
      }
      mrr_commissions: {
        Row: {
          appointment_id: string | null
          commission_amount: number
          commission_percentage: number
          created_at: string | null
          id: string
          month_date: string
          mrr_amount: number
          prospect_email: string
          prospect_name: string
          role: string
          sale_id: string | null
          team_id: string
          team_member_id: string
          team_member_name: string
        }
        Insert: {
          appointment_id?: string | null
          commission_amount: number
          commission_percentage: number
          created_at?: string | null
          id?: string
          month_date: string
          mrr_amount: number
          prospect_email: string
          prospect_name: string
          role: string
          sale_id?: string | null
          team_id: string
          team_member_id: string
          team_member_name: string
        }
        Update: {
          appointment_id?: string | null
          commission_amount?: number
          commission_percentage?: number
          created_at?: string | null
          id?: string
          month_date?: string
          mrr_amount?: number
          prospect_email?: string
          prospect_name?: string
          role?: string
          sale_id?: string | null
          team_id?: string
          team_member_id?: string
          team_member_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "mrr_commissions_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mrr_commissions_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
        ]
      }
      mrr_follow_up_tasks: {
        Row: {
          completed_at: string | null
          completed_by: string | null
          created_at: string
          due_date: string
          id: string
          mrr_schedule_id: string
          notes: string | null
          status: string
          team_id: string
        }
        Insert: {
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          due_date: string
          id?: string
          mrr_schedule_id: string
          notes?: string | null
          status?: string
          team_id: string
        }
        Update: {
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          due_date?: string
          id?: string
          mrr_schedule_id?: string
          notes?: string | null
          status?: string
          team_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_mrr_schedule"
            columns: ["mrr_schedule_id"]
            isOneToOne: false
            referencedRelation: "mrr_schedules"
            referencedColumns: ["id"]
          },
        ]
      }
      mrr_schedules: {
        Row: {
          appointment_id: string
          assigned_to: string | null
          client_email: string
          client_name: string
          created_at: string
          first_charge_date: string
          id: string
          mrr_amount: number
          next_renewal_date: string
          notes: string | null
          status: string
          team_id: string
          updated_at: string
        }
        Insert: {
          appointment_id: string
          assigned_to?: string | null
          client_email: string
          client_name: string
          created_at?: string
          first_charge_date: string
          id?: string
          mrr_amount: number
          next_renewal_date: string
          notes?: string | null
          status?: string
          team_id: string
          updated_at?: string
        }
        Update: {
          appointment_id?: string
          assigned_to?: string | null
          client_email?: string
          client_name?: string
          created_at?: string
          first_charge_date?: string
          id?: string
          mrr_amount?: number
          next_renewal_date?: string
          notes?: string | null
          status?: string
          team_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      password_reset_tokens: {
        Row: {
          created_at: string
          email: string
          expires_at: string
          id: string
          token: string
          used_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          email: string
          expires_at: string
          id?: string
          token: string
          used_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          token?: string
          used_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          account_type: string | null
          created_at: string | null
          email: string | null
          full_name: string | null
          id: string
          updated_at: string | null
        }
        Insert: {
          account_type?: string | null
          created_at?: string | null
          email?: string | null
          full_name?: string | null
          id: string
          updated_at?: string | null
        }
        Update: {
          account_type?: string | null
          created_at?: string | null
          email?: string | null
          full_name?: string | null
          id?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      sales: {
        Row: {
          client_id: string | null
          commission: number | null
          created_at: string | null
          customer_name: string
          date: string
          id: string
          offer_owner: string | null
          product_name: string | null
          revenue: number | null
          sales_rep: string
          setter: string
          setter_commission: number | null
          status: string
          team_id: string
          updated_at: string | null
        }
        Insert: {
          client_id?: string | null
          commission?: number | null
          created_at?: string | null
          customer_name: string
          date: string
          id?: string
          offer_owner?: string | null
          product_name?: string | null
          revenue?: number | null
          sales_rep: string
          setter: string
          setter_commission?: number | null
          status: string
          team_id: string
          updated_at?: string | null
        }
        Update: {
          client_id?: string | null
          commission?: number | null
          created_at?: string | null
          customer_name?: string
          date?: string
          id?: string
          offer_owner?: string | null
          product_name?: string | null
          revenue?: number | null
          sales_rep?: string
          setter?: string
          setter_commission?: number | null
          status?: string
          team_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sales_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      setter_rotation_settings: {
        Row: {
          created_at: string
          id: string
          is_in_rotation: boolean
          setter_id: string
          team_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_in_rotation?: boolean
          setter_id: string
          team_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_in_rotation?: boolean
          setter_id?: string
          team_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "setter_rotation_settings_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      team_assets: {
        Row: {
          category: string
          created_at: string
          created_by: string
          description: string | null
          external_url: string | null
          file_path: string | null
          file_type: string | null
          id: string
          loom_url: string | null
          order_index: number
          team_id: string
          title: string
          updated_at: string
        }
        Insert: {
          category: string
          created_at?: string
          created_by: string
          description?: string | null
          external_url?: string | null
          file_path?: string | null
          file_type?: string | null
          id?: string
          loom_url?: string | null
          order_index?: number
          team_id: string
          title: string
          updated_at?: string
        }
        Update: {
          category?: string
          created_at?: string
          created_by?: string
          description?: string | null
          external_url?: string | null
          file_path?: string | null
          file_type?: string | null
          id?: string
          loom_url?: string | null
          order_index?: number
          team_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_assets_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      team_invitations: {
        Row: {
          accepted_at: string | null
          created_at: string
          email: string
          expires_at: string
          id: string
          invited_by: string
          role: string
          team_id: string
          token: string
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string
          email: string
          expires_at?: string
          id?: string
          invited_by: string
          role?: string
          team_id: string
          token: string
        }
        Update: {
          accepted_at?: string | null
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          invited_by?: string
          role?: string
          team_id?: string
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_invitations_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      team_members: {
        Row: {
          booking_code: string | null
          created_at: string | null
          id: string
          is_active: boolean | null
          role: string | null
          team_id: string
          user_id: string
        }
        Insert: {
          booking_code?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          role?: string | null
          team_id: string
          user_id: string
        }
        Update: {
          booking_code?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          role?: string | null
          team_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_members_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      team_messages: {
        Row: {
          created_at: string
          id: string
          is_edited: boolean
          message: string
          team_id: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_edited?: boolean
          message: string
          team_id: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_edited?: boolean
          message?: string
          team_id?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_messages_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      team_pipeline_stages: {
        Row: {
          created_at: string
          id: string
          is_default: boolean
          order_index: number
          stage_color: string
          stage_id: string
          stage_label: string
          team_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_default?: boolean
          order_index: number
          stage_color: string
          stage_id: string
          stage_label: string
          team_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_default?: boolean
          order_index?: number
          stage_color?: string
          stage_id?: string
          stage_label?: string
          team_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_pipeline_stages_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      teams: {
        Row: {
          calendly_access_token: string | null
          calendly_event_types: string[] | null
          calendly_organization_uri: string | null
          calendly_refresh_token: string | null
          calendly_token_expires_at: string | null
          calendly_webhook_id: string | null
          closer_commission_percentage: number | null
          created_at: string | null
          created_by: string
          google_sheets_url: string | null
          id: string
          name: string
          setter_commission_percentage: number | null
          updated_at: string | null
        }
        Insert: {
          calendly_access_token?: string | null
          calendly_event_types?: string[] | null
          calendly_organization_uri?: string | null
          calendly_refresh_token?: string | null
          calendly_token_expires_at?: string | null
          calendly_webhook_id?: string | null
          closer_commission_percentage?: number | null
          created_at?: string | null
          created_by: string
          google_sheets_url?: string | null
          id?: string
          name: string
          setter_commission_percentage?: number | null
          updated_at?: string | null
        }
        Update: {
          calendly_access_token?: string | null
          calendly_event_types?: string[] | null
          calendly_organization_uri?: string | null
          calendly_refresh_token?: string | null
          calendly_token_expires_at?: string | null
          calendly_webhook_id?: string | null
          closer_commission_percentage?: number | null
          created_at?: string | null
          created_by?: string
          google_sheets_url?: string | null
          id?: string
          name?: string
          setter_commission_percentage?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "teams_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string | null
          id: string
          role: Database["public"]["Enums"]["global_role"]
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          role?: Database["public"]["Enums"]["global_role"]
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          role?: Database["public"]["Enums"]["global_role"]
          user_id?: string
        }
        Relationships: []
      }
      webhook_audit_logs: {
        Row: {
          created_at: string
          details: Json | null
          event_type: string
          id: string
          received_at: string
          status: string
          team_id: string
        }
        Insert: {
          created_at?: string
          details?: Json | null
          event_type: string
          id?: string
          received_at?: string
          status: string
          team_id: string
        }
        Update: {
          created_at?: string
          details?: Json | null
          event_type?: string
          id?: string
          received_at?: string
          status?: string
          team_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      auto_return_expired_tasks: { Args: never; Returns: undefined }
      calculate_completion_percentage: {
        Args: { asset_id: string }
        Returns: number
      }
      can_create_teams: { Args: { _user_id: string }; Returns: boolean }
      cleanup_expired_reset_tokens: { Args: never; Returns: undefined }
      create_task_with_assignment: {
        Args: {
          p_appointment_id: string
          p_follow_up_date?: string
          p_follow_up_reason?: string
          p_reschedule_date?: string
          p_task_type: Database["public"]["Enums"]["task_type"]
          p_team_id: string
        }
        Returns: string
      }
      get_team_role: {
        Args: { _team_id: string; _user_id: string }
        Returns: string
      }
      has_global_role: {
        Args: {
          _role: Database["public"]["Enums"]["global_role"]
          _user_id: string
        }
        Returns: boolean
      }
      has_team_role: {
        Args: { _role: string; _team_id: string; _user_id: string }
        Returns: boolean
      }
      has_valid_invitation: {
        Args: { _team_id: string; _user_id: string }
        Returns: boolean
      }
      is_creator: { Args: { _user_id: string }; Returns: boolean }
      is_team_admin: {
        Args: { _team_id: string; _user_id: string }
        Returns: boolean
      }
      is_team_member: {
        Args: { _team_id: string; _user_id: string }
        Returns: boolean
      }
    }
    Enums: {
      appointment_status:
        | "NEW"
        | "SHOWED"
        | "NO_SHOW"
        | "CANCELLED"
        | "CLOSED"
        | "RESCHEDULED"
        | "CONFIRMED"
      global_role: "super_admin" | "member" | "creator"
      task_type: "call_confirmation" | "follow_up" | "reschedule"
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
      appointment_status: [
        "NEW",
        "SHOWED",
        "NO_SHOW",
        "CANCELLED",
        "CLOSED",
        "RESCHEDULED",
        "CONFIRMED",
      ],
      global_role: ["super_admin", "member", "creator"],
      task_type: ["call_confirmation", "follow_up", "reschedule"],
    },
  },
} as const
