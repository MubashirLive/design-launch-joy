export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5";
  };
  public: {
    Tables: {
      admins: {
        Row: {
          admin_id: string;
          created_at: string;
          created_by: string | null;
          email: string;
          forms_filled_count: number;
          full_name: string;
          id: string;
          is_active: boolean;
          user_id: string;
        };
        Insert: {
          admin_id: string;
          created_at?: string;
          created_by?: string | null;
          email: string;
          forms_filled_count?: number;
          full_name: string;
          id?: string;
          is_active?: boolean;
          user_id: string;
        };
        Update: {
          admin_id?: string;
          created_at?: string;
          created_by?: string | null;
          email?: string;
          forms_filled_count?: number;
          full_name?: string;
          id?: string;
          is_active?: boolean;
          user_id?: string;
        };
        Relationships: [];
      };
      counters: {
        Row: {
          name: string;
          value: number;
        };
        Insert: {
          name: string;
          value?: number;
        };
        Update: {
          name?: string;
          value?: number;
        };
        Relationships: [];
      };
      enrollments: {
        Row: {
          activities: Json;
          address: string;
          age: number;
          allergies_medications: string | null;
          city: string;
          class: string;
          combo_applied: boolean;
          combo_discount: number;
          created_at: string;
          date_of_birth: string;
          email: string;
          emergency_contact: string;
          enrolled_at: string;
          enrolled_by: string;
          father_contact: string;
          father_name: string;
          gender: string;
          id: string;
          is_draft: boolean;
          last_edited_at: string | null;
          marksheet_url: string | null;
          mess_fee: number;
          mess_opted: boolean;
          mother_contact: string | null;
          mother_name: string | null;
          payment_mode: Database["public"]["Enums"]["payment_mode"];
          photo_url: string | null;
          receipt_number: string | null;
          registration_id: string | null;
          registration_number: number | null;
          remarks: string | null;
          school_name: string;
          shift: Database["public"]["Enums"]["shift_type"];
          student_name: string;
          total_amount: number;
          transaction_id: string | null;
          transport_address: string | null;
          transport_fee: number;
          transport_opted: boolean;
        };
        Insert: {
          activities?: Json;
          address: string;
          age: number;
          allergies_medications?: string | null;
          city: string;
          class: string;
          combo_applied?: boolean;
          combo_discount?: number;
          created_at?: string;
          date_of_birth: string;
          email: string;
          emergency_contact: string;
          enrolled_at?: string;
          enrolled_by: string;
          father_contact: string;
          father_name: string;
          gender: string;
          id?: string;
          is_draft?: boolean;
          last_edited_at?: string | null;
          marksheet_url?: string | null;
          mess_fee?: number;
          mess_opted?: boolean;
          mother_contact?: string | null;
          mother_name?: string | null;
          payment_mode: Database["public"]["Enums"]["payment_mode"];
          photo_url?: string | null;
          receipt_number?: string | null;
          registration_id?: string | null;
          registration_number?: number | null;
          remarks?: string | null;
          school_name: string;
          shift: Database["public"]["Enums"]["shift_type"];
          student_name: string;
          total_amount?: number;
          transaction_id?: string | null;
          transport_address?: string | null;
          transport_fee?: number;
          transport_opted?: boolean;
        };
        Update: {
          activities?: Json;
          address?: string;
          age?: number;
          allergies_medications?: string | null;
          city?: string;
          class?: string;
          combo_applied?: boolean;
          combo_discount?: number;
          created_at?: string;
          date_of_birth?: string;
          email?: string;
          emergency_contact?: string;
          enrolled_at?: string;
          enrolled_by?: string;
          father_contact?: string;
          father_name?: string;
          gender?: string;
          id?: string;
          is_draft?: boolean;
          last_edited_at?: string | null;
          marksheet_url?: string | null;
          mess_fee?: number;
          mess_opted?: boolean;
          mother_contact?: string | null;
          mother_name?: string | null;
          payment_mode?: Database["public"]["Enums"]["payment_mode"];
          photo_url?: string | null;
          receipt_number?: string | null;
          registration_id?: string | null;
          registration_number?: number | null;
          remarks?: string | null;
          school_name?: string;
          shift?: Database["public"]["Enums"]["shift_type"];
          student_name?: string;
          total_amount?: number;
          transaction_id?: string | null;
          transport_address?: string | null;
          transport_fee?: number;
          transport_opted?: boolean;
        };
        Relationships: [];
      };
      user_roles: {
        Row: {
          created_at: string;
          id: string;
          role: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          role: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          role?: Database["public"]["Enums"]["app_role"];
          user_id?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"];
          _user_id: string;
        };
        Returns: boolean;
      };
      next_admin_id: { Args: { _first_name: string }; Returns: string };
      next_counter: { Args: { _name: string }; Returns: number };
    };
    Enums: {
      app_role: "super_admin" | "admin";
      payment_mode: "CASH" | "ONLINE";
      shift_type: "MORNING" | "EVENING" | "MORNING 15 DAYS" | "EVENING 15 DAYS";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      app_role: ["super_admin", "admin"],
      payment_mode: ["CASH", "ONLINE"],
      shift_type: ["MORNING", "EVENING", "MORNING 15 DAYS", "EVENING 15 DAYS"],
    },
  },
} as const;
