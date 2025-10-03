export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      data_sources: {
        Row: {
          id: string
          name: string
          url: string
          type: string
          status: string
          description: string
          special_instructions: string
          generated_prompt: string
          created_at: string
          updated_at: string
          obstacles_globaux: Json
          recommandations: string | null
        }
        Insert: {
          id?: string
          name: string
          url: string
          type?: string
          status?: string
          description?: string
          special_instructions?: string
          generated_prompt?: string
          created_at?: string
          updated_at?: string
          obstacles_globaux?: Json
          recommandations?: string | null
        }
        Update: {
          id?: string
          name?: string
          url?: string
          type?: string
          status?: string
          description?: string
          special_instructions?: string
          generated_prompt?: string
          created_at?: string
          updated_at?: string
          obstacles_globaux?: Json
          recommandations?: string | null
        }
      }
      harvesting_configs: {
        Row: {
          id: string
          data_source_id: string
          frequency: string
          selectors: Json
          filters: Json
          max_pages: number
          delay_between_requests: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          data_source_id: string
          frequency?: string
          selectors?: Json
          filters?: Json
          max_pages?: number
          delay_between_requests?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          data_source_id?: string
          frequency?: string
          selectors?: Json
          filters?: Json
          max_pages?: number
          delay_between_requests?: number
          created_at?: string
          updated_at?: string
        }
      }
      harvest_results: {
        Row: {
          id: string
          data_source_id: string
          config_id: string
          data: Json
          metadata: Json
          status: string
          error_message: string | null
          harvested_at: string
          analysis_summary: string | null
          analysis_keywords: Json | null
          analysis_completed_at: string | null
        }
        Insert: {
          id?: string
          data_source_id: string
          config_id: string
          data: Json
          metadata?: Json
          status?: string
          error_message?: string | null
          harvested_at?: string
          analysis_summary?: string | null
          analysis_keywords?: Json | null
          analysis_completed_at?: string | null
        }
        Update: {
          id?: string
          data_source_id?: string
          config_id?: string
          data?: Json
          metadata?: Json
          status?: string
          error_message?: string | null
          harvested_at?: string
          analysis_summary?: string | null
          analysis_keywords?: Json | null
          analysis_completed_at?: string | null
        }
      }
      harvest_logs: {
        Row: {
          id: string
          data_source_id: string | null
          level: string
          message: string
          details: Json
          created_at: string
        }
        Insert: {
          id?: string
          data_source_id?: string | null
          level?: string
          message: string
          details?: Json
          created_at?: string
        }
        Update: {
          id?: string
          data_source_id?: string | null
          level?: string
          message?: string
          details?: Json
          created_at?: string
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

// Interface spécifique pour les documents OpenAI avec les vrais noms de champs
export interface OpenAIDocument {
  url_doc: string;                    // OBLIGATOIRE
  type_document?: string;             // Optionnel
  format?: string;                    // Optionnel
  source_page?: string;               // Optionnel
  document_name?: string;             // Optionnel
  date_edition?: string;              // Optionnel
  auteurs?: string;                   // Optionnel
  langue?: string;                    // Optionnel
  resume?: string;                    // Optionnel
  statut?: string;                    // Optionnel
  issue_number?: string | null;       // Optionnel
  annee?: number;                     // Optionnel
  filename?: string;                  // Optionnel
  contient_texte?: string;            // Optionnel ("oui"/"non")
  pattern_verified?: boolean;         // Optionnel
  notes?: string;                     // Optionnel
  obstacles?: string | null;          // Optionnel
}