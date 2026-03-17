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
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      admin_audit_log: {
        Row: {
          action: string
          entity_id: string | null
          entity_type: string | null
          id: string
          new_value: Json | null
          old_value: Json | null
          performed_at: string | null
          performed_by: string
        }
        Insert: {
          action: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          new_value?: Json | null
          old_value?: Json | null
          performed_at?: string | null
          performed_by: string
        }
        Update: {
          action?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          new_value?: Json | null
          old_value?: Json | null
          performed_at?: string | null
          performed_by?: string
        }
        Relationships: []
      }
      dispatch_log: {
        Row: {
          created_at: string | null
          dispatch_date: string
          dispatched_by: string
          driver_name: string
          id: string
          module_id: string
          transporter_name: string
          updated_at: string | null
          vehicle_number: string
        }
        Insert: {
          created_at?: string | null
          dispatch_date?: string
          dispatched_by: string
          driver_name: string
          id?: string
          module_id: string
          transporter_name: string
          updated_at?: string | null
          vehicle_number: string
        }
        Update: {
          created_at?: string | null
          dispatch_date?: string
          dispatched_by?: string
          driver_name?: string
          id?: string
          module_id?: string
          transporter_name?: string
          updated_at?: string | null
          vehicle_number?: string
        }
        Relationships: [
          {
            foreignKeyName: "dispatch_log_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "modules"
            referencedColumns: ["id"]
          },
        ]
      }
      dispute_log: {
        Row: {
          claim_id: string
          id: string
          logged_at: string | null
          reason: string | null
          worker_id: string
        }
        Insert: {
          claim_id: string
          id?: string
          logged_at?: string | null
          reason?: string | null
          worker_id: string
        }
        Update: {
          claim_id?: string
          id?: string
          logged_at?: string | null
          reason?: string | null
          worker_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "dispute_log_claim_id_fkey"
            columns: ["claim_id"]
            isOneToOne: false
            referencedRelation: "labour_claims"
            referencedColumns: ["id"]
          },
        ]
      }
      handover_pack: {
        Row: {
          client_name: string
          client_signoff_name: string
          created_at: string | null
          handover_date: string
          handover_notes: string | null
          id: string
          om_document_url: string | null
          project_id: string
          snag_list: string | null
          snag_photos: string[] | null
          submitted_by: string
          updated_at: string | null
        }
        Insert: {
          client_name: string
          client_signoff_name: string
          created_at?: string | null
          handover_date?: string
          handover_notes?: string | null
          id?: string
          om_document_url?: string | null
          project_id: string
          snag_list?: string | null
          snag_photos?: string[] | null
          submitted_by: string
          updated_at?: string | null
        }
        Update: {
          client_name?: string
          client_signoff_name?: string
          created_at?: string | null
          handover_date?: string
          handover_notes?: string | null
          id?: string
          om_document_url?: string | null
          project_id?: string
          snag_list?: string | null
          snag_photos?: string[] | null
          submitted_by?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "handover_pack_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      installation_checklist: {
        Row: {
          connections_photo: string | null
          created_at: string | null
          id: string
          is_complete: boolean
          lifting_photo: string | null
          lifting_sequence: string
          mep_photo: string | null
          mep_stitching: string
          module_connections: string
          module_id: string
          snagging: string
          snagging_photo: string | null
          submitted_at: string | null
          submitted_by: string
          updated_at: string | null
          weatherproofing: string
          weatherproofing_photo: string | null
        }
        Insert: {
          connections_photo?: string | null
          created_at?: string | null
          id?: string
          is_complete?: boolean
          lifting_photo?: string | null
          lifting_sequence?: string
          mep_photo?: string | null
          mep_stitching?: string
          module_connections?: string
          module_id: string
          snagging?: string
          snagging_photo?: string | null
          submitted_at?: string | null
          submitted_by: string
          updated_at?: string | null
          weatherproofing?: string
          weatherproofing_photo?: string | null
        }
        Update: {
          connections_photo?: string | null
          created_at?: string | null
          id?: string
          is_complete?: boolean
          lifting_photo?: string | null
          lifting_sequence?: string
          mep_photo?: string | null
          mep_stitching?: string
          module_connections?: string
          module_id?: string
          snagging?: string
          snagging_photo?: string | null
          submitted_at?: string | null
          submitted_by?: string
          updated_at?: string | null
          weatherproofing?: string
          weatherproofing_photo?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "installation_checklist_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "modules"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_items: {
        Row: {
          category: string
          created_at: string
          created_by: string | null
          current_stock: number
          id: string
          is_archived: boolean
          material_name: string
          reorder_level: number
          unit: string
          updated_at: string
        }
        Insert: {
          category: string
          created_at?: string
          created_by?: string | null
          current_stock?: number
          id?: string
          is_archived?: boolean
          material_name: string
          reorder_level?: number
          unit?: string
          updated_at?: string
        }
        Update: {
          category?: string
          created_at?: string
          created_by?: string | null
          current_stock?: number
          id?: string
          is_archived?: boolean
          material_name?: string
          reorder_level?: number
          unit?: string
          updated_at?: string
        }
        Relationships: []
      }
      labour_approvals: {
        Row: {
          action: string
          actioned_at: string | null
          approved_by: string
          claim_id: string
          id: string
          photo_url: string | null
          reason_if_rejected: string | null
        }
        Insert: {
          action: string
          actioned_at?: string | null
          approved_by: string
          claim_id: string
          id?: string
          photo_url?: string | null
          reason_if_rejected?: string | null
        }
        Update: {
          action?: string
          actioned_at?: string | null
          approved_by?: string
          claim_id?: string
          id?: string
          photo_url?: string | null
          reason_if_rejected?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "labour_approvals_claim_id_fkey"
            columns: ["claim_id"]
            isOneToOne: false
            referencedRelation: "labour_claims"
            referencedColumns: ["id"]
          },
        ]
      }
      labour_claims: {
        Row: {
          created_at: string | null
          created_by: string | null
          id: string
          is_archived: boolean | null
          module_id: string
          quantity: number
          status: string | null
          submitted_at: string | null
          trade: string
          updated_at: string | null
          work_description: string | null
          worker_id: string
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_archived?: boolean | null
          module_id: string
          quantity: number
          status?: string | null
          submitted_at?: string | null
          trade: string
          updated_at?: string | null
          work_description?: string | null
          worker_id: string
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_archived?: boolean | null
          module_id?: string
          quantity?: number
          status?: string | null
          submitted_at?: string | null
          trade?: string
          updated_at?: string | null
          work_description?: string | null
          worker_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "labour_claims_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "modules"
            referencedColumns: ["id"]
          },
        ]
      }
      material_requests: {
        Row: {
          budget_approved_at: string | null
          budget_approved_by: string | null
          created_at: string | null
          director_approved_at: string | null
          director_approved_by: string | null
          id: string
          is_archived: boolean | null
          is_over_budget: boolean | null
          material_name: string
          module_id: string | null
          notes: string | null
          po_raised_at: string | null
          po_raised_by: string | null
          project_id: string | null
          quantity: number
          received_at: string | null
          received_by: string | null
          rejection_reason: string | null
          requested_by: string
          status: string
          unit: string
          updated_at: string | null
          urgency: string
        }
        Insert: {
          budget_approved_at?: string | null
          budget_approved_by?: string | null
          created_at?: string | null
          director_approved_at?: string | null
          director_approved_by?: string | null
          id?: string
          is_archived?: boolean | null
          is_over_budget?: boolean | null
          material_name: string
          module_id?: string | null
          notes?: string | null
          po_raised_at?: string | null
          po_raised_by?: string | null
          project_id?: string | null
          quantity: number
          received_at?: string | null
          received_by?: string | null
          rejection_reason?: string | null
          requested_by: string
          status?: string
          unit?: string
          updated_at?: string | null
          urgency?: string
        }
        Update: {
          budget_approved_at?: string | null
          budget_approved_by?: string | null
          created_at?: string | null
          director_approved_at?: string | null
          director_approved_by?: string | null
          id?: string
          is_archived?: boolean | null
          is_over_budget?: boolean | null
          material_name?: string
          module_id?: string | null
          notes?: string | null
          po_raised_at?: string | null
          po_raised_by?: string | null
          project_id?: string | null
          quantity?: number
          received_at?: string | null
          received_by?: string | null
          rejection_reason?: string | null
          requested_by?: string
          status?: string
          unit?: string
          updated_at?: string | null
          urgency?: string
        }
        Relationships: [
          {
            foreignKeyName: "material_requests_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "modules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "material_requests_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      modules: {
        Row: {
          created_at: string | null
          created_by: string | null
          current_stage: string | null
          id: string
          is_archived: boolean | null
          module_code: string | null
          module_type: string
          name: string
          panel_id: string | null
          production_status: string | null
          project_id: string
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          current_stage?: string | null
          id?: string
          is_archived?: boolean | null
          module_code?: string | null
          module_type?: string
          name: string
          panel_id?: string | null
          production_status?: string | null
          project_id: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          current_stage?: string | null
          id?: string
          is_archived?: boolean | null
          module_code?: string | null
          module_type?: string
          name?: string
          panel_id?: string | null
          production_status?: string | null
          project_id?: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "modules_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      ncr_register: {
        Row: {
          checklist_item_id: string | null
          closed_at: string | null
          closed_by: string | null
          created_at: string | null
          id: string
          inspection_id: string | null
          is_archived: boolean | null
          ncr_number: string
          raised_by: string | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          checklist_item_id?: string | null
          closed_at?: string | null
          closed_by?: string | null
          created_at?: string | null
          id?: string
          inspection_id?: string | null
          is_archived?: boolean | null
          ncr_number: string
          raised_by?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          checklist_item_id?: string | null
          closed_at?: string | null
          closed_by?: string | null
          created_at?: string | null
          id?: string
          inspection_id?: string | null
          is_archived?: boolean | null
          ncr_number?: string
          raised_by?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ncr_register_checklist_item_id_fkey"
            columns: ["checklist_item_id"]
            isOneToOne: false
            referencedRelation: "qc_checklist_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ncr_register_inspection_id_fkey"
            columns: ["inspection_id"]
            isOneToOne: false
            referencedRelation: "qc_inspections"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          content: string
          created_at: string | null
          id: string
          is_read: boolean | null
          linked_entity_id: string | null
          linked_entity_type: string | null
          recipient_id: string
          type: string
        }
        Insert: {
          content: string
          created_at?: string | null
          id?: string
          is_read?: boolean | null
          linked_entity_id?: string | null
          linked_entity_type?: string | null
          recipient_id: string
          type: string
        }
        Update: {
          content?: string
          created_at?: string | null
          id?: string
          is_read?: boolean | null
          linked_entity_id?: string | null
          linked_entity_type?: string | null
          recipient_id?: string
          type?: string
        }
        Relationships: []
      }
      panels: {
        Row: {
          created_at: string | null
          created_by: string | null
          current_stage: string | null
          height_mm: number | null
          id: string
          is_archived: boolean | null
          length_mm: number | null
          module_id: string
          panel_code: string
          panel_type: string
          production_status: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          current_stage?: string | null
          height_mm?: number | null
          id?: string
          is_archived?: boolean | null
          length_mm?: number | null
          module_id: string
          panel_code: string
          panel_type?: string
          production_status?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          current_stage?: string | null
          height_mm?: number | null
          id?: string
          is_archived?: boolean | null
          length_mm?: number | null
          module_id?: string
          panel_code?: string
          panel_type?: string
          production_status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "panels_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "modules"
            referencedColumns: ["id"]
          },
        ]
      }
      production_stages: {
        Row: {
          completed_at: string | null
          completed_by: string | null
          created_at: string | null
          id: string
          is_archived: boolean | null
          module_id: string
          stage_name: string
          stage_order: number
          status: string | null
          updated_at: string | null
        }
        Insert: {
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string | null
          id?: string
          is_archived?: boolean | null
          module_id: string
          stage_name: string
          stage_order: number
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string | null
          id?: string
          is_archived?: boolean | null
          module_id?: string
          stage_name?: string
          stage_order?: number
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "production_stages_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "modules"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          auth_user_id: string
          avatar_url: string | null
          created_at: string | null
          display_name: string | null
          email: string | null
          id: string
          is_active: boolean | null
          is_archived: boolean | null
          kiosk_pin: string | null
          language: string | null
          login_type: Database["public"]["Enums"]["login_type"] | null
          phone: string | null
          reporting_manager_id: string | null
          role: Database["public"]["Enums"]["app_role"]
          updated_at: string | null
        }
        Insert: {
          auth_user_id: string
          avatar_url?: string | null
          created_at?: string | null
          display_name?: string | null
          email?: string | null
          id?: string
          is_active?: boolean | null
          is_archived?: boolean | null
          kiosk_pin?: string | null
          language?: string | null
          login_type?: Database["public"]["Enums"]["login_type"] | null
          phone?: string | null
          reporting_manager_id?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string | null
        }
        Update: {
          auth_user_id?: string
          avatar_url?: string | null
          created_at?: string | null
          display_name?: string | null
          email?: string | null
          id?: string
          is_active?: boolean | null
          is_archived?: boolean | null
          kiosk_pin?: string | null
          language?: string | null
          login_type?: Database["public"]["Enums"]["login_type"] | null
          phone?: string | null
          reporting_manager_id?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_reporting_manager_id_fkey"
            columns: ["reporting_manager_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          client_name: string | null
          created_at: string | null
          created_by: string | null
          est_completion: string | null
          id: string
          is_archived: boolean | null
          location: string | null
          name: string
          start_date: string | null
          status: string | null
          type: string | null
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          client_name?: string | null
          created_at?: string | null
          created_by?: string | null
          est_completion?: string | null
          id?: string
          is_archived?: boolean | null
          location?: string | null
          name: string
          start_date?: string | null
          status?: string | null
          type?: string | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          client_name?: string | null
          created_at?: string | null
          created_by?: string | null
          est_completion?: string | null
          id?: string
          is_archived?: boolean | null
          location?: string | null
          name?: string
          start_date?: string | null
          status?: string | null
          type?: string | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: []
      }
      purchase_orders: {
        Row: {
          amount: number
          created_at: string
          id: string
          is_archived: boolean
          items_summary: string
          notes: string | null
          po_date: string
          raised_by: string | null
          status: string
          updated_at: string
          vendor_name: string
        }
        Insert: {
          amount?: number
          created_at?: string
          id?: string
          is_archived?: boolean
          items_summary: string
          notes?: string | null
          po_date?: string
          raised_by?: string | null
          status?: string
          updated_at?: string
          vendor_name: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          is_archived?: boolean
          items_summary?: string
          notes?: string | null
          po_date?: string
          raised_by?: string | null
          status?: string
          updated_at?: string
          vendor_name?: string
        }
        Relationships: []
      }
      qc_checklist_items: {
        Row: {
          created_at: string | null
          created_by: string | null
          description: string
          id: string
          is_active: boolean | null
          is_critical: boolean | null
          item_number: number
          sort_order: number
          stage_name: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          description: string
          id?: string
          is_active?: boolean | null
          is_critical?: boolean | null
          item_number: number
          sort_order: number
          stage_name: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          description?: string
          id?: string
          is_active?: boolean | null
          is_critical?: boolean | null
          item_number?: number
          sort_order?: number
          stage_name?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      qc_inspection_items: {
        Row: {
          ai_severity: string | null
          checklist_item_id: string
          created_at: string | null
          id: string
          inspection_id: string
          notes: string | null
          photo_url: string | null
          result: string | null
        }
        Insert: {
          ai_severity?: string | null
          checklist_item_id: string
          created_at?: string | null
          id?: string
          inspection_id: string
          notes?: string | null
          photo_url?: string | null
          result?: string | null
        }
        Update: {
          ai_severity?: string | null
          checklist_item_id?: string
          created_at?: string | null
          id?: string
          inspection_id?: string
          notes?: string | null
          photo_url?: string | null
          result?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "qc_inspection_items_checklist_item_id_fkey"
            columns: ["checklist_item_id"]
            isOneToOne: false
            referencedRelation: "qc_checklist_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "qc_inspection_items_inspection_id_fkey"
            columns: ["inspection_id"]
            isOneToOne: false
            referencedRelation: "qc_inspections"
            referencedColumns: ["id"]
          },
        ]
      }
      qc_inspections: {
        Row: {
          ai_response: Json | null
          created_at: string | null
          dispatch_decision: string | null
          id: string
          inspector_id: string
          is_archived: boolean | null
          module_id: string
          stage_name: string
          status: string | null
          submitted_at: string | null
          updated_at: string | null
        }
        Insert: {
          ai_response?: Json | null
          created_at?: string | null
          dispatch_decision?: string | null
          id?: string
          inspector_id: string
          is_archived?: boolean | null
          module_id: string
          stage_name: string
          status?: string | null
          submitted_at?: string | null
          updated_at?: string | null
        }
        Update: {
          ai_response?: Json | null
          created_at?: string | null
          dispatch_decision?: string | null
          id?: string
          inspector_id?: string
          is_archived?: boolean | null
          module_id?: string
          stage_name?: string
          status?: string | null
          submitted_at?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "qc_inspections_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "modules"
            referencedColumns: ["id"]
          },
        ]
      }
      rate_cards: {
        Row: {
          created_at: string | null
          created_by: string | null
          effective_from: string | null
          id: string
          is_archived: boolean | null
          rate_per_unit: number
          trade: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          effective_from?: string | null
          id?: string
          is_archived?: boolean | null
          rate_per_unit: number
          trade: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          effective_from?: string | null
          id?: string
          is_archived?: boolean | null
          rate_per_unit?: number
          trade?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      site_diary: {
        Row: {
          blockers: string | null
          created_at: string | null
          entry_date: string
          gps_location: string | null
          id: string
          manpower_count: number | null
          notes: string | null
          photo_urls: string[]
          project_id: string
          submitted_by: string
          updated_at: string | null
          weather_condition: string | null
        }
        Insert: {
          blockers?: string | null
          created_at?: string | null
          entry_date?: string
          gps_location?: string | null
          id?: string
          manpower_count?: number | null
          notes?: string | null
          photo_urls?: string[]
          project_id: string
          submitted_by: string
          updated_at?: string | null
          weather_condition?: string | null
        }
        Update: {
          blockers?: string | null
          created_at?: string | null
          entry_date?: string
          gps_location?: string | null
          id?: string
          manpower_count?: number | null
          notes?: string | null
          photo_urls?: string[]
          project_id?: string
          submitted_by?: string
          updated_at?: string | null
          weather_condition?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "site_diary_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      site_readiness: {
        Row: {
          crane_booked: boolean
          created_at: string | null
          foundation_ready: boolean
          id: string
          is_complete: boolean
          module_id: string
          safety_equipment: boolean
          site_access_clear: boolean
          submitted_at: string | null
          submitted_by: string
          team_briefed: boolean
          updated_at: string | null
        }
        Insert: {
          crane_booked?: boolean
          created_at?: string | null
          foundation_ready?: boolean
          id?: string
          is_complete?: boolean
          module_id: string
          safety_equipment?: boolean
          site_access_clear?: boolean
          submitted_at?: string | null
          submitted_by: string
          team_briefed?: boolean
          updated_at?: string | null
        }
        Update: {
          crane_booked?: boolean
          created_at?: string | null
          foundation_ready?: boolean
          id?: string
          is_complete?: boolean
          module_id?: string
          safety_equipment?: boolean
          site_access_clear?: boolean
          submitted_at?: string | null
          submitted_by?: string
          team_briefed?: boolean
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "site_readiness_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "modules"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_user_role: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["app_role"]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_director: { Args: { _user_id: string }; Returns: boolean }
      is_full_admin: { Args: { _user_id: string }; Returns: boolean }
    }
    Enums: {
      app_role:
        | "finance_director"
        | "sales_director"
        | "architecture_director"
        | "head_operations"
        | "production_head"
        | "finance_manager"
        | "planning_engineer"
        | "costing_engineer"
        | "quantity_surveyor"
        | "site_installation_mgr"
        | "delivery_rm_lead"
        | "site_engineer"
        | "qc_inspector"
        | "factory_floor_supervisor"
        | "fabrication_foreman"
        | "electrical_installer"
        | "elec_plumbing_installer"
        | "procurement"
        | "stores_executive"
        | "accounts_executive"
        | "hr_executive"
        | "project_architect"
        | "structural_architect"
        | "managing_director"
        | "super_admin"
      login_type: "email" | "otp"
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
      app_role: [
        "finance_director",
        "sales_director",
        "architecture_director",
        "head_operations",
        "production_head",
        "finance_manager",
        "planning_engineer",
        "costing_engineer",
        "quantity_surveyor",
        "site_installation_mgr",
        "delivery_rm_lead",
        "site_engineer",
        "qc_inspector",
        "factory_floor_supervisor",
        "fabrication_foreman",
        "electrical_installer",
        "elec_plumbing_installer",
        "procurement",
        "stores_executive",
        "accounts_executive",
        "hr_executive",
        "project_architect",
        "structural_architect",
        "managing_director",
        "super_admin",
      ],
      login_type: ["email", "otp"],
    },
  },
} as const
