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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      access_config: {
        Row: {
          branch: string | null
          company: string | null
          created_at: string
          created_by: string | null
          email: string
          id: string
          is_all_access: boolean
          updated_at: string
        }
        Insert: {
          branch?: string | null
          company?: string | null
          created_at?: string
          created_by?: string | null
          email: string
          id?: string
          is_all_access?: boolean
          updated_at?: string
        }
        Update: {
          branch?: string | null
          company?: string | null
          created_at?: string
          created_by?: string | null
          email?: string
          id?: string
          is_all_access?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      activity_log: {
        Row: {
          action: string
          actor_email: string | null
          created_at: string
          entity: string | null
          entity_id: string | null
          id: string
          metadata: Json
          user_id: string | null
        }
        Insert: {
          action: string
          actor_email?: string | null
          created_at?: string
          entity?: string | null
          entity_id?: string | null
          id?: string
          metadata?: Json
          user_id?: string | null
        }
        Update: {
          action?: string
          actor_email?: string | null
          created_at?: string
          entity?: string | null
          entity_id?: string | null
          id?: string
          metadata?: Json
          user_id?: string | null
        }
        Relationships: []
      }
      bevatel_calls: {
        Row: {
          agent: string | null
          call_id: string
          caller_number: string | null
          created_at: string
          direction: string | null
          duration_seconds: number | null
          ended_at: string | null
          id: string
          raw: Json
          recording_url: string | null
          started_at: string | null
          status: string | null
          ticket_id: string | null
        }
        Insert: {
          agent?: string | null
          call_id: string
          caller_number?: string | null
          created_at?: string
          direction?: string | null
          duration_seconds?: number | null
          ended_at?: string | null
          id?: string
          raw?: Json
          recording_url?: string | null
          started_at?: string | null
          status?: string | null
          ticket_id?: string | null
        }
        Update: {
          agent?: string | null
          call_id?: string
          caller_number?: string | null
          created_at?: string
          direction?: string | null
          duration_seconds?: number | null
          ended_at?: string | null
          id?: string
          raw?: Json
          recording_url?: string | null
          started_at?: string | null
          status?: string | null
          ticket_id?: string | null
        }
        Relationships: []
      }
      complaints: {
        Row: {
          assigned_to: string | null
          branch: string | null
          category: string | null
          channel: string | null
          created_at: string
          created_by: string | null
          customer_name: string | null
          customer_phone: string | null
          description: string | null
          id: string
          metadata: Json
          resolved_at: string | null
          status: Database["public"]["Enums"]["complaint_status"]
          subject: string
          ticket_id: string | null
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          branch?: string | null
          category?: string | null
          channel?: string | null
          created_at?: string
          created_by?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          description?: string | null
          id?: string
          metadata?: Json
          resolved_at?: string | null
          status?: Database["public"]["Enums"]["complaint_status"]
          subject: string
          ticket_id?: string | null
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          branch?: string | null
          category?: string | null
          channel?: string | null
          created_at?: string
          created_by?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          description?: string | null
          id?: string
          metadata?: Json
          resolved_at?: string | null
          status?: Database["public"]["Enums"]["complaint_status"]
          subject?: string
          ticket_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      cost_entries: {
        Row: {
          amount: number
          branch: string | null
          category: string
          created_at: string
          created_by: string | null
          currency: string
          description: string | null
          entry_date: string
          id: string
          metadata: Json
          updated_at: string
        }
        Insert: {
          amount?: number
          branch?: string | null
          category: string
          created_at?: string
          created_by?: string | null
          currency?: string
          description?: string | null
          entry_date: string
          id?: string
          metadata?: Json
          updated_at?: string
        }
        Update: {
          amount?: number
          branch?: string | null
          category?: string
          created_at?: string
          created_by?: string | null
          currency?: string
          description?: string | null
          entry_date?: string
          id?: string
          metadata?: Json
          updated_at?: string
        }
        Relationships: []
      }
      dashboard_config: {
        Row: {
          config: Json
          created_at: string
          id: string
          page_key: string
          updated_at: string
          user_id: string
        }
        Insert: {
          config?: Json
          created_at?: string
          id?: string
          page_key: string
          updated_at?: string
          user_id: string
        }
        Update: {
          config?: Json
          created_at?: string
          id?: string
          page_key?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      geocode_cache: {
        Row: {
          city: string | null
          created_at: string
          district: string | null
          id: string
          lat: number | null
          lng: number | null
          query: string
          raw: Json
        }
        Insert: {
          city?: string | null
          created_at?: string
          district?: string | null
          id?: string
          lat?: number | null
          lng?: number | null
          query: string
          raw?: Json
        }
        Update: {
          city?: string | null
          created_at?: string
          district?: string | null
          id?: string
          lat?: number | null
          lng?: number | null
          query?: string
          raw?: Json
        }
        Relationships: []
      }
      global_config: {
        Row: {
          key: string
          updated_at: string
          updated_by: string | null
          value: Json
        }
        Insert: {
          key: string
          updated_at?: string
          updated_by?: string | null
          value: Json
        }
        Update: {
          key?: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Relationships: []
      }
      integration_keys: {
        Row: {
          description: string | null
          id: string
          is_configured: boolean
          last_used_at: string | null
          name: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          description?: string | null
          id?: string
          is_configured?: boolean
          last_used_at?: string | null
          name: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          description?: string | null
          id?: string
          is_configured?: boolean
          last_used_at?: string | null
          name?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          branch: string | null
          company: string | null
          created_at: string
          email: string
          full_name: string | null
          id: string
          is_all_access: boolean
          language: string
          updated_at: string
        }
        Insert: {
          branch?: string | null
          company?: string | null
          created_at?: string
          email: string
          full_name?: string | null
          id: string
          is_all_access?: boolean
          language?: string
          updated_at?: string
        }
        Update: {
          branch?: string | null
          company?: string | null
          created_at?: string
          email?: string
          full_name?: string | null
          id?: string
          is_all_access?: boolean
          language?: string
          updated_at?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      whatsapp_access: {
        Row: {
          can_send: boolean
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          can_send?: boolean
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          can_send?: boolean
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      whatsapp_messages: {
        Row: {
          body: string | null
          created_at: string
          direction: string
          id: string
          media_url: string | null
          message_type: string
          raw: Json
          status: string | null
          ticket_id: string | null
          wa_message_id: string | null
          wa_phone: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          direction: string
          id?: string
          media_url?: string | null
          message_type?: string
          raw?: Json
          status?: string | null
          ticket_id?: string | null
          wa_message_id?: string | null
          wa_phone: string
        }
        Update: {
          body?: string | null
          created_at?: string
          direction?: string
          id?: string
          media_url?: string | null
          message_type?: string
          raw?: Json
          status?: string | null
          ticket_id?: string | null
          wa_message_id?: string | null
          wa_phone?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: { Args: { _user_id: string }; Returns: boolean }
    }
    Enums: {
      app_role: "super_admin" | "admin" | "manager" | "viewer"
      complaint_status:
        | "new"
        | "in_progress"
        | "awaiting_customer"
        | "resolved"
        | "closed"
        | "rejected"
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
      app_role: ["super_admin", "admin", "manager", "viewer"],
      complaint_status: [
        "new",
        "in_progress",
        "awaiting_customer",
        "resolved",
        "closed",
        "rejected",
      ],
    },
  },
} as const
