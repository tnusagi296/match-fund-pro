export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "14.5";
  };
  public: {
    Tables: {
      founder_profiles: {
        Row: {
          created_at: string;
          deck_url: string | null;
          github: string | null;
          graph_entity_id: string | null;
          headline: string;
          id: string;
          linkedin: string | null;
          name: string;
          published: boolean;
          scores: Json;
          site: string | null;
          summary: string | null;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          deck_url?: string | null;
          github?: string | null;
          graph_entity_id?: string | null;
          headline?: string;
          id?: string;
          linkedin?: string | null;
          name?: string;
          published?: boolean;
          scores?: Json;
          site?: string | null;
          summary?: string | null;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          deck_url?: string | null;
          github?: string | null;
          graph_entity_id?: string | null;
          headline?: string;
          id?: string;
          linkedin?: string | null;
          name?: string;
          published?: boolean;
          scores?: Json;
          site?: string | null;
          summary?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "founder_profiles_graph_entity_id_fkey";
            columns: ["graph_entity_id"];
            isOneToOne: true;
            referencedRelation: "graph_entities";
            referencedColumns: ["id"];
          },
        ];
      };
      founder_signals: {
        Row: {
          created_at: string;
          detail: string | null;
          evidence_url: string | null;
          id: string;
          kind: string;
          profile_id: string;
          source: string;
          title: string;
          weight: number;
        };
        Insert: {
          created_at?: string;
          detail?: string | null;
          evidence_url?: string | null;
          id?: string;
          kind: string;
          profile_id: string;
          source: string;
          title: string;
          weight?: number;
        };
        Update: {
          created_at?: string;
          detail?: string | null;
          evidence_url?: string | null;
          id?: string;
          kind?: string;
          profile_id?: string;
          source?: string;
          title?: string;
          weight?: number;
        };
        Relationships: [
          {
            foreignKeyName: "founder_signals_profile_id_fkey";
            columns: ["profile_id"];
            isOneToOne: false;
            referencedRelation: "founder_profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      graph_claim_evidence: {
        Row: {
          claim_id: string;
          evidence_id: string;
        };
        Insert: {
          claim_id: string;
          evidence_id: string;
        };
        Update: {
          claim_id?: string;
          evidence_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "graph_claim_evidence_claim_id_fkey";
            columns: ["claim_id"];
            isOneToOne: false;
            referencedRelation: "graph_claims";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "graph_claim_evidence_evidence_id_fkey";
            columns: ["evidence_id"];
            isOneToOne: false;
            referencedRelation: "graph_evidence";
            referencedColumns: ["id"];
          },
        ];
      };
      graph_claims: {
        Row: {
          created_at: string;
          id: string;
          observed_at: string;
          predicate: string;
          status: string;
          subject_entity_id: string;
          trust_level: string;
          value: Json;
        };
        Insert: {
          created_at?: string;
          id?: string;
          observed_at: string;
          predicate: string;
          status: string;
          subject_entity_id: string;
          trust_level: string;
          value: Json;
        };
        Update: {
          created_at?: string;
          id?: string;
          observed_at?: string;
          predicate?: string;
          status?: string;
          subject_entity_id?: string;
          trust_level?: string;
          value?: Json;
        };
        Relationships: [
          {
            foreignKeyName: "graph_claims_subject_entity_id_fkey";
            columns: ["subject_entity_id"];
            isOneToOne: false;
            referencedRelation: "graph_entities";
            referencedColumns: ["id"];
          },
        ];
      };
      graph_entities: {
        Row: {
          canonical_key: string;
          canonical_name: string;
          created_at: string;
          entity_type: string;
          id: string;
          properties: Json;
          updated_at: string;
        };
        Insert: {
          canonical_key: string;
          canonical_name: string;
          created_at?: string;
          entity_type: string;
          id?: string;
          properties?: Json;
          updated_at?: string;
        };
        Update: {
          canonical_key?: string;
          canonical_name?: string;
          created_at?: string;
          entity_type?: string;
          id?: string;
          properties?: Json;
          updated_at?: string;
        };
        Relationships: [];
      };
      graph_entity_identifiers: {
        Row: {
          created_at: string;
          entity_id: string;
          id: string;
          scheme: string;
          value: string;
        };
        Insert: {
          created_at?: string;
          entity_id: string;
          id?: string;
          scheme: string;
          value: string;
        };
        Update: {
          created_at?: string;
          entity_id?: string;
          id?: string;
          scheme?: string;
          value?: string;
        };
        Relationships: [
          {
            foreignKeyName: "graph_entity_identifiers_entity_id_fkey";
            columns: ["entity_id"];
            isOneToOne: false;
            referencedRelation: "graph_entities";
            referencedColumns: ["id"];
          },
        ];
      };
      graph_evidence: {
        Row: {
          content_hash: string;
          excerpt: string;
          extraction_method: string;
          id: string;
          metadata: Json;
          page_title: string | null;
          raw_payload: Json;
          reliability: number;
          retrieved_at: string;
          source_external_id: string | null;
          source_type: string;
          source_url: string;
          trust_level: string;
        };
        Insert: {
          content_hash: string;
          excerpt: string;
          extraction_method?: string;
          id?: string;
          metadata?: Json;
          page_title?: string | null;
          raw_payload?: Json;
          reliability: number;
          retrieved_at: string;
          source_external_id?: string | null;
          source_type: string;
          source_url: string;
          trust_level?: string;
        };
        Update: {
          content_hash?: string;
          excerpt?: string;
          extraction_method?: string;
          id?: string;
          metadata?: Json;
          page_title?: string | null;
          raw_payload?: Json;
          reliability?: number;
          retrieved_at?: string;
          source_external_id?: string | null;
          source_type?: string;
          source_url?: string;
          trust_level?: string;
        };
        Relationships: [];
      };
      graph_relationship_evidence: {
        Row: {
          evidence_id: string;
          relationship_id: string;
        };
        Insert: {
          evidence_id: string;
          relationship_id: string;
        };
        Update: {
          evidence_id?: string;
          relationship_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "graph_relationship_evidence_evidence_id_fkey";
            columns: ["evidence_id"];
            isOneToOne: false;
            referencedRelation: "graph_evidence";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "graph_relationship_evidence_relationship_id_fkey";
            columns: ["relationship_id"];
            isOneToOne: false;
            referencedRelation: "graph_relationships";
            referencedColumns: ["id"];
          },
        ];
      };
      graph_relationships: {
        Row: {
          confidence: number;
          created_at: string;
          id: string;
          observed_at: string;
          properties: Json;
          relationship_type: string;
          source_entity_id: string;
          target_entity_id: string;
          valid_from: string | null;
          valid_to: string | null;
        };
        Insert: {
          confidence: number;
          created_at?: string;
          id?: string;
          observed_at: string;
          properties?: Json;
          relationship_type: string;
          source_entity_id: string;
          target_entity_id: string;
          valid_from?: string | null;
          valid_to?: string | null;
        };
        Update: {
          confidence?: number;
          created_at?: string;
          id?: string;
          observed_at?: string;
          properties?: Json;
          relationship_type?: string;
          source_entity_id?: string;
          target_entity_id?: string;
          valid_from?: string | null;
          valid_to?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "graph_relationships_source_entity_id_fkey";
            columns: ["source_entity_id"];
            isOneToOne: false;
            referencedRelation: "graph_entities";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "graph_relationships_target_entity_id_fkey";
            columns: ["target_entity_id"];
            isOneToOne: false;
            referencedRelation: "graph_entities";
            referencedColumns: ["id"];
          },
        ];
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema["CompositeTypes"] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
