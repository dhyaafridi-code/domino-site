export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5";
  };
  public: {
    Tables: {
      bone_yards: {
        Row: {
          room_id: string;
          tiles: Json;
        };
        Insert: {
          room_id: string;
          tiles?: Json;
        };
        Update: {
          room_id?: string;
          tiles?: Json;
        };
        Relationships: [
          {
            foreignKeyName: "bone_yards_room_id_fkey";
            columns: ["room_id"];
            isOneToOne: true;
            referencedRelation: "rooms";
            referencedColumns: ["id"];
          },
        ];
      };
      game_state: {
        Row: {
          board: Json;
          bone_yard_count: number;
          game_winner_user_id: string | null;
          hand_counts: Json;
          last_action: Json | null;
          left_end: number | null;
          passes_in_row: number;
          right_end: number | null;
          room_id: string;
          round_number: number;
          turn_seat: number;
          updated_at: string;
          winner_seat: number | null;
        };
        Insert: {
          board?: Json;
          bone_yard_count?: number;
          game_winner_user_id?: string | null;
          hand_counts?: Json;
          last_action?: Json | null;
          left_end?: number | null;
          passes_in_row?: number;
          right_end?: number | null;
          room_id: string;
          round_number?: number;
          turn_seat?: number;
          updated_at?: string;
          winner_seat?: number | null;
        };
        Update: {
          board?: Json;
          bone_yard_count?: number;
          game_winner_user_id?: string | null;
          hand_counts?: Json;
          last_action?: Json | null;
          left_end?: number | null;
          passes_in_row?: number;
          right_end?: number | null;
          room_id?: string;
          round_number?: number;
          turn_seat?: number;
          updated_at?: string;
          winner_seat?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "game_state_room_id_fkey";
            columns: ["room_id"];
            isOneToOne: true;
            referencedRelation: "rooms";
            referencedColumns: ["id"];
          },
        ];
      };
      messages: {
        Row: {
          created_at: string;
          id: string;
          kind: string;
          room_id: string;
          text: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          kind?: string;
          room_id: string;
          text: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          kind?: string;
          room_id?: string;
          text?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "messages_room_id_fkey";
            columns: ["room_id"];
            isOneToOne: false;
            referencedRelation: "rooms";
            referencedColumns: ["id"];
          },
        ];
      };
      player_hands: {
        Row: {
          room_player_id: string | null;
          room_id: string;
          seat: number;
          tiles: Json;
          updated_at: string;
          user_id: string | null;
        };
        Insert: {
          room_player_id?: string | null;
          room_id: string;
          seat: number;
          tiles?: Json;
          updated_at?: string;
          user_id?: string | null;
        };
        Update: {
          room_player_id?: string | null;
          room_id?: string;
          seat?: number;
          tiles?: Json;
          updated_at?: string;
          user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "player_hands_room_id_fkey";
            columns: ["room_id"];
            isOneToOne: false;
            referencedRelation: "rooms";
            referencedColumns: ["id"];
          },
        ];
      };
      profiles: {
        Row: {
          avatar_url: string | null;
          created_at: string;
          id: string;
          updated_at: string;
          username: string;
        };
        Insert: {
          avatar_url?: string | null;
          created_at?: string;
          id: string;
          updated_at?: string;
          username: string;
        };
        Update: {
          avatar_url?: string | null;
          created_at?: string;
          id?: string;
          updated_at?: string;
          username?: string;
        };
        Relationships: [];
      };
      room_players: {
        Row: {
          bot_avatar_url: string | null;
          bot_name: string | null;
          id: string;
          is_ready: boolean;
          is_bot: boolean;
          joined_at: string;
          room_id: string;
          score: number;
          seat: number;
          user_id: string | null;
        };
        Insert: {
          bot_avatar_url?: string | null;
          bot_name?: string | null;
          id?: string;
          is_ready?: boolean;
          is_bot?: boolean;
          joined_at?: string;
          room_id: string;
          score?: number;
          seat: number;
          user_id?: string | null;
        };
        Update: {
          bot_avatar_url?: string | null;
          bot_name?: string | null;
          id?: string;
          is_ready?: boolean;
          is_bot?: boolean;
          joined_at?: string;
          room_id?: string;
          score?: number;
          seat?: number;
          user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "room_players_room_id_fkey";
            columns: ["room_id"];
            isOneToOne: false;
            referencedRelation: "rooms";
            referencedColumns: ["id"];
          },
        ];
      };
      rooms: {
        Row: {
          created_at: string;
          host_id: string;
          id: string;
          is_public: boolean;
          max_players: number;
          name: string;
          status: string;
          style: string;
          winning_score: number;
        };
        Insert: {
          created_at?: string;
          host_id: string;
          id?: string;
          is_public?: boolean;
          max_players?: number;
          name?: string;
          status?: string;
          style?: string;
          winning_score?: number;
        };
        Update: {
          created_at?: string;
          host_id?: string;
          id?: string;
          is_public?: boolean;
          max_players?: number;
          name?: string;
          status?: string;
          style?: string;
          winning_score?: number;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      [_ in never]: never;
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
    Enums: {},
  },
} as const;
