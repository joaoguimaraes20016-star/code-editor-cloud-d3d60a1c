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
          assignment_source: string | null
          booking_code: string | null
          calendly_invitee_uri: string | null
          cancel_url: string | null
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
          original_appointment_id: string | null
          original_booking_date: string | null
          original_closer_id: string | null
          original_closer_name: string | null
          original_closer_notified_at: string | null
          pipeline_stage: string | null
          previous_status: string | null
          product_name: string | null
          rebooking_type: string | null
          reschedule_count: number | null
          reschedule_url: string | null
          rescheduled_to_appointment_id: string | null
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
          assignment_source?: string | null
          booking_code?: string | null
          calendly_invitee_uri?: string | null
          cancel_url?: string | null
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
          original_appointment_id?: string | null
          original_booking_date?: string | null
          original_closer_id?: string | null
          original_closer_name?: string | null
          original_closer_notified_at?: string | null
          pipeline_stage?: string | null
          previous_status?: string | null
          product_name?: string | null
          rebooking_type?: string | null
          reschedule_count?: number | null
          reschedule_url?: string | null
          rescheduled_to_appointment_id?: string | null
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
          assignment_source?: string | null
          booking_code?: string | null
          calendly_invitee_uri?: string | null
          cancel_url?: string | null
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
          original_appointment_id?: string | null
          original_booking_date?: string | null
          original_closer_id?: string | null
          original_closer_name?: string | null
          original_closer_notified_at?: string | null
          pipeline_stage?: string | null
          previous_status?: string | null
          product_name?: string | null
          rebooking_type?: string | null
          reschedule_count?: number | null
          reschedule_url?: string | null
          rescheduled_to_appointment_id?: string | null
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
            foreignKeyName: "appointments_original_appointment_id_fkey"
            columns: ["original_appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_rescheduled_to_appointment_id_fkey"
            columns: ["rescheduled_to_appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
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
      closer_reassignment_history: {
        Row: {
          appointment_id: string
          created_at: string
          id: string
          new_closer_id: string | null
          new_closer_name: string
          notified_at: string | null
          original_closer_id: string | null
          original_closer_name: string
          reason: string | null
          reassigned_at: string
          team_id: string
        }
        Insert: {
          appointment_id: string
          created_at?: string
          id?: string
          new_closer_id?: string | null
          new_closer_name: string
          notified_at?: string | null
          original_closer_id?: string | null
          original_closer_name: string
          reason?: string | null
          reassigned_at?: string
          team_id: string
        }
        Update: {
          appointment_id?: string
          created_at?: string
          id?: string
          new_closer_id?: string | null
          new_closer_name?: string
          notified_at?: string | null
          original_closer_id?: string | null
          original_closer_name?: string
          reason?: string | null
          reassigned_at?: string
          team_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "closer_reassignment_history_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "closer_reassignment_history_team_id_fkey"
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
          assigned_role: string | null
          assigned_to: string | null
          auto_return_at: string | null
          claimed_manually: boolean | null
          completed_at: string | null
          completed_confirmations: number | null
          confirmation_attempts: Json | null
          confirmation_sequence: number | null
          created_at: string
          due_at: string
          follow_up_date: string | null
          follow_up_reason: string | null
          follow_up_sequence: number | null
          id: string
          is_overdue: boolean | null
          pipeline_stage: string | null
          required_confirmations: number | null
          reschedule_date: string | null
          reschedule_notes: string | null
          reschedule_reason: string | null
          routing_mode: string | null
          status: string
          task_type: Database["public"]["Enums"]["task_type"]
          team_id: string
        }
        Insert: {
          appointment_id: string
          assigned_at?: string | null
          assigned_role?: string | null
          assigned_to?: string | null
          auto_return_at?: string | null
          claimed_manually?: boolean | null
          completed_at?: string | null
          completed_confirmations?: number | null
          confirmation_attempts?: Json | null
          confirmation_sequence?: number | null
          created_at?: string
          due_at: string
          follow_up_date?: string | null
          follow_up_reason?: string | null
          follow_up_sequence?: number | null
          id?: string
          is_overdue?: boolean | null
          pipeline_stage?: string | null
          required_confirmations?: number | null
          reschedule_date?: string | null
          reschedule_notes?: string | null
          reschedule_reason?: string | null
          routing_mode?: string | null
          status?: string
          task_type?: Database["public"]["Enums"]["task_type"]
          team_id: string
        }
        Update: {
          appointment_id?: string
          assigned_at?: string | null
          assigned_role?: string | null
          assigned_to?: string | null
          auto_return_at?: string | null
          claimed_manually?: boolean | null
          completed_at?: string | null
          completed_confirmations?: number | null
          confirmation_attempts?: Json | null
          confirmation_sequence?: number | null
          created_at?: string
          due_at?: string
          follow_up_date?: string | null
          follow_up_reason?: string | null
          follow_up_sequence?: number | null
          id?: string
          is_overdue?: boolean | null
          pipeline_stage?: string | null
          required_confirmations?: number | null
          reschedule_date?: string | null
          reschedule_notes?: string | null
          reschedule_reason?: string | null
          routing_mode?: string | null
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
      data_integrity_logs: {
        Row: {
          created_at: string
          details: Json | null
          id: string
          issue_count: number
          issue_type: string
          resolved_at: string | null
          resolved_by: string | null
        }
        Insert: {
          created_at?: string
          details?: Json | null
          id?: string
          issue_count: number
          issue_type: string
          resolved_at?: string | null
          resolved_by?: string | null
        }
        Update: {
          created_at?: string
          details?: Json | null
          id?: string
          issue_count?: number
          issue_type?: string
          resolved_at?: string | null
          resolved_by?: string | null
        }
        Relationships: []
      }
      email_aliases: {
        Row: {
          alias_email: string
          created_at: string | null
          created_by: string | null
          id: string
          notes: string | null
          source: string
          user_id: string
        }
        Insert: {
          alias_email: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          notes?: string | null
          source?: string
          user_id: string
        }
        Update: {
          alias_email?: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          notes?: string | null
          source?: string
          user_id?: string
        }
        Relationships: []
      }
      error_logs: {
        Row: {
          created_at: string
          error_context: Json | null
          error_message: string
          error_type: string
          id: string
          team_id: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          error_context?: Json | null
          error_message: string
          error_type: string
          id?: string
          team_id?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          error_context?: Json | null
          error_message?: string
          error_type?: string
          id?: string
          team_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "error_logs_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
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
          setter: string | null
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
          setter?: string | null
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
          setter?: string | null
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
      saved_reports: {
        Row: {
          created_at: string | null
          created_by: string | null
          id: string
          is_shared: boolean | null
          report_config: Json
          report_name: string
          report_type: string
          team_id: string
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_shared?: boolean | null
          report_config: Json
          report_name: string
          report_type: string
          team_id: string
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_shared?: boolean | null
          report_config?: Json
          report_name?: string
          report_type?: string
          team_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "saved_reports_team_id_fkey"
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
      team_automation_rules: {
        Row: {
          action_config: Json | null
          action_type: string
          created_at: string | null
          created_by: string | null
          id: string
          is_active: boolean | null
          rule_name: string
          team_id: string
          trigger_conditions: Json | null
          trigger_event: string
        }
        Insert: {
          action_config?: Json | null
          action_type: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_active?: boolean | null
          rule_name: string
          team_id: string
          trigger_conditions?: Json | null
          trigger_event: string
        }
        Update: {
          action_config?: Json | null
          action_type?: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_active?: boolean | null
          rule_name?: string
          team_id?: string
          trigger_conditions?: Json | null
          trigger_event?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_automation_rules_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      team_follow_up_flow_config: {
        Row: {
          assigned_role: string
          created_at: string | null
          enabled: boolean | null
          hours_after: number
          id: string
          label: string
          pipeline_stage: string
          require_no_status_change_for_next: boolean | null
          sequence: number
          team_id: string
          updated_at: string | null
        }
        Insert: {
          assigned_role?: string
          created_at?: string | null
          enabled?: boolean | null
          hours_after: number
          id?: string
          label: string
          pipeline_stage: string
          require_no_status_change_for_next?: boolean | null
          sequence: number
          team_id: string
          updated_at?: string | null
        }
        Update: {
          assigned_role?: string
          created_at?: string | null
          enabled?: boolean | null
          hours_after?: number
          id?: string
          label?: string
          pipeline_stage?: string
          require_no_status_change_for_next?: boolean | null
          sequence?: number
          team_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "team_follow_up_flow_config_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      team_follow_up_settings: {
        Row: {
          created_at: string
          default_days: number
          default_time: string
          id: string
          pipeline_stage: string
          suggest_follow_up: boolean
          team_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          default_days?: number
          default_time?: string
          id?: string
          pipeline_stage: string
          suggest_follow_up?: boolean
          team_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          default_days?: number
          default_time?: string
          id?: string
          pipeline_stage?: string
          suggest_follow_up?: boolean
          team_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_follow_up_settings_team_id_fkey"
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
          allow_setter_pipeline_updates: boolean
          auto_create_tasks: boolean | null
          calendly_access_token: string | null
          calendly_event_types: string[] | null
          calendly_organization_uri: string | null
          calendly_refresh_token: string | null
          calendly_token_expires_at: string | null
          calendly_webhook_id: string | null
          calendly_webhook_signing_key: string | null
          closer_commission_percentage: number | null
          confirmation_flow_config: Json | null
          confirmation_schedule: Json | null
          created_at: string | null
          created_by: string
          dashboard_preferences: Json | null
          default_task_routing: Json | null
          fallback_confirmation_minutes: number | null
          google_sheets_url: string | null
          id: string
          last_task_assignment: Json | null
          minimum_booking_notice_hours: number | null
          mrr_task_assignment: string | null
          name: string
          no_answer_retry_minutes: number | null
          overdue_threshold_minutes: number | null
          setter_commission_percentage: number | null
          task_routing_config: Json | null
          updated_at: string | null
        }
        Insert: {
          allow_setter_pipeline_updates?: boolean
          auto_create_tasks?: boolean | null
          calendly_access_token?: string | null
          calendly_event_types?: string[] | null
          calendly_organization_uri?: string | null
          calendly_refresh_token?: string | null
          calendly_token_expires_at?: string | null
          calendly_webhook_id?: string | null
          calendly_webhook_signing_key?: string | null
          closer_commission_percentage?: number | null
          confirmation_flow_config?: Json | null
          confirmation_schedule?: Json | null
          created_at?: string | null
          created_by: string
          dashboard_preferences?: Json | null
          default_task_routing?: Json | null
          fallback_confirmation_minutes?: number | null
          google_sheets_url?: string | null
          id?: string
          last_task_assignment?: Json | null
          minimum_booking_notice_hours?: number | null
          mrr_task_assignment?: string | null
          name: string
          no_answer_retry_minutes?: number | null
          overdue_threshold_minutes?: number | null
          setter_commission_percentage?: number | null
          task_routing_config?: Json | null
          updated_at?: string | null
        }
        Update: {
          allow_setter_pipeline_updates?: boolean
          auto_create_tasks?: boolean | null
          calendly_access_token?: string | null
          calendly_event_types?: string[] | null
          calendly_organization_uri?: string | null
          calendly_refresh_token?: string | null
          calendly_token_expires_at?: string | null
          calendly_webhook_id?: string | null
          calendly_webhook_signing_key?: string | null
          closer_commission_percentage?: number | null
          confirmation_flow_config?: Json | null
          confirmation_schedule?: Json | null
          created_at?: string | null
          created_by?: string
          dashboard_preferences?: Json | null
          default_task_routing?: Json | null
          fallback_confirmation_minutes?: number | null
          google_sheets_url?: string | null
          id?: string
          last_task_assignment?: Json | null
          minimum_booking_notice_hours?: number | null
          mrr_task_assignment?: string | null
          name?: string
          no_answer_retry_minutes?: number | null
          overdue_threshold_minutes?: number | null
          setter_commission_percentage?: number | null
          task_routing_config?: Json | null
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
      auto_assign_unassigned_tasks: { Args: never; Returns: undefined }
      auto_return_expired_tasks: { Args: never; Returns: undefined }
      calculate_completion_percentage: {
        Args: { asset_id: string }
        Returns: number
      }
      can_create_teams: { Args: { _user_id: string }; Returns: boolean }
      check_active_triggers: {
        Args: never
        Returns: {
          event: string
          table_name: string
          trigger_name: string
        }[]
      }
      check_data_integrity: {
        Args: never
        Returns: {
          details: Json
          issue_count: number
          issue_type: string
        }[]
      }
      check_overdue_tasks: { Args: never; Returns: undefined }
      cleanup_appointment_tasks: {
        Args: { appt_id: string }
        Returns: undefined
      }
      cleanup_confirmation_tasks: {
        Args: { p_appointment_id: string; p_reason?: string }
        Returns: undefined
      }
      cleanup_expired_reset_tokens: { Args: never; Returns: undefined }
      close_deal_transaction: {
        Args: {
          p_appointment_id: string
          p_cc_amount: number
          p_closer_commission_pct?: number
          p_closer_id: string
          p_closer_name?: string
          p_mrr_amount: number
          p_mrr_months: number
          p_notes?: string
          p_product_name: string
          p_setter_commission_pct?: number
        }
        Returns: Json
      }
      create_task_with_assignment: {
        Args: {
          p_appointment_id: string
          p_follow_up_date?: string
          p_follow_up_reason?: string
          p_preferred_role?: string
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
      initialize_follow_up_flow_config: { Args: never; Returns: undefined }
      insert_appointments_batch: {
        Args: { appointments_data: Json }
        Returns: {
          assignment_source: string | null
          booking_code: string | null
          calendly_invitee_uri: string | null
          cancel_url: string | null
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
          original_appointment_id: string | null
          original_booking_date: string | null
          original_closer_id: string | null
          original_closer_name: string | null
          original_closer_notified_at: string | null
          pipeline_stage: string | null
          previous_status: string | null
          product_name: string | null
          rebooking_type: string | null
          reschedule_count: number | null
          reschedule_url: string | null
          rescheduled_to_appointment_id: string | null
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
        }[]
        SetofOptions: {
          from: "*"
          to: "appointments"
          isOneToOne: false
          isSetofReturn: true
        }
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
      recalculate_team_commissions: {
        Args: {
          p_closer_percentage: number
          p_setter_percentage: number
          p_team_id: string
        }
        Returns: {
          error_message: string
          updated_count: number
        }[]
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
