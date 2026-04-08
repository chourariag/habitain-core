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
      activity_dependencies: {
        Row: {
          created_at: string
          created_by: string
          id: string
          predecessor_module_id: string
          predecessor_stage: number
          successor_module_id: string
          successor_stage: number
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          predecessor_module_id: string
          predecessor_stage: number
          successor_module_id: string
          successor_stage: number
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          predecessor_module_id?: string
          predecessor_stage?: number
          successor_module_id?: string
          successor_stage?: number
        }
        Relationships: [
          {
            foreignKeyName: "activity_dependencies_predecessor_module_id_fkey"
            columns: ["predecessor_module_id"]
            isOneToOne: false
            referencedRelation: "modules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_dependencies_successor_module_id_fkey"
            columns: ["successor_module_id"]
            isOneToOne: false
            referencedRelation: "modules"
            referencedColumns: ["id"]
          },
        ]
      }
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
      advance_requests: {
        Row: {
          above_policy_amount: number | null
          advance_id: string | null
          amount: number
          approved_at: string | null
          approved_by: string | null
          bank_account_name: string | null
          bank_account_number: string | null
          carried_forward_amount: number | null
          carried_forward_date: string | null
          carry_forward_reminder_sent: boolean | null
          created_at: string | null
          days_on_site: number | null
          dispatch_date: string | null
          employee_id: string
          employee_name: string | null
          hod_approved_at: string | null
          hod_approved_by: string | null
          id: string
          is_emergency: boolean | null
          labour_count: number | null
          line_items: Json | null
          md_approved_at: string | null
          md_approved_by: string | null
          next_trip_expected_date: string | null
          payment_method: string | null
          project_id: string | null
          project_name: string | null
          purpose: string | null
          released_at: string | null
          released_by: string | null
          settled_amount: number | null
          settled_at: string | null
          settlement_method: string | null
          staff_count: number | null
          status: string
          total_amount: number | null
          transfer_reference: string | null
          updated_at: string | null
          within_policy_amount: number | null
        }
        Insert: {
          above_policy_amount?: number | null
          advance_id?: string | null
          amount?: number
          approved_at?: string | null
          approved_by?: string | null
          bank_account_name?: string | null
          bank_account_number?: string | null
          carried_forward_amount?: number | null
          carried_forward_date?: string | null
          carry_forward_reminder_sent?: boolean | null
          created_at?: string | null
          days_on_site?: number | null
          dispatch_date?: string | null
          employee_id: string
          employee_name?: string | null
          hod_approved_at?: string | null
          hod_approved_by?: string | null
          id?: string
          is_emergency?: boolean | null
          labour_count?: number | null
          line_items?: Json | null
          md_approved_at?: string | null
          md_approved_by?: string | null
          next_trip_expected_date?: string | null
          payment_method?: string | null
          project_id?: string | null
          project_name?: string | null
          purpose?: string | null
          released_at?: string | null
          released_by?: string | null
          settled_amount?: number | null
          settled_at?: string | null
          settlement_method?: string | null
          staff_count?: number | null
          status?: string
          total_amount?: number | null
          transfer_reference?: string | null
          updated_at?: string | null
          within_policy_amount?: number | null
        }
        Update: {
          above_policy_amount?: number | null
          advance_id?: string | null
          amount?: number
          approved_at?: string | null
          approved_by?: string | null
          bank_account_name?: string | null
          bank_account_number?: string | null
          carried_forward_amount?: number | null
          carried_forward_date?: string | null
          carry_forward_reminder_sent?: boolean | null
          created_at?: string | null
          days_on_site?: number | null
          dispatch_date?: string | null
          employee_id?: string
          employee_name?: string | null
          hod_approved_at?: string | null
          hod_approved_by?: string | null
          id?: string
          is_emergency?: boolean | null
          labour_count?: number | null
          line_items?: Json | null
          md_approved_at?: string | null
          md_approved_by?: string | null
          next_trip_expected_date?: string | null
          payment_method?: string | null
          project_id?: string | null
          project_name?: string | null
          purpose?: string | null
          released_at?: string | null
          released_by?: string | null
          settled_amount?: number | null
          settled_at?: string | null
          settlement_method?: string | null
          staff_count?: number | null
          status?: string
          total_amount?: number | null
          transfer_reference?: string | null
          updated_at?: string | null
          within_policy_amount?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "advance_requests_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      amc_contracts: {
        Row: {
          annual_fee: number
          client_name: string
          created_at: string
          created_by: string
          end_date: string
          id: string
          is_archived: boolean
          project_id: string
          start_date: string
          status: string
          tier: string
          updated_at: string
        }
        Insert: {
          annual_fee?: number
          client_name: string
          created_at?: string
          created_by: string
          end_date: string
          id?: string
          is_archived?: boolean
          project_id: string
          start_date: string
          status?: string
          tier?: string
          updated_at?: string
        }
        Update: {
          annual_fee?: number
          client_name?: string
          created_at?: string
          created_by?: string
          end_date?: string
          id?: string
          is_archived?: boolean
          project_id?: string
          start_date?: string
          status?: string
          tier?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "amc_contracts_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      announcements: {
        Row: {
          body: string
          created_at: string
          id: string
          is_archived: boolean
          pinned: boolean
          posted_at: string
          posted_by: string
          title: string
          updated_at: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          is_archived?: boolean
          pinned?: boolean
          posted_at?: string
          posted_by: string
          title: string
          updated_at?: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          is_archived?: boolean
          pinned?: boolean
          posted_at?: string
          posted_by?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      app_settings: {
        Row: {
          id: string
          key: string
          updated_at: string | null
          updated_by: string | null
          value: string | null
        }
        Insert: {
          id?: string
          key: string
          updated_at?: string | null
          updated_by?: string | null
          value?: string | null
        }
        Update: {
          id?: string
          key?: string
          updated_at?: string | null
          updated_by?: string | null
          value?: string | null
        }
        Relationships: []
      }
      asset_register: {
        Row: {
          actual_return_date: string | null
          asset_id: string
          asset_name: string
          assigned_project_id: string | null
          category: string
          condition: string
          created_at: string
          current_location: string
          dispatch_date: string | null
          expected_return_date: string | null
          id: string
          notes: string | null
          status: string
          updated_at: string
        }
        Insert: {
          actual_return_date?: string | null
          asset_id: string
          asset_name: string
          assigned_project_id?: string | null
          category?: string
          condition?: string
          created_at?: string
          current_location?: string
          dispatch_date?: string | null
          expected_return_date?: string | null
          id?: string
          notes?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          actual_return_date?: string | null
          asset_id?: string
          asset_name?: string
          assigned_project_id?: string | null
          category?: string
          condition?: string
          created_at?: string
          current_location?: string
          dispatch_date?: string | null
          expected_return_date?: string | null
          id?: string
          notes?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "asset_register_assigned_project_id_fkey"
            columns: ["assigned_project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      attendance_exports: {
        Row: {
          created_at: string | null
          generated_by: string | null
          id: string
          month: number
          sent_to_finance_at: string | null
          year: number
        }
        Insert: {
          created_at?: string | null
          generated_by?: string | null
          id?: string
          month: number
          sent_to_finance_at?: string | null
          year: number
        }
        Update: {
          created_at?: string | null
          generated_by?: string | null
          id?: string
          month?: number
          sent_to_finance_at?: string | null
          year?: number
        }
        Relationships: []
      }
      attendance_records: {
        Row: {
          check_in_time: string | null
          check_out_time: string | null
          created_at: string | null
          date: string
          gps_lat: number | null
          gps_lng: number | null
          gps_verified: boolean | null
          hours_worked: number | null
          id: string
          is_manual_override: boolean | null
          location_note: string | null
          location_type: string
          offline_captured: boolean | null
          override_reason: string | null
          project_id: string | null
          remote_reason: string | null
          synced_at: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          check_in_time?: string | null
          check_out_time?: string | null
          created_at?: string | null
          date?: string
          gps_lat?: number | null
          gps_lng?: number | null
          gps_verified?: boolean | null
          hours_worked?: number | null
          id?: string
          is_manual_override?: boolean | null
          location_note?: string | null
          location_type?: string
          offline_captured?: boolean | null
          override_reason?: string | null
          project_id?: string | null
          remote_reason?: string | null
          synced_at?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          check_in_time?: string | null
          check_out_time?: string | null
          created_at?: string | null
          date?: string
          gps_lat?: number | null
          gps_lng?: number | null
          gps_verified?: boolean | null
          hours_worked?: number | null
          id?: string
          is_manual_override?: boolean | null
          location_note?: string | null
          location_type?: string
          offline_captured?: boolean | null
          override_reason?: string | null
          project_id?: string | null
          remote_reason?: string | null
          synced_at?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendance_records_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      bank_ledger_entries: {
        Row: {
          balance: number | null
          credit: number | null
          debit: number | null
          entry_date: string
          id: string
          particulars: string
          upload_month: string | null
          uploaded_at: string | null
          uploaded_by: string | null
          vch_no: string | null
          vch_type: string | null
        }
        Insert: {
          balance?: number | null
          credit?: number | null
          debit?: number | null
          entry_date: string
          id?: string
          particulars: string
          upload_month?: string | null
          uploaded_at?: string | null
          uploaded_by?: string | null
          vch_no?: string | null
          vch_type?: string | null
        }
        Update: {
          balance?: number | null
          credit?: number | null
          debit?: number | null
          entry_date?: string
          id?: string
          particulars?: string
          upload_month?: string | null
          uploaded_at?: string | null
          uploaded_by?: string | null
          vch_no?: string | null
          vch_type?: string | null
        }
        Relationships: []
      }
      bay_assignments: {
        Row: {
          assigned_at: string | null
          assigned_by: string | null
          bay_number: number
          bay_type: string | null
          created_at: string | null
          id: string
          module_id: string
          move_reason: string | null
          moved_from: number | null
          project_id: string | null
          updated_at: string | null
        }
        Insert: {
          assigned_at?: string | null
          assigned_by?: string | null
          bay_number: number
          bay_type?: string | null
          created_at?: string | null
          id?: string
          module_id: string
          move_reason?: string | null
          moved_from?: number | null
          project_id?: string | null
          updated_at?: string | null
        }
        Update: {
          assigned_at?: string | null
          assigned_by?: string | null
          bay_number?: number
          bay_type?: string | null
          created_at?: string | null
          id?: string
          module_id?: string
          move_reason?: string | null
          moved_from?: number | null
          project_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bay_assignments_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      creditor_ledger_entries: {
        Row: {
          amount: number
          bill_date: string | null
          bill_no: string | null
          due_date: string | null
          id: string
          overdue_days: number | null
          party_name: string
          status: string | null
          uploaded_at: string | null
          uploaded_by: string | null
        }
        Insert: {
          amount: number
          bill_date?: string | null
          bill_no?: string | null
          due_date?: string | null
          id?: string
          overdue_days?: number | null
          party_name: string
          status?: string | null
          uploaded_at?: string | null
          uploaded_by?: string | null
        }
        Update: {
          amount?: number
          bill_date?: string | null
          bill_no?: string | null
          due_date?: string | null
          id?: string
          overdue_days?: number | null
          party_name?: string
          status?: string | null
          uploaded_at?: string | null
          uploaded_by?: string | null
        }
        Relationships: []
      }
      daily_actuals: {
        Row: {
          created_at: string | null
          date: string
          hours_worked: number | null
          id: string
          logged_by: string
          module_id: string | null
          pct_stage_completed: number | null
          project_id: string | null
          skill_type: string | null
          stage_task: string | null
          updated_at: string | null
          worker_id: string | null
        }
        Insert: {
          created_at?: string | null
          date: string
          hours_worked?: number | null
          id?: string
          logged_by: string
          module_id?: string | null
          pct_stage_completed?: number | null
          project_id?: string | null
          skill_type?: string | null
          stage_task?: string | null
          updated_at?: string | null
          worker_id?: string | null
        }
        Update: {
          created_at?: string | null
          date?: string
          hours_worked?: number | null
          id?: string
          logged_by?: string
          module_id?: string | null
          pct_stage_completed?: number | null
          project_id?: string | null
          skill_type?: string | null
          stage_task?: string | null
          updated_at?: string | null
          worker_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "daily_actuals_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_actuals_worker_id_fkey"
            columns: ["worker_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_production_logs: {
        Row: {
          ai_quality_checked: boolean | null
          created_at: string | null
          id: string
          issues_blockers: string | null
          log_date: string
          materials_used: string | null
          module_id: string
          photo_urls: string[]
          quality_issues: string[] | null
          quality_override: boolean | null
          review_comment: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          stage_progress: number
          stage_worked: string
          status: string
          submitted_by: string
          updated_at: string | null
          work_completed: string
        }
        Insert: {
          ai_quality_checked?: boolean | null
          created_at?: string | null
          id?: string
          issues_blockers?: string | null
          log_date?: string
          materials_used?: string | null
          module_id: string
          photo_urls?: string[]
          quality_issues?: string[] | null
          quality_override?: boolean | null
          review_comment?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          stage_progress?: number
          stage_worked: string
          status?: string
          submitted_by: string
          updated_at?: string | null
          work_completed: string
        }
        Update: {
          ai_quality_checked?: boolean | null
          created_at?: string | null
          id?: string
          issues_blockers?: string | null
          log_date?: string
          materials_used?: string | null
          module_id?: string
          photo_urls?: string[]
          quality_issues?: string[] | null
          quality_override?: boolean | null
          review_comment?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          stage_progress?: number
          stage_worked?: string
          status?: string
          submitted_by?: string
          updated_at?: string | null
          work_completed?: string
        }
        Relationships: [
          {
            foreignKeyName: "daily_production_logs_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "modules"
            referencedColumns: ["id"]
          },
        ]
      }
      debtor_ledger_entries: {
        Row: {
          amount: number
          bill_date: string | null
          bill_no: string | null
          due_date: string | null
          id: string
          overdue_days: number | null
          party_name: string
          status: string | null
          uploaded_at: string | null
          uploaded_by: string | null
        }
        Insert: {
          amount: number
          bill_date?: string | null
          bill_no?: string | null
          due_date?: string | null
          id?: string
          overdue_days?: number | null
          party_name: string
          status?: string | null
          uploaded_at?: string | null
          uploaded_by?: string | null
        }
        Update: {
          amount?: number
          bill_date?: string | null
          bill_no?: string | null
          due_date?: string | null
          id?: string
          overdue_days?: number | null
          party_name?: string
          status?: string | null
          uploaded_at?: string | null
          uploaded_by?: string | null
        }
        Relationships: []
      }
      delivery_checklists: {
        Row: {
          additional_materials: Json | null
          additional_signed_at: string | null
          additional_signed_by: string | null
          created_at: string | null
          dispatch_confirmed_at: string | null
          dispatch_confirmed_by: string | null
          id: string
          modules_checklist: Json | null
          modules_signed_at: string | null
          modules_signed_by: string | null
          project_id: string
          site_ready_confirmed_at: string | null
          status: string
          tools_checklist: Json | null
          tools_signed_at: string | null
          tools_signed_by: string | null
        }
        Insert: {
          additional_materials?: Json | null
          additional_signed_at?: string | null
          additional_signed_by?: string | null
          created_at?: string | null
          dispatch_confirmed_at?: string | null
          dispatch_confirmed_by?: string | null
          id?: string
          modules_checklist?: Json | null
          modules_signed_at?: string | null
          modules_signed_by?: string | null
          project_id: string
          site_ready_confirmed_at?: string | null
          status?: string
          tools_checklist?: Json | null
          tools_signed_at?: string | null
          tools_signed_by?: string | null
        }
        Update: {
          additional_materials?: Json | null
          additional_signed_at?: string | null
          additional_signed_by?: string | null
          created_at?: string | null
          dispatch_confirmed_at?: string | null
          dispatch_confirmed_by?: string | null
          id?: string
          modules_checklist?: Json | null
          modules_signed_at?: string | null
          modules_signed_by?: string | null
          project_id?: string
          site_ready_confirmed_at?: string | null
          status?: string
          tools_checklist?: Json | null
          tools_signed_at?: string | null
          tools_signed_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "delivery_checklists_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      design_consultants: {
        Row: {
          approved: boolean
          brief_issued_at: string | null
          consultant_type: string
          created_at: string
          drawings_uploaded: boolean
          email: string | null
          firm: string | null
          id: string
          name: string
          phone: string | null
          project_id: string
          review_complete: boolean
          revisions_text: string | null
          status: string
          updated_at: string
        }
        Insert: {
          approved?: boolean
          brief_issued_at?: string | null
          consultant_type?: string
          created_at?: string
          drawings_uploaded?: boolean
          email?: string | null
          firm?: string | null
          id?: string
          name: string
          phone?: string | null
          project_id: string
          review_complete?: boolean
          revisions_text?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          approved?: boolean
          brief_issued_at?: string | null
          consultant_type?: string
          created_at?: string
          drawings_uploaded?: boolean
          email?: string | null
          firm?: string | null
          id?: string
          name?: string
          phone?: string | null
          project_id?: string
          review_complete?: boolean
          revisions_text?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "design_consultants_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      design_detail_library: {
        Row: {
          detail_name: string
          detail_number: number
          drawing_reference: string | null
          file_url: string | null
          id: string
          project_id: string
          status: string
          updated_at: string
          updated_by: string | null
          uploaded_by_name: string | null
        }
        Insert: {
          detail_name: string
          detail_number: number
          drawing_reference?: string | null
          file_url?: string | null
          id?: string
          project_id: string
          status?: string
          updated_at?: string
          updated_by?: string | null
          uploaded_by_name?: string | null
        }
        Update: {
          detail_name?: string
          detail_number?: number
          drawing_reference?: string | null
          file_url?: string | null
          id?: string
          project_id?: string
          status?: string
          updated_at?: string
          updated_by?: string | null
          uploaded_by_name?: string | null
        }
        Relationships: []
      }
      design_qc_checklist: {
        Row: {
          created_at: string
          id: string
          is_ticked: boolean
          item_index: number
          item_text: string
          note: string | null
          project_id: string
          section_name: string
          section_number: number
          ticked_at: string | null
          ticked_by: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_ticked?: boolean
          item_index: number
          item_text: string
          note?: string | null
          project_id: string
          section_name: string
          section_number: number
          ticked_at?: string | null
          ticked_by?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_ticked?: boolean
          item_index?: number
          item_text?: string
          note?: string | null
          project_id?: string
          section_name?: string
          section_number?: number
          ticked_at?: string | null
          ticked_by?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      design_qc_section_signoffs: {
        Row: {
          id: string
          project_id: string
          section_number: number
          signed_at: string
          signed_by: string
          signed_by_name: string | null
          signed_by_role: string | null
        }
        Insert: {
          id?: string
          project_id: string
          section_number: number
          signed_at?: string
          signed_by: string
          signed_by_name?: string | null
          signed_by_role?: string | null
        }
        Update: {
          id?: string
          project_id?: string
          section_number?: number
          signed_at?: string
          signed_by?: string
          signed_by_name?: string | null
          signed_by_role?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "design_qc_section_signoffs_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      design_queries: {
        Row: {
          affected_area: string | null
          assigned_architect_id: string | null
          created_at: string
          description: string
          dq_category: string | null
          dq_code: string
          drawing_id: string | null
          id: string
          is_archived: boolean
          module_id: string | null
          photo_url: string | null
          project_id: string
          query_type: string
          raised_by: string
          raised_by_name: string | null
          resolution_reminder_sent: boolean | null
          resolution_timeline: string | null
          resolved_at: string | null
          responded_at: string | null
          responded_by: string | null
          responded_by_name: string | null
          response_drawing_id: string | null
          response_text: string | null
          status: string
          updated_at: string
          urgency: string
          voice_note_url: string | null
        }
        Insert: {
          affected_area?: string | null
          assigned_architect_id?: string | null
          created_at?: string
          description: string
          dq_category?: string | null
          dq_code: string
          drawing_id?: string | null
          id?: string
          is_archived?: boolean
          module_id?: string | null
          photo_url?: string | null
          project_id: string
          query_type?: string
          raised_by: string
          raised_by_name?: string | null
          resolution_reminder_sent?: boolean | null
          resolution_timeline?: string | null
          resolved_at?: string | null
          responded_at?: string | null
          responded_by?: string | null
          responded_by_name?: string | null
          response_drawing_id?: string | null
          response_text?: string | null
          status?: string
          updated_at?: string
          urgency?: string
          voice_note_url?: string | null
        }
        Update: {
          affected_area?: string | null
          assigned_architect_id?: string | null
          created_at?: string
          description?: string
          dq_category?: string | null
          dq_code?: string
          drawing_id?: string | null
          id?: string
          is_archived?: boolean
          module_id?: string | null
          photo_url?: string | null
          project_id?: string
          query_type?: string
          raised_by?: string
          raised_by_name?: string | null
          resolution_reminder_sent?: boolean | null
          resolution_timeline?: string | null
          resolved_at?: string | null
          responded_at?: string | null
          responded_by?: string | null
          responded_by_name?: string | null
          response_drawing_id?: string | null
          response_text?: string | null
          status?: string
          updated_at?: string
          urgency?: string
          voice_note_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "design_queries_drawing_id_fkey"
            columns: ["drawing_id"]
            isOneToOne: false
            referencedRelation: "drawings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "design_queries_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "modules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "design_queries_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "design_queries_response_drawing_id_fkey"
            columns: ["response_drawing_id"]
            isOneToOne: false
            referencedRelation: "drawings"
            referencedColumns: ["id"]
          },
        ]
      }
      design_stages: {
        Row: {
          approval_date: string | null
          approval_method: string | null
          approval_proof_url: string | null
          created_at: string
          drawing_urls: string[]
          evidence_uploaded_at: string | null
          evidence_url: string | null
          id: string
          project_id: string
          revision_changes: string | null
          revision_comments: string | null
          stage_name: string
          stage_order: number
          status: string
          ticked_at: string | null
          ticked_by: string | null
          updated_at: string
        }
        Insert: {
          approval_date?: string | null
          approval_method?: string | null
          approval_proof_url?: string | null
          created_at?: string
          drawing_urls?: string[]
          evidence_uploaded_at?: string | null
          evidence_url?: string | null
          id?: string
          project_id: string
          revision_changes?: string | null
          revision_comments?: string | null
          stage_name: string
          stage_order: number
          status?: string
          ticked_at?: string | null
          ticked_by?: string | null
          updated_at?: string
        }
        Update: {
          approval_date?: string | null
          approval_method?: string | null
          approval_proof_url?: string | null
          created_at?: string
          drawing_urls?: string[]
          evidence_uploaded_at?: string | null
          evidence_url?: string | null
          id?: string
          project_id?: string
          revision_changes?: string | null
          revision_comments?: string | null
          stage_name?: string
          stage_order?: number
          status?: string
          ticked_at?: string | null
          ticked_by?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "design_stages_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
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
      dispatch_material_log: {
        Row: {
          created_at: string
          dispatch_pack_id: string
          id: string
          material_name: string
          note: string | null
          project_id: string
          qty_dispatched: number
          unit: string | null
        }
        Insert: {
          created_at?: string
          dispatch_pack_id: string
          id?: string
          material_name: string
          note?: string | null
          project_id: string
          qty_dispatched: number
          unit?: string | null
        }
        Update: {
          created_at?: string
          dispatch_pack_id?: string
          id?: string
          material_name?: string
          note?: string | null
          project_id?: string
          qty_dispatched?: number
          unit?: string | null
        }
        Relationships: []
      }
      dispatch_packs: {
        Row: {
          created_at: string
          created_by: string | null
          dispatch_date: string
          dispatch_pack_id: string
          driver_name: string | null
          driver_phone: string | null
          id: string
          loading_checklist_complete: boolean | null
          notes: string | null
          project_id: string
          site_installation_manager_id: string | null
          status: string
          supervisor_accompanying: boolean | null
          team_member_ids: string[] | null
          transporter_name: string | null
          vehicle_number: string | null
          vehicle_type: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          dispatch_date?: string
          dispatch_pack_id: string
          driver_name?: string | null
          driver_phone?: string | null
          id?: string
          loading_checklist_complete?: boolean | null
          notes?: string | null
          project_id: string
          site_installation_manager_id?: string | null
          status?: string
          supervisor_accompanying?: boolean | null
          team_member_ids?: string[] | null
          transporter_name?: string | null
          vehicle_number?: string | null
          vehicle_type?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          dispatch_date?: string
          dispatch_pack_id?: string
          driver_name?: string | null
          driver_phone?: string | null
          id?: string
          loading_checklist_complete?: boolean | null
          notes?: string | null
          project_id?: string
          site_installation_manager_id?: string | null
          status?: string
          supervisor_accompanying?: boolean | null
          team_member_ids?: string[] | null
          transporter_name?: string | null
          vehicle_number?: string | null
          vehicle_type?: string | null
        }
        Relationships: []
      }
      dispatch_signoffs: {
        Row: {
          id: string
          module_id: string
          notes: string | null
          signed_at: string | null
          signed_by: string
        }
        Insert: {
          id?: string
          module_id: string
          notes?: string | null
          signed_at?: string | null
          signed_by: string
        }
        Update: {
          id?: string
          module_id?: string
          notes?: string | null
          signed_at?: string | null
          signed_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "dispatch_signoffs_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: true
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
      drawings: {
        Row: {
          approval_date: string | null
          approval_method: string | null
          approval_reference: string | null
          approval_screenshot_url: string | null
          approval_status: string
          approved_at: string | null
          approved_by: string | null
          approved_by_name: string | null
          category_tags: string[] | null
          created_at: string
          drawing_id_code: string
          drawing_title: string | null
          drawing_type: string
          file_format: string | null
          file_name: string | null
          file_url: string
          id: string
          is_archived: boolean
          module_id: string | null
          notes: string | null
          project_id: string
          reviewed_at: string | null
          reviewed_by_ids: string[] | null
          revision: number
          revision_reason: string | null
          status: string
          updated_at: string
          uploaded_by: string
          uploaded_by_name: string | null
        }
        Insert: {
          approval_date?: string | null
          approval_method?: string | null
          approval_reference?: string | null
          approval_screenshot_url?: string | null
          approval_status?: string
          approved_at?: string | null
          approved_by?: string | null
          approved_by_name?: string | null
          category_tags?: string[] | null
          created_at?: string
          drawing_id_code: string
          drawing_title?: string | null
          drawing_type?: string
          file_format?: string | null
          file_name?: string | null
          file_url: string
          id?: string
          is_archived?: boolean
          module_id?: string | null
          notes?: string | null
          project_id: string
          reviewed_at?: string | null
          reviewed_by_ids?: string[] | null
          revision?: number
          revision_reason?: string | null
          status?: string
          updated_at?: string
          uploaded_by: string
          uploaded_by_name?: string | null
        }
        Update: {
          approval_date?: string | null
          approval_method?: string | null
          approval_reference?: string | null
          approval_screenshot_url?: string | null
          approval_status?: string
          approved_at?: string | null
          approved_by?: string | null
          approved_by_name?: string | null
          category_tags?: string[] | null
          created_at?: string
          drawing_id_code?: string
          drawing_title?: string | null
          drawing_type?: string
          file_format?: string | null
          file_name?: string | null
          file_url?: string
          id?: string
          is_archived?: boolean
          module_id?: string | null
          notes?: string | null
          project_id?: string
          reviewed_at?: string | null
          reviewed_by_ids?: string[] | null
          revision?: number
          revision_reason?: string | null
          status?: string
          updated_at?: string
          uploaded_by?: string
          uploaded_by_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "drawings_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "modules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "drawings_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      expense_entries: {
        Row: {
          amount: number
          budget_flag: boolean | null
          category: string | null
          created_at: string | null
          description: string | null
          distance_km: number | null
          entry_date: string
          expense_type: string
          finance_paid_at: string | null
          finance_paid_by: string | null
          from_location: string | null
          hod_approved_at: string | null
          hod_approved_by: string | null
          hr_flag_note: string | null
          hr_flag_response: string | null
          hr_reviewed_at: string | null
          hr_reviewed_by: string | null
          id: string
          project_id: string | null
          rate_per_km: number | null
          rate_used: number | null
          receipt_url: string | null
          rejection_reason: string | null
          report_period: string | null
          status: string
          submission_method: string
          submitted_by: string
          to_location: string | null
          updated_at: string | null
          uploaded_on_behalf_of: string | null
          vehicle_type: string | null
        }
        Insert: {
          amount?: number
          budget_flag?: boolean | null
          category?: string | null
          created_at?: string | null
          description?: string | null
          distance_km?: number | null
          entry_date?: string
          expense_type?: string
          finance_paid_at?: string | null
          finance_paid_by?: string | null
          from_location?: string | null
          hod_approved_at?: string | null
          hod_approved_by?: string | null
          hr_flag_note?: string | null
          hr_flag_response?: string | null
          hr_reviewed_at?: string | null
          hr_reviewed_by?: string | null
          id?: string
          project_id?: string | null
          rate_per_km?: number | null
          rate_used?: number | null
          receipt_url?: string | null
          rejection_reason?: string | null
          report_period?: string | null
          status?: string
          submission_method?: string
          submitted_by: string
          to_location?: string | null
          updated_at?: string | null
          uploaded_on_behalf_of?: string | null
          vehicle_type?: string | null
        }
        Update: {
          amount?: number
          budget_flag?: boolean | null
          category?: string | null
          created_at?: string | null
          description?: string | null
          distance_km?: number | null
          entry_date?: string
          expense_type?: string
          finance_paid_at?: string | null
          finance_paid_by?: string | null
          from_location?: string | null
          hod_approved_at?: string | null
          hod_approved_by?: string | null
          hr_flag_note?: string | null
          hr_flag_response?: string | null
          hr_reviewed_at?: string | null
          hr_reviewed_by?: string | null
          id?: string
          project_id?: string | null
          rate_per_km?: number | null
          rate_used?: number | null
          receipt_url?: string | null
          rejection_reason?: string | null
          report_period?: string | null
          status?: string
          submission_method?: string
          submitted_by?: string
          to_location?: string | null
          updated_at?: string | null
          uploaded_on_behalf_of?: string | null
          vehicle_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "expense_entries_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      expense_reports: {
        Row: {
          amount: number
          budget_flag: boolean | null
          budget_overrun_amount: number | null
          category: string
          created_at: string | null
          description: string
          expense_date: string
          id: string
          processed_at: string | null
          processed_by: string | null
          project_id: string | null
          receipt_url: string | null
          rejection_reason: string | null
          stage1_approved_at: string | null
          stage1_approved_by: string | null
          stage1_note: string | null
          stage2_approved_at: string | null
          stage2_approved_by: string | null
          status: string
          submitted_by: string
          updated_at: string | null
        }
        Insert: {
          amount: number
          budget_flag?: boolean | null
          budget_overrun_amount?: number | null
          category: string
          created_at?: string | null
          description: string
          expense_date?: string
          id?: string
          processed_at?: string | null
          processed_by?: string | null
          project_id?: string | null
          receipt_url?: string | null
          rejection_reason?: string | null
          stage1_approved_at?: string | null
          stage1_approved_by?: string | null
          stage1_note?: string | null
          stage2_approved_at?: string | null
          stage2_approved_by?: string | null
          status?: string
          submitted_by: string
          updated_at?: string | null
        }
        Update: {
          amount?: number
          budget_flag?: boolean | null
          budget_overrun_amount?: number | null
          category?: string
          created_at?: string | null
          description?: string
          expense_date?: string
          id?: string
          processed_at?: string | null
          processed_by?: string | null
          project_id?: string | null
          receipt_url?: string | null
          rejection_reason?: string | null
          stage1_approved_at?: string | null
          stage1_approved_by?: string | null
          stage1_note?: string | null
          stage2_approved_at?: string | null
          stage2_approved_by?: string | null
          status?: string
          submitted_by?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "expense_reports_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      finance_cashflow: {
        Row: {
          amount: number
          category: string
          created_at: string
          description: string | null
          entered_by: string | null
          entry_date: string
          id: string
          project_name: string | null
          type: string
        }
        Insert: {
          amount?: number
          category?: string
          created_at?: string
          description?: string | null
          entered_by?: string | null
          entry_date?: string
          id?: string
          project_name?: string | null
          type?: string
        }
        Update: {
          amount?: number
          category?: string
          created_at?: string
          description?: string | null
          entered_by?: string | null
          entry_date?: string
          id?: string
          project_name?: string | null
          type?: string
        }
        Relationships: []
      }
      finance_cashflow_balances: {
        Row: {
          id: string
          month: number
          opening_balance: number
          updated_at: string
          updated_by: string | null
          year: number
        }
        Insert: {
          id?: string
          month: number
          opening_balance?: number
          updated_at?: string
          updated_by?: string | null
          year: number
        }
        Update: {
          id?: string
          month?: number
          opening_balance?: number
          updated_at?: string
          updated_by?: string | null
          year?: number
        }
        Relationships: []
      }
      finance_mis_uploads: {
        Row: {
          ads_split: Json | null
          created_at: string
          id: string
          period_label: string
          raw_data: Json
          upload_date: string
          uploaded_by: string
        }
        Insert: {
          ads_split?: Json | null
          created_at?: string
          id?: string
          period_label: string
          raw_data?: Json
          upload_date?: string
          uploaded_by: string
        }
        Update: {
          ads_split?: Json | null
          created_at?: string
          id?: string
          period_label?: string
          raw_data?: Json
          upload_date?: string
          uploaded_by?: string
        }
        Relationships: []
      }
      finance_payments: {
        Row: {
          amount: number
          client_name: string
          created_at: string
          due_date: string
          entered_by: string | null
          id: string
          milestone_description: string
          project_name: string
          status: string
          updated_at: string
        }
        Insert: {
          amount?: number
          client_name: string
          created_at?: string
          due_date: string
          entered_by?: string | null
          id?: string
          milestone_description: string
          project_name: string
          status?: string
          updated_at?: string
        }
        Update: {
          amount?: number
          client_name?: string
          created_at?: string
          due_date?: string
          entered_by?: string | null
          id?: string
          milestone_description?: string
          project_name?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      finance_pl_data: {
        Row: {
          created_at: string
          depreciation: number | null
          id: string
          labour: number | null
          logistics: number | null
          marketing: number | null
          materials: number | null
          month: number
          office_admin: number | null
          other_cogs: number | null
          other_opex: number | null
          revenue: number | null
          rm_costs: number | null
          updated_at: string
          uploaded_by: string | null
          year: number
        }
        Insert: {
          created_at?: string
          depreciation?: number | null
          id?: string
          labour?: number | null
          logistics?: number | null
          marketing?: number | null
          materials?: number | null
          month: number
          office_admin?: number | null
          other_cogs?: number | null
          other_opex?: number | null
          revenue?: number | null
          rm_costs?: number | null
          updated_at?: string
          uploaded_by?: string | null
          year: number
        }
        Update: {
          created_at?: string
          depreciation?: number | null
          id?: string
          labour?: number | null
          logistics?: number | null
          marketing?: number | null
          materials?: number | null
          month?: number
          office_admin?: number | null
          other_cogs?: number | null
          other_opex?: number | null
          revenue?: number | null
          rm_costs?: number | null
          updated_at?: string
          uploaded_by?: string | null
          year?: number
        }
        Relationships: []
      }
      finance_project_budgets: {
        Row: {
          created_at: string
          id: string
          labour_budget: number | null
          logistics_budget: number | null
          misc_budget: number | null
          project_id: string | null
          project_name: string
          sanctioned_budget: number | null
          updated_at: string
          uploaded_by: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          labour_budget?: number | null
          logistics_budget?: number | null
          misc_budget?: number | null
          project_id?: string | null
          project_name: string
          sanctioned_budget?: number | null
          updated_at?: string
          uploaded_by?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          labour_budget?: number | null
          logistics_budget?: number | null
          misc_budget?: number | null
          project_id?: string | null
          project_name?: string
          sanctioned_budget?: number | null
          updated_at?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "finance_project_budgets_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      finance_project_cashflow: {
        Row: {
          created_at: string
          id: string
          inflow_advance: number | null
          inflow_client_payment: number | null
          inflow_other: number | null
          inflow_retention: number | null
          month: number
          notes: string | null
          outflow_admin: number | null
          outflow_labour: number | null
          outflow_logistics: number | null
          outflow_materials: number | null
          outflow_other: number | null
          outflow_subcontract: number | null
          project_name: string
          uploaded_by: string | null
          year: number
        }
        Insert: {
          created_at?: string
          id?: string
          inflow_advance?: number | null
          inflow_client_payment?: number | null
          inflow_other?: number | null
          inflow_retention?: number | null
          month: number
          notes?: string | null
          outflow_admin?: number | null
          outflow_labour?: number | null
          outflow_logistics?: number | null
          outflow_materials?: number | null
          outflow_other?: number | null
          outflow_subcontract?: number | null
          project_name: string
          uploaded_by?: string | null
          year: number
        }
        Update: {
          created_at?: string
          id?: string
          inflow_advance?: number | null
          inflow_client_payment?: number | null
          inflow_other?: number | null
          inflow_retention?: number | null
          month?: number
          notes?: string | null
          outflow_admin?: number | null
          outflow_labour?: number | null
          outflow_logistics?: number | null
          outflow_materials?: number | null
          outflow_other?: number | null
          outflow_subcontract?: number | null
          project_name?: string
          uploaded_by?: string | null
          year?: number
        }
        Relationships: []
      }
      finance_statutory: {
        Row: {
          created_at: string
          due_date: string
          filing_type: string
          id: string
          is_recurring: boolean | null
          notes: string | null
          recipient_roles: string[] | null
          recurrence_rule: string | null
          reminder_days: number | null
          status: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          due_date: string
          filing_type: string
          id?: string
          is_recurring?: boolean | null
          notes?: string | null
          recipient_roles?: string[] | null
          recurrence_rule?: string | null
          reminder_days?: number | null
          status?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          due_date?: string
          filing_type?: string
          id?: string
          is_recurring?: boolean | null
          notes?: string | null
          recipient_roles?: string[] | null
          recurrence_rule?: string | null
          reminder_days?: number | null
          status?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      gfc_records: {
        Row: {
          created_at: string | null
          gfc_stage: string
          id: string
          issued_at: string | null
          issued_by: string | null
          module_group: string[] | null
          notes: string | null
          pdf_url: string | null
          project_id: string
          sections_complete: number | null
          sections_total: number | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          gfc_stage: string
          id?: string
          issued_at?: string | null
          issued_by?: string | null
          module_group?: string[] | null
          notes?: string | null
          pdf_url?: string | null
          project_id: string
          sections_complete?: number | null
          sections_total?: number | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          gfc_stage?: string
          id?: string
          issued_at?: string | null
          issued_by?: string | null
          module_group?: string[] | null
          notes?: string | null
          pdf_url?: string | null
          project_id?: string
          sections_complete?: number | null
          sections_total?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "gfc_records_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
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
      hr_settings: {
        Row: {
          approval1_at: string | null
          approval1_by: string | null
          approval2_at: string | null
          approval2_by: string | null
          effective_date: string | null
          id: string
          key: string
          proposed_by: string | null
          proposed_value: string | null
          status: string
          updated_at: string | null
          value: string | null
        }
        Insert: {
          approval1_at?: string | null
          approval1_by?: string | null
          approval2_at?: string | null
          approval2_by?: string | null
          effective_date?: string | null
          id?: string
          key: string
          proposed_by?: string | null
          proposed_value?: string | null
          status?: string
          updated_at?: string | null
          value?: string | null
        }
        Update: {
          approval1_at?: string | null
          approval1_by?: string | null
          approval2_at?: string | null
          approval2_by?: string | null
          effective_date?: string | null
          id?: string
          key?: string
          proposed_by?: string | null
          proposed_value?: string | null
          status?: string
          updated_at?: string | null
          value?: string | null
        }
        Relationships: []
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
          delivery_destination: string
          id: string
          is_archived: boolean
          material_name: string
          project_id: string | null
          received_by_on_site: string | null
          reorder_level: number
          site_receipt_notes: string | null
          unit: string
          updated_at: string
        }
        Insert: {
          category: string
          created_at?: string
          created_by?: string | null
          current_stock?: number
          delivery_destination?: string
          id?: string
          is_archived?: boolean
          material_name: string
          project_id?: string | null
          received_by_on_site?: string | null
          reorder_level?: number
          site_receipt_notes?: string | null
          unit?: string
          updated_at?: string
        }
        Update: {
          category?: string
          created_at?: string
          created_by?: string | null
          current_stock?: number
          delivery_destination?: string
          id?: string
          is_archived?: boolean
          material_name?: string
          project_id?: string | null
          received_by_on_site?: string | null
          reorder_level?: number
          site_receipt_notes?: string | null
          unit?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_items_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_payments: {
        Row: {
          amount_received: number
          created_at: string
          id: string
          invoice_id: string
          payment_date: string
          payment_reference: string | null
          recorded_by: string
        }
        Insert: {
          amount_received?: number
          created_at?: string
          id?: string
          invoice_id: string
          payment_date?: string
          payment_reference?: string | null
          recorded_by: string
        }
        Update: {
          amount_received?: number
          created_at?: string
          id?: string
          invoice_id?: string
          payment_date?: string
          payment_reference?: string | null
          recorded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoice_payments_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "project_invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_variations: {
        Row: {
          approved_date: string | null
          client_approval_ref: string | null
          contribution_margin_pct: number | null
          created_at: string
          created_by: string
          description: string
          id: string
          invoice_id: string
          value: number
        }
        Insert: {
          approved_date?: string | null
          client_approval_ref?: string | null
          contribution_margin_pct?: number | null
          created_at?: string
          created_by: string
          description: string
          id?: string
          invoice_id: string
          value?: number
        }
        Update: {
          approved_date?: string | null
          client_approval_ref?: string | null
          contribution_margin_pct?: number | null
          created_at?: string
          created_by?: string
          description?: string
          id?: string
          invoice_id?: string
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "invoice_variations_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "project_invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      kpi_definitions: {
        Row: {
          coaching_template_above: string | null
          coaching_template_below: string | null
          created_at: string
          data_source_query: string | null
          data_source_table: string | null
          effective_from: string | null
          id: string
          is_active: boolean
          kpi_key: string
          kpi_name: string
          measurement_period: string
          role: Database["public"]["Enums"]["app_role"]
          target_value: number | null
          unit: string
          updated_at: string
        }
        Insert: {
          coaching_template_above?: string | null
          coaching_template_below?: string | null
          created_at?: string
          data_source_query?: string | null
          data_source_table?: string | null
          effective_from?: string | null
          id?: string
          is_active?: boolean
          kpi_key: string
          kpi_name: string
          measurement_period?: string
          role: Database["public"]["Enums"]["app_role"]
          target_value?: number | null
          unit?: string
          updated_at?: string
        }
        Update: {
          coaching_template_above?: string | null
          coaching_template_below?: string | null
          created_at?: string
          data_source_query?: string | null
          data_source_table?: string | null
          effective_from?: string | null
          id?: string
          is_active?: boolean
          kpi_key?: string
          kpi_name?: string
          measurement_period?: string
          role?: Database["public"]["Enums"]["app_role"]
          target_value?: number | null
          unit?: string
          updated_at?: string
        }
        Relationships: []
      }
      kpi_snapshots: {
        Row: {
          actual_value: number | null
          created_at: string
          id: string
          kpi_key: string
          score: number | null
          status: string
          target_value: number | null
          user_id: string
          week_start_date: string
        }
        Insert: {
          actual_value?: number | null
          created_at?: string
          id?: string
          kpi_key: string
          score?: number | null
          status?: string
          target_value?: number | null
          user_id: string
          week_start_date: string
        }
        Update: {
          actual_value?: number | null
          created_at?: string
          id?: string
          kpi_key?: string
          score?: number | null
          status?: string
          target_value?: number | null
          user_id?: string
          week_start_date?: string
        }
        Relationships: []
      }
      kpi_targets_history: {
        Row: {
          changed_at: string
          changed_by: string
          id: string
          kpi_key: string
          new_target: number | null
          old_target: number | null
          reason: string | null
          role: Database["public"]["Enums"]["app_role"]
        }
        Insert: {
          changed_at?: string
          changed_by: string
          id?: string
          kpi_key: string
          new_target?: number | null
          old_target?: number | null
          reason?: string | null
          role: Database["public"]["Enums"]["app_role"]
        }
        Update: {
          changed_at?: string
          changed_by?: string
          id?: string
          kpi_key?: string
          new_target?: number | null
          old_target?: number | null
          reason?: string | null
          role?: Database["public"]["Enums"]["app_role"]
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
      leave_requests: {
        Row: {
          approved_by: string | null
          days_count: number
          from_date: string
          id: string
          leave_type: string
          reason: string
          rejection_reason: string | null
          requested_at: string | null
          status: string
          to_date: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          approved_by?: string | null
          days_count?: number
          from_date: string
          id?: string
          leave_type?: string
          reason: string
          rejection_reason?: string | null
          requested_at?: string | null
          status?: string
          to_date: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          approved_by?: string | null
          days_count?: number
          from_date?: string
          id?: string
          leave_type?: string
          reason?: string
          rejection_reason?: string | null
          requested_at?: string | null
          status?: string
          to_date?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      ledger_mappings: {
        Row: {
          created_at: string
          id: string
          ledger_name: string
          mis_category: string
        }
        Insert: {
          created_at?: string
          id?: string
          ledger_name: string
          mis_category: string
        }
        Update: {
          created_at?: string
          id?: string
          ledger_name?: string
          mis_category?: string
        }
        Relationships: []
      }
      material_availability_confirmations: {
        Row: {
          confirmed_at: string | null
          confirmed_by: string | null
          created_at: string
          id: string
          materials_confirmed: string | null
          materials_missing: string | null
          missing_eta: string | null
          module_id: string
          project_id: string | null
          stage_number: number
          stage_start_date: string
          status: string
          updated_at: string
        }
        Insert: {
          confirmed_at?: string | null
          confirmed_by?: string | null
          created_at?: string
          id?: string
          materials_confirmed?: string | null
          materials_missing?: string | null
          missing_eta?: string | null
          module_id: string
          project_id?: string | null
          stage_number: number
          stage_start_date: string
          status?: string
          updated_at?: string
        }
        Update: {
          confirmed_at?: string | null
          confirmed_by?: string | null
          created_at?: string
          id?: string
          materials_confirmed?: string | null
          materials_missing?: string | null
          missing_eta?: string | null
          module_id?: string
          project_id?: string | null
          stage_number?: number
          stage_start_date?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "material_availability_confirmations_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      material_plan_items: {
        Row: {
          category: string
          created_at: string | null
          created_by: string | null
          id: string
          lead_time_days: number
          material_name: string
          project_id: string
          quantity: number
          required_by: string | null
          status: string
          supplier: string | null
          unit: string
          updated_at: string | null
        }
        Insert: {
          category?: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          lead_time_days?: number
          material_name: string
          project_id: string
          quantity?: number
          required_by?: string | null
          status?: string
          supplier?: string | null
          unit?: string
          updated_at?: string | null
        }
        Update: {
          category?: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          lead_time_days?: number
          material_name?: string
          project_id?: string
          quantity?: number
          required_by?: string | null
          status?: string
          supplier?: string | null
          unit?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "material_plan_items_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
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
      material_returns: {
        Row: {
          confirmed_at: string | null
          confirmed_by: string | null
          created_at: string
          id: string
          initiated_at: string
          initiated_by: string | null
          items: Json
          project_id: string
          status: string
          updated_at: string
        }
        Insert: {
          confirmed_at?: string | null
          confirmed_by?: string | null
          created_at?: string
          id?: string
          initiated_at?: string
          initiated_by?: string | null
          items?: Json
          project_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          confirmed_at?: string | null
          confirmed_by?: string | null
          created_at?: string
          id?: string
          initiated_at?: string
          initiated_by?: string | null
          items?: Json
          project_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "material_returns_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      module_schedule: {
        Row: {
          actual_end: string | null
          actual_start: string | null
          created_at: string | null
          created_by: string | null
          id: string
          module_id: string
          stage_name: string
          target_end: string | null
          target_start: string | null
          updated_at: string | null
        }
        Insert: {
          actual_end?: string | null
          actual_start?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          module_id: string
          stage_name: string
          target_end?: string | null
          target_start?: string | null
          updated_at?: string | null
        }
        Update: {
          actual_end?: string | null
          actual_start?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          module_id?: string
          stage_name?: string
          target_end?: string | null
          target_start?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "module_schedule_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "modules"
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
          assigned_to: string | null
          checklist_item_id: string | null
          closed_at: string | null
          closed_by: string | null
          created_at: string | null
          fix_timeline: string | null
          fix_timeline_due_date: string | null
          fix_timeline_set_at: string | null
          fix_timeline_set_by: string | null
          id: string
          inspection_id: string | null
          is_archived: boolean | null
          ncr_number: string
          raised_by: string | null
          reinspection_completed_at: string | null
          reinspection_completed_by: string | null
          reinspection_failed: boolean | null
          reinspection_notes: string | null
          reinspection_photo_url: string | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          assigned_to?: string | null
          checklist_item_id?: string | null
          closed_at?: string | null
          closed_by?: string | null
          created_at?: string | null
          fix_timeline?: string | null
          fix_timeline_due_date?: string | null
          fix_timeline_set_at?: string | null
          fix_timeline_set_by?: string | null
          id?: string
          inspection_id?: string | null
          is_archived?: boolean | null
          ncr_number: string
          raised_by?: string | null
          reinspection_completed_at?: string | null
          reinspection_completed_by?: string | null
          reinspection_failed?: boolean | null
          reinspection_notes?: string | null
          reinspection_photo_url?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          assigned_to?: string | null
          checklist_item_id?: string | null
          closed_at?: string | null
          closed_by?: string | null
          created_at?: string | null
          fix_timeline?: string | null
          fix_timeline_due_date?: string | null
          fix_timeline_set_at?: string | null
          fix_timeline_set_by?: string | null
          id?: string
          inspection_id?: string | null
          is_archived?: boolean | null
          ncr_number?: string
          raised_by?: string | null
          reinspection_completed_at?: string | null
          reinspection_completed_by?: string | null
          reinspection_failed?: boolean | null
          reinspection_notes?: string | null
          reinspection_photo_url?: string | null
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
          body: string
          category: string
          content: string
          created_at: string | null
          id: string
          is_read: boolean
          linked_entity_id: string | null
          linked_entity_type: string | null
          navigate_to: string | null
          read_at: string | null
          recipient_id: string
          related_id: string | null
          related_table: string | null
          title: string
          type: string
        }
        Insert: {
          body: string
          category: string
          content: string
          created_at?: string | null
          id?: string
          is_read?: boolean
          linked_entity_id?: string | null
          linked_entity_type?: string | null
          navigate_to?: string | null
          read_at?: string | null
          recipient_id: string
          related_id?: string | null
          related_table?: string | null
          title: string
          type: string
        }
        Update: {
          body?: string
          category?: string
          content?: string
          created_at?: string | null
          id?: string
          is_read?: boolean
          linked_entity_id?: string | null
          linked_entity_type?: string | null
          navigate_to?: string | null
          read_at?: string | null
          recipient_id?: string
          related_id?: string | null
          related_table?: string | null
          title?: string
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
      payment_approvals: {
        Row: {
          amount: number
          approved_at: string | null
          approved_by: string | null
          approver_id: string | null
          approver_name: string | null
          category: string
          created_at: string | null
          description: string
          escalation_sent: boolean | null
          escalation_sent_at: string | null
          id: string
          notes: string | null
          status: string
          submitted_at: string | null
          submitted_by: string
          updated_at: string | null
        }
        Insert: {
          amount?: number
          approved_at?: string | null
          approved_by?: string | null
          approver_id?: string | null
          approver_name?: string | null
          category?: string
          created_at?: string | null
          description: string
          escalation_sent?: boolean | null
          escalation_sent_at?: string | null
          id?: string
          notes?: string | null
          status?: string
          submitted_at?: string | null
          submitted_by: string
          updated_at?: string | null
        }
        Update: {
          amount?: number
          approved_at?: string | null
          approved_by?: string | null
          approver_id?: string | null
          approver_name?: string | null
          category?: string
          created_at?: string | null
          description?: string
          escalation_sent?: boolean | null
          escalation_sent_at?: string | null
          id?: string
          notes?: string | null
          status?: string
          submitted_at?: string | null
          submitted_by?: string
          updated_at?: string | null
        }
        Relationships: []
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
          children: Json | null
          created_at: string | null
          date_of_birth: string | null
          display_name: string | null
          email: string | null
          home_base: string | null
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
          wedding_anniversary: string | null
        }
        Insert: {
          auth_user_id: string
          avatar_url?: string | null
          children?: Json | null
          created_at?: string | null
          date_of_birth?: string | null
          display_name?: string | null
          email?: string | null
          home_base?: string | null
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
          wedding_anniversary?: string | null
        }
        Update: {
          auth_user_id?: string
          avatar_url?: string | null
          children?: Json | null
          created_at?: string | null
          date_of_birth?: string | null
          display_name?: string | null
          email?: string | null
          home_base?: string | null
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
          wedding_anniversary?: string | null
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
      project_design_files: {
        Row: {
          budget_discussed: boolean
          client_brief_url: string | null
          client_requirements_documented: boolean
          created_at: string
          created_by: string | null
          design_stage: string
          gfc_issued_at: string | null
          gfc_issued_by: string | null
          gfc_issuer_name: string | null
          id: string
          is_design_only: boolean
          linked_project_id: string | null
          measurements_confirmed: boolean
          num_floors: number | null
          project_id: string
          site_area_sqft: number | null
          site_visit_done: boolean
          special_requirements: string | null
          survey_report_uploaded: boolean
          target_gfc_date: string | null
          updated_at: string
        }
        Insert: {
          budget_discussed?: boolean
          client_brief_url?: string | null
          client_requirements_documented?: boolean
          created_at?: string
          created_by?: string | null
          design_stage?: string
          gfc_issued_at?: string | null
          gfc_issued_by?: string | null
          gfc_issuer_name?: string | null
          id?: string
          is_design_only?: boolean
          linked_project_id?: string | null
          measurements_confirmed?: boolean
          num_floors?: number | null
          project_id: string
          site_area_sqft?: number | null
          site_visit_done?: boolean
          special_requirements?: string | null
          survey_report_uploaded?: boolean
          target_gfc_date?: string | null
          updated_at?: string
        }
        Update: {
          budget_discussed?: boolean
          client_brief_url?: string | null
          client_requirements_documented?: boolean
          created_at?: string
          created_by?: string | null
          design_stage?: string
          gfc_issued_at?: string | null
          gfc_issued_by?: string | null
          gfc_issuer_name?: string | null
          id?: string
          is_design_only?: boolean
          linked_project_id?: string | null
          measurements_confirmed?: boolean
          num_floors?: number | null
          project_id?: string
          site_area_sqft?: number | null
          site_visit_done?: boolean
          special_requirements?: string | null
          survey_report_uploaded?: boolean
          target_gfc_date?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_design_files_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: true
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_invoices: {
        Row: {
          amount_outstanding: number | null
          amount_paid: number
          amount_total: number
          approved_at: string | null
          approved_by: string | null
          created_at: string
          created_by: string
          dispatch_event_id: string | null
          due_date: string | null
          id: string
          invoice_number: string
          invoice_type: string
          notes: string | null
          project_id: string
          raised_date: string
          sent_date: string | null
          sent_to_email: string | null
          status: string
          updated_at: string
        }
        Insert: {
          amount_outstanding?: number | null
          amount_paid?: number
          amount_total?: number
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          created_by: string
          dispatch_event_id?: string | null
          due_date?: string | null
          id?: string
          invoice_number: string
          invoice_type: string
          notes?: string | null
          project_id: string
          raised_date?: string
          sent_date?: string | null
          sent_to_email?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          amount_outstanding?: number | null
          amount_paid?: number
          amount_total?: number
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          created_by?: string
          dispatch_event_id?: string | null
          due_date?: string | null
          id?: string
          invoice_number?: string
          invoice_type?: string
          notes?: string | null
          project_id?: string
          raised_date?: string
          sent_date?: string | null
          sent_to_email?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_invoices_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_messages: {
        Row: {
          attachment_urls: string[] | null
          created_at: string
          id: string
          message_text: string | null
          project_id: string
          project_type: string
          read_by: string[] | null
          sender_id: string
          sender_name: string
        }
        Insert: {
          attachment_urls?: string[] | null
          created_at?: string
          id?: string
          message_text?: string | null
          project_id: string
          project_type?: string
          read_by?: string[] | null
          sender_id: string
          sender_name: string
        }
        Update: {
          attachment_urls?: string[] | null
          created_at?: string
          id?: string
          message_text?: string | null
          project_id?: string
          project_type?: string
          read_by?: string[] | null
          sender_id?: string
          sender_name?: string
        }
        Relationships: []
      }
      projects: {
        Row: {
          client_email: string | null
          client_name: string | null
          client_phone: string | null
          construction_type: string | null
          created_at: string | null
          created_by: string | null
          division: string
          est_completion: string | null
          gfc_budget: number | null
          id: string
          is_archived: boolean | null
          is_design_only: boolean
          location: string | null
          name: string
          planned_labour_cost: number | null
          site_lat: number | null
          site_lng: number | null
          site_radius: number | null
          site_ready_confirmed: boolean | null
          start_date: string | null
          status: string | null
          type: string | null
          updated_at: string | null
          updated_by: string | null
          wip_close_date: string | null
          wip_start_date: string | null
          wip_status: string
        }
        Insert: {
          client_email?: string | null
          client_name?: string | null
          client_phone?: string | null
          construction_type?: string | null
          created_at?: string | null
          created_by?: string | null
          division?: string
          est_completion?: string | null
          gfc_budget?: number | null
          id?: string
          is_archived?: boolean | null
          is_design_only?: boolean
          location?: string | null
          name: string
          planned_labour_cost?: number | null
          site_lat?: number | null
          site_lng?: number | null
          site_radius?: number | null
          site_ready_confirmed?: boolean | null
          start_date?: string | null
          status?: string | null
          type?: string | null
          updated_at?: string | null
          updated_by?: string | null
          wip_close_date?: string | null
          wip_start_date?: string | null
          wip_status?: string
        }
        Update: {
          client_email?: string | null
          client_name?: string | null
          client_phone?: string | null
          construction_type?: string | null
          created_at?: string | null
          created_by?: string | null
          division?: string
          est_completion?: string | null
          gfc_budget?: number | null
          id?: string
          is_archived?: boolean | null
          is_design_only?: boolean
          location?: string | null
          name?: string
          planned_labour_cost?: number | null
          site_lat?: number | null
          site_lng?: number | null
          site_radius?: number | null
          site_ready_confirmed?: boolean | null
          start_date?: string | null
          status?: string | null
          type?: string | null
          updated_at?: string | null
          updated_by?: string | null
          wip_close_date?: string | null
          wip_start_date?: string | null
          wip_status?: string
        }
        Relationships: []
      }
      punch_list_items: {
        Row: {
          after_photo_url: string | null
          before_photo_url: string | null
          category: string | null
          closed_at: string | null
          closed_by: string | null
          created_at: string | null
          created_by: string | null
          description: string
          fix_description: string | null
          id: string
          location: string | null
          project_id: string
          punch_list_id: string
          responsible_party: string | null
          status: string | null
          target_close_date: string | null
          updated_at: string | null
          waive_reason: string | null
          waived: boolean | null
        }
        Insert: {
          after_photo_url?: string | null
          before_photo_url?: string | null
          category?: string | null
          closed_at?: string | null
          closed_by?: string | null
          created_at?: string | null
          created_by?: string | null
          description: string
          fix_description?: string | null
          id?: string
          location?: string | null
          project_id: string
          punch_list_id: string
          responsible_party?: string | null
          status?: string | null
          target_close_date?: string | null
          updated_at?: string | null
          waive_reason?: string | null
          waived?: boolean | null
        }
        Update: {
          after_photo_url?: string | null
          before_photo_url?: string | null
          category?: string | null
          closed_at?: string | null
          closed_by?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string
          fix_description?: string | null
          id?: string
          location?: string | null
          project_id?: string
          punch_list_id?: string
          responsible_party?: string | null
          status?: string | null
          target_close_date?: string | null
          updated_at?: string | null
          waive_reason?: string | null
          waived?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "punch_list_items_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_orders: {
        Row: {
          amount: number
          approved_at: string | null
          approved_by: string | null
          category: string | null
          created_at: string
          delivery_date: string | null
          id: string
          is_archived: boolean
          item_description: string | null
          items_summary: string
          notes: string | null
          po_date: string
          po_number: string | null
          project_id: string | null
          project_name: string | null
          quantity: number | null
          raised_by: string | null
          rejection_reason: string | null
          source: string | null
          status: string
          total_amount: number | null
          unit: string | null
          unit_rate: number | null
          updated_at: string
          uploaded_by: string | null
          vendor_code: string | null
          vendor_name: string
        }
        Insert: {
          amount?: number
          approved_at?: string | null
          approved_by?: string | null
          category?: string | null
          created_at?: string
          delivery_date?: string | null
          id?: string
          is_archived?: boolean
          item_description?: string | null
          items_summary: string
          notes?: string | null
          po_date?: string
          po_number?: string | null
          project_id?: string | null
          project_name?: string | null
          quantity?: number | null
          raised_by?: string | null
          rejection_reason?: string | null
          source?: string | null
          status?: string
          total_amount?: number | null
          unit?: string | null
          unit_rate?: number | null
          updated_at?: string
          uploaded_by?: string | null
          vendor_code?: string | null
          vendor_name: string
        }
        Update: {
          amount?: number
          approved_at?: string | null
          approved_by?: string | null
          category?: string | null
          created_at?: string
          delivery_date?: string | null
          id?: string
          is_archived?: boolean
          item_description?: string | null
          items_summary?: string
          notes?: string | null
          po_date?: string
          po_number?: string | null
          project_id?: string | null
          project_name?: string | null
          quantity?: number | null
          raised_by?: string | null
          rejection_reason?: string | null
          source?: string | null
          status?: string
          total_amount?: number | null
          unit?: string | null
          unit_rate?: number | null
          updated_at?: string
          uploaded_by?: string | null
          vendor_code?: string | null
          vendor_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "purchase_orders_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
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
          ai_quality_checked: boolean | null
          ai_severity: string | null
          checklist_item_id: string
          created_at: string | null
          id: string
          inspection_id: string
          notes: string | null
          photo_url: string | null
          quality_issues: string[] | null
          quality_override: boolean | null
          result: string | null
        }
        Insert: {
          ai_quality_checked?: boolean | null
          ai_severity?: string | null
          checklist_item_id: string
          created_at?: string | null
          id?: string
          inspection_id: string
          notes?: string | null
          photo_url?: string | null
          quality_issues?: string[] | null
          quality_override?: boolean | null
          result?: string | null
        }
        Update: {
          ai_quality_checked?: boolean | null
          ai_severity?: string | null
          checklist_item_id?: string
          created_at?: string | null
          id?: string
          inspection_id?: string
          notes?: string | null
          photo_url?: string | null
          quality_issues?: string[] | null
          quality_override?: boolean | null
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
          stage_type: string | null
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
          stage_type?: string | null
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
          stage_type?: string | null
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
      retention_records: {
        Row: {
          actual_release_date: string | null
          amount_received: number | null
          client_name: string
          contract_value: number
          created_at: string
          created_by: string
          expected_release_date: string
          hold_start_date: string
          id: string
          payment_reference: string | null
          project_id: string
          retention_amount: number
          retention_pct: number
          status: string
          updated_at: string
        }
        Insert: {
          actual_release_date?: string | null
          amount_received?: number | null
          client_name: string
          contract_value?: number
          created_at?: string
          created_by: string
          expected_release_date: string
          hold_start_date: string
          id?: string
          payment_reference?: string | null
          project_id: string
          retention_amount?: number
          retention_pct?: number
          status?: string
          updated_at?: string
        }
        Update: {
          actual_release_date?: string | null
          amount_received?: number | null
          client_name?: string
          contract_value?: number
          created_at?: string
          created_by?: string
          expected_release_date?: string
          hold_start_date?: string
          id?: string
          payment_reference?: string | null
          project_id?: string
          retention_amount?: number
          retention_pct?: number
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "retention_records_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      rm_tickets: {
        Row: {
          ai_analysis: Json | null
          ai_analysis_generated_at: string | null
          ai_quality_checked: boolean | null
          client_name: string
          client_signoff_name: string | null
          completed_at: string | null
          completed_by: string | null
          completion_notes: string | null
          cost_estimate: number | null
          cost_estimated_at: string | null
          cost_estimated_by: string | null
          created_at: string
          id: string
          is_archived: boolean
          issue_description: string
          photo_urls: string[]
          priority: string
          project_id: string
          quality_issues: string[] | null
          quality_override: boolean | null
          raised_at: string
          raised_by: string
          status: string
          updated_at: string
          visit_scheduled_at: string | null
          visit_scheduled_by: string | null
          visit_scheduled_date: string | null
        }
        Insert: {
          ai_analysis?: Json | null
          ai_analysis_generated_at?: string | null
          ai_quality_checked?: boolean | null
          client_name: string
          client_signoff_name?: string | null
          completed_at?: string | null
          completed_by?: string | null
          completion_notes?: string | null
          cost_estimate?: number | null
          cost_estimated_at?: string | null
          cost_estimated_by?: string | null
          created_at?: string
          id?: string
          is_archived?: boolean
          issue_description: string
          photo_urls?: string[]
          priority?: string
          project_id: string
          quality_issues?: string[] | null
          quality_override?: boolean | null
          raised_at?: string
          raised_by: string
          status?: string
          updated_at?: string
          visit_scheduled_at?: string | null
          visit_scheduled_by?: string | null
          visit_scheduled_date?: string | null
        }
        Update: {
          ai_analysis?: Json | null
          ai_analysis_generated_at?: string | null
          ai_quality_checked?: boolean | null
          client_name?: string
          client_signoff_name?: string | null
          completed_at?: string | null
          completed_by?: string | null
          completion_notes?: string | null
          cost_estimate?: number | null
          cost_estimated_at?: string | null
          cost_estimated_by?: string | null
          created_at?: string
          id?: string
          is_archived?: boolean
          issue_description?: string
          photo_urls?: string[]
          priority?: string
          project_id?: string
          quality_issues?: string[] | null
          quality_override?: boolean | null
          raised_at?: string
          raised_by?: string
          status?: string
          updated_at?: string
          visit_scheduled_at?: string | null
          visit_scheduled_by?: string | null
          visit_scheduled_date?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rm_tickets_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_amc_contacts: {
        Row: {
          contacted_by: string | null
          created_at: string
          deal_id: string
          followup_date: string | null
          id: string
          notes: string | null
        }
        Insert: {
          contacted_by?: string | null
          created_at?: string
          deal_id: string
          followup_date?: string | null
          id?: string
          notes?: string | null
        }
        Update: {
          contacted_by?: string | null
          created_at?: string
          deal_id?: string
          followup_date?: string | null
          id?: string
          notes?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sales_amc_contacts_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "sales_deals"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_deals: {
        Row: {
          amc_interest: string | null
          assigned_to: string | null
          client_name: string
          contact_number: string | null
          contract_value: number
          created_at: string
          created_by: string | null
          email: string | null
          estimated_sqft: number | null
          id: string
          is_archived: boolean
          lead_source: string | null
          lost_reason: string | null
          next_followup_date: string | null
          notes: string | null
          project_type: string
          stage: string
          temperature: string
          updated_at: string
        }
        Insert: {
          amc_interest?: string | null
          assigned_to?: string | null
          client_name: string
          contact_number?: string | null
          contract_value?: number
          created_at?: string
          created_by?: string | null
          email?: string | null
          estimated_sqft?: number | null
          id?: string
          is_archived?: boolean
          lead_source?: string | null
          lost_reason?: string | null
          next_followup_date?: string | null
          notes?: string | null
          project_type?: string
          stage?: string
          temperature?: string
          updated_at?: string
        }
        Update: {
          amc_interest?: string | null
          assigned_to?: string | null
          client_name?: string
          contact_number?: string | null
          contract_value?: number
          created_at?: string
          created_by?: string | null
          email?: string | null
          estimated_sqft?: number | null
          id?: string
          is_archived?: boolean
          lead_source?: string | null
          lost_reason?: string | null
          next_followup_date?: string | null
          notes?: string | null
          project_type?: string
          stage?: string
          temperature?: string
          updated_at?: string
        }
        Relationships: []
      }
      sales_stage_history: {
        Row: {
          changed_at: string
          changed_by: string | null
          deal_id: string
          from_stage: string | null
          id: string
          to_stage: string
        }
        Insert: {
          changed_at?: string
          changed_by?: string | null
          deal_id: string
          from_stage?: string | null
          id?: string
          to_stage: string
        }
        Update: {
          changed_at?: string
          changed_by?: string | null
          deal_id?: string
          from_stage?: string | null
          id?: string
          to_stage?: string
        }
        Relationships: [
          {
            foreignKeyName: "sales_stage_history_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "sales_deals"
            referencedColumns: ["id"]
          },
        ]
      }
      site_diary: {
        Row: {
          ai_quality_checked: boolean | null
          blockers: string | null
          client_visit: boolean | null
          client_visit_name: string | null
          client_visit_notes: string | null
          client_visit_purpose: string | null
          created_at: string | null
          daily_summary: string | null
          entry_date: string
          gps_location: string | null
          id: string
          manpower_count: number | null
          material_deliveries: boolean | null
          material_delivery_items: Json | null
          notes: string | null
          photo_urls: string[]
          planned_activities: Json | null
          power_cut_duration: number | null
          power_cuts: boolean | null
          project_id: string
          quality_issues: string[] | null
          quality_override: boolean | null
          subcontractor_attendance: Json | null
          submitted_by: string
          updated_at: string | null
          weather_condition: string | null
        }
        Insert: {
          ai_quality_checked?: boolean | null
          blockers?: string | null
          client_visit?: boolean | null
          client_visit_name?: string | null
          client_visit_notes?: string | null
          client_visit_purpose?: string | null
          created_at?: string | null
          daily_summary?: string | null
          entry_date?: string
          gps_location?: string | null
          id?: string
          manpower_count?: number | null
          material_deliveries?: boolean | null
          material_delivery_items?: Json | null
          notes?: string | null
          photo_urls?: string[]
          planned_activities?: Json | null
          power_cut_duration?: number | null
          power_cuts?: boolean | null
          project_id: string
          quality_issues?: string[] | null
          quality_override?: boolean | null
          subcontractor_attendance?: Json | null
          submitted_by: string
          updated_at?: string | null
          weather_condition?: string | null
        }
        Update: {
          ai_quality_checked?: boolean | null
          blockers?: string | null
          client_visit?: boolean | null
          client_visit_name?: string | null
          client_visit_notes?: string | null
          client_visit_purpose?: string | null
          created_at?: string | null
          daily_summary?: string | null
          entry_date?: string
          gps_location?: string | null
          id?: string
          manpower_count?: number | null
          material_deliveries?: boolean | null
          material_delivery_items?: Json | null
          notes?: string | null
          photo_urls?: string[]
          planned_activities?: Json | null
          power_cut_duration?: number | null
          power_cuts?: boolean | null
          project_id?: string
          quality_issues?: string[] | null
          quality_override?: boolean | null
          subcontractor_attendance?: Json | null
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
      site_direct_receipts: {
        Row: {
          category: string | null
          created_by: string | null
          id: string
          material_name: string
          project_id: string
          qty: number
          received_at: string
          received_by_on_site: string | null
          site_receipt_notes: string | null
          unit: string | null
          vendor_name: string | null
        }
        Insert: {
          category?: string | null
          created_by?: string | null
          id?: string
          material_name: string
          project_id: string
          qty?: number
          received_at?: string
          received_by_on_site?: string | null
          site_receipt_notes?: string | null
          unit?: string | null
          vendor_name?: string | null
        }
        Update: {
          category?: string | null
          created_by?: string | null
          id?: string
          material_name?: string
          project_id?: string
          qty?: number
          received_at?: string
          received_by_on_site?: string | null
          site_receipt_notes?: string | null
          unit?: string | null
          vendor_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "site_direct_receipts_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      site_inventory: {
        Row: {
          created_at: string
          id: string
          last_updated_at: string
          last_updated_by: string | null
          material_name: string
          project_id: string
          qty_received: number
          qty_remaining: number | null
          qty_used: number
        }
        Insert: {
          created_at?: string
          id?: string
          last_updated_at?: string
          last_updated_by?: string | null
          material_name: string
          project_id: string
          qty_received?: number
          qty_remaining?: number | null
          qty_used?: number
        }
        Update: {
          created_at?: string
          id?: string
          last_updated_at?: string
          last_updated_by?: string | null
          material_name?: string
          project_id?: string
          qty_received?: number
          qty_remaining?: number | null
          qty_used?: number
        }
        Relationships: [
          {
            foreignKeyName: "site_inventory_project_id_fkey"
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
          dg_generator: boolean
          dg_generator_notes: string | null
          dry_run_video_url: string | null
          foundation_ready: boolean
          id: string
          is_complete: boolean
          labour_food: boolean
          labour_food_notes: string | null
          labour_stay: boolean
          labour_stay_notes: string | null
          module_id: string
          nearest_hardware_shop: boolean
          project_id: string | null
          safety_equipment: boolean
          shop_address: string | null
          shop_name: string | null
          shop_phone: string | null
          site_access_clear: boolean
          submitted_at: string | null
          submitted_by: string
          supervisor_stay: boolean
          supervisor_stay_notes: string | null
          team_briefed: boolean
          updated_at: string | null
        }
        Insert: {
          crane_booked?: boolean
          created_at?: string | null
          dg_generator?: boolean
          dg_generator_notes?: string | null
          dry_run_video_url?: string | null
          foundation_ready?: boolean
          id?: string
          is_complete?: boolean
          labour_food?: boolean
          labour_food_notes?: string | null
          labour_stay?: boolean
          labour_stay_notes?: string | null
          module_id: string
          nearest_hardware_shop?: boolean
          project_id?: string | null
          safety_equipment?: boolean
          shop_address?: string | null
          shop_name?: string | null
          shop_phone?: string | null
          site_access_clear?: boolean
          submitted_at?: string | null
          submitted_by: string
          supervisor_stay?: boolean
          supervisor_stay_notes?: string | null
          team_briefed?: boolean
          updated_at?: string | null
        }
        Update: {
          crane_booked?: boolean
          created_at?: string | null
          dg_generator?: boolean
          dg_generator_notes?: string | null
          dry_run_video_url?: string | null
          foundation_ready?: boolean
          id?: string
          is_complete?: boolean
          labour_food?: boolean
          labour_food_notes?: string | null
          labour_stay?: boolean
          labour_stay_notes?: string | null
          module_id?: string
          nearest_hardware_shop?: boolean
          project_id?: string | null
          safety_equipment?: boolean
          shop_address?: string | null
          shop_name?: string | null
          shop_phone?: string | null
          site_access_clear?: boolean
          submitted_at?: string | null
          submitted_by?: string
          supervisor_stay?: boolean
          supervisor_stay_notes?: string | null
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
          {
            foreignKeyName: "site_readiness_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      site_receipt_checklist: {
        Row: {
          created_at: string | null
          dispatch_docs_checked: boolean | null
          id: string
          is_complete: boolean | null
          module_id: string | null
          module_ids_verified: boolean | null
          physical_condition_checked: boolean | null
          physical_condition_photo_url: string | null
          project_id: string
          submitted_at: string | null
          submitted_by: string
          transport_damage_description: string | null
          transport_damage_found: boolean | null
          transport_damage_photos: string[] | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          dispatch_docs_checked?: boolean | null
          id?: string
          is_complete?: boolean | null
          module_id?: string | null
          module_ids_verified?: boolean | null
          physical_condition_checked?: boolean | null
          physical_condition_photo_url?: string | null
          project_id: string
          submitted_at?: string | null
          submitted_by: string
          transport_damage_description?: string | null
          transport_damage_found?: boolean | null
          transport_damage_photos?: string[] | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          dispatch_docs_checked?: boolean | null
          id?: string
          is_complete?: boolean | null
          module_id?: string | null
          module_ids_verified?: boolean | null
          physical_condition_checked?: boolean | null
          physical_condition_photo_url?: string | null
          project_id?: string
          submitted_at?: string | null
          submitted_by?: string
          transport_damage_description?: string | null
          transport_damage_found?: boolean | null
          transport_damage_photos?: string[] | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "site_receipt_checklist_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "modules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "site_receipt_checklist_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      stores_inventory: {
        Row: {
          available_qty: number
          created_at: string
          id: string
          material_name: string
          note: string | null
          project_id: string
          unit: string
          updated_at: string
        }
        Insert: {
          available_qty?: number
          created_at?: string
          id?: string
          material_name: string
          note?: string | null
          project_id: string
          unit?: string
          updated_at?: string
        }
        Update: {
          available_qty?: number
          created_at?: string
          id?: string
          material_name?: string
          note?: string | null
          project_id?: string
          unit?: string
          updated_at?: string
        }
        Relationships: []
      }
      subcontractor_assignments: {
        Row: {
          actual_completion: string | null
          actual_start: string | null
          company_name: string
          confirmed: boolean | null
          confirmed_at: string | null
          contact_person: string | null
          created_at: string | null
          created_by: string | null
          escalation_sent: boolean | null
          id: string
          phone: string | null
          pricing_type: string | null
          project_id: string
          reminder_14d_sent: boolean | null
          reminder_1d_sent: boolean | null
          reminder_5d_sent: boolean | null
          scheduled_completion: string | null
          scheduled_start: string | null
          scope: string | null
          status: string | null
          updated_at: string | null
          work_type: string | null
        }
        Insert: {
          actual_completion?: string | null
          actual_start?: string | null
          company_name: string
          confirmed?: boolean | null
          confirmed_at?: string | null
          contact_person?: string | null
          created_at?: string | null
          created_by?: string | null
          escalation_sent?: boolean | null
          id?: string
          phone?: string | null
          pricing_type?: string | null
          project_id: string
          reminder_14d_sent?: boolean | null
          reminder_1d_sent?: boolean | null
          reminder_5d_sent?: boolean | null
          scheduled_completion?: string | null
          scheduled_start?: string | null
          scope?: string | null
          status?: string | null
          updated_at?: string | null
          work_type?: string | null
        }
        Update: {
          actual_completion?: string | null
          actual_start?: string | null
          company_name?: string
          confirmed?: boolean | null
          confirmed_at?: string | null
          contact_person?: string | null
          created_at?: string | null
          created_by?: string | null
          escalation_sent?: boolean | null
          id?: string
          phone?: string | null
          pricing_type?: string | null
          project_id?: string
          reminder_14d_sent?: boolean | null
          reminder_1d_sent?: boolean | null
          reminder_5d_sent?: boolean | null
          scheduled_completion?: string | null
          scheduled_start?: string | null
          scope?: string | null
          status?: string | null
          updated_at?: string | null
          work_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "subcontractor_assignments_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      subcontractor_schedules: {
        Row: {
          confirmed: boolean | null
          confirmed_at: string | null
          created_at: string | null
          created_by: string
          escalation_sent: boolean | null
          id: string
          project_id: string
          reminder_14d_sent: boolean | null
          reminder_1d_sent: boolean | null
          reminder_5d_sent: boolean | null
          start_date: string
          subcontractor_name: string
          updated_at: string | null
        }
        Insert: {
          confirmed?: boolean | null
          confirmed_at?: string | null
          created_at?: string | null
          created_by: string
          escalation_sent?: boolean | null
          id?: string
          project_id: string
          reminder_14d_sent?: boolean | null
          reminder_1d_sent?: boolean | null
          reminder_5d_sent?: boolean | null
          start_date: string
          subcontractor_name: string
          updated_at?: string | null
        }
        Update: {
          confirmed?: boolean | null
          confirmed_at?: string | null
          created_at?: string | null
          created_by?: string
          escalation_sent?: boolean | null
          id?: string
          project_id?: string
          reminder_14d_sent?: boolean | null
          reminder_1d_sent?: boolean | null
          reminder_5d_sent?: boolean | null
          start_date?: string
          subcontractor_name?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "subcontractor_schedules_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
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
      weekly_digests: {
        Row: {
          created_at: string
          digest_sent_at: string | null
          focus_areas: Json | null
          id: string
          overall_score: number | null
          user_id: string
          week_start_date: string
          wins: Json | null
        }
        Insert: {
          created_at?: string
          digest_sent_at?: string | null
          focus_areas?: Json | null
          id?: string
          overall_score?: number | null
          user_id: string
          week_start_date: string
          wins?: Json | null
        }
        Update: {
          created_at?: string
          digest_sent_at?: string | null
          focus_areas?: Json | null
          id?: string
          overall_score?: number | null
          user_id?: string
          week_start_date?: string
          wins?: Json | null
        }
        Relationships: []
      }
      weekly_manpower_plans: {
        Row: {
          created_at: string | null
          created_by: string
          day_of_week: string
          id: string
          module_id: string | null
          plan_type: string
          planned_hours: number | null
          project_id: string | null
          stage_task: string | null
          status: string | null
          updated_at: string | null
          week_start_date: string
          worker_id: string | null
        }
        Insert: {
          created_at?: string | null
          created_by: string
          day_of_week: string
          id?: string
          module_id?: string | null
          plan_type: string
          planned_hours?: number | null
          project_id?: string | null
          stage_task?: string | null
          status?: string | null
          updated_at?: string | null
          week_start_date: string
          worker_id?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string
          day_of_week?: string
          id?: string
          module_id?: string | null
          plan_type?: string
          planned_hours?: number | null
          project_id?: string | null
          stage_task?: string | null
          status?: string | null
          updated_at?: string | null
          week_start_date?: string
          worker_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "weekly_manpower_plans_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "weekly_manpower_plans_worker_id_fkey"
            columns: ["worker_id"]
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
        | "principal_architect"
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
        "principal_architect",
      ],
      login_type: ["email", "otp"],
    },
  },
} as const
