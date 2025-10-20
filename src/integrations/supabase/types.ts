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
          mrr_amount: number | null
          mrr_months: number | null
          product_name: string | null
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
          mrr_amount?: number | null
          mrr_months?: number | null
          product_name?: string | null
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
          mrr_amount?: number | null
          mrr_months?: number | null
          product_name?: string | null
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
          role: string | null
          team_id: string
          user_id: string
        }
        Insert: {
          booking_code?: string | null
          created_at?: string | null
          id?: string
          role?: string | null
          team_id: string
          user_id: string
        }
        Update: {
          booking_code?: string | null
          created_at?: string | null
          id?: string
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
      teams: {
        Row: {
          calendly_access_token: string | null
          calendly_event_types: string[] | null
          calendly_organization_uri: string | null
          calendly_refresh_token: string | null
          calendly_signing_key: string | null
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
          calendly_signing_key?: string | null
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
          calendly_signing_key?: string | null
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
      can_create_teams: {
        Args: { _user_id: string }
        Returns: boolean
      }
      cleanup_expired_reset_tokens: {
        Args: Record<PropertyKey, never>
        Returns: undefined
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
      is_creator: {
        Args: { _user_id: string }
        Returns: boolean
      }
      is_team_member: {
        Args: { _team_id: string; _user_id: string }
        Returns: boolean
      }
      is_team_owner: {
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
      global_role: "super_admin" | "member"
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
      global_role: ["super_admin", "member"],
    },
  },
} as const
