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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      chat_messages: {
        Row: {
          id: string
          user_id: string
          role: string
          content: string
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          role: string
          content: string
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          role?: string
          content?: string
          created_at?: string
        }
        Relationships: []
      }
      accounts: {
        Row: {
          account_number: string | null
          account_type: string
          balance: number | null
          bic: string | null
          created_at: string | null
          currency: string | null
          iban: string | null
          id: string
          is_default: boolean | null
          name: string
          sort_code: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          account_number?: string | null
          account_type?: string
          balance?: number | null
          bic?: string | null
          created_at?: string | null
          currency?: string | null
          iban?: string | null
          id?: string
          is_default?: boolean | null
          name: string
          sort_code?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          account_number?: string | null
          account_type?: string
          balance?: number | null
          bic?: string | null
          created_at?: string | null
          currency?: string | null
          iban?: string | null
          id?: string
          is_default?: boolean | null
          name?: string
          sort_code?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      categories: {
        Row: {
          account_code: string | null
          account_type: string
          created_at: string | null
          id: string
          name: string
          parent_id: string | null
          type: string
          user_id: string
          vat_rate: number | null
        }
        Insert: {
          account_code?: string | null
          account_type?: string
          created_at?: string | null
          id?: string
          name: string
          parent_id?: string | null
          type?: string
          user_id: string
          vat_rate?: number | null
        }
        Update: {
          account_code?: string | null
          account_type?: string
          created_at?: string | null
          id?: string
          name?: string
          parent_id?: string | null
          type?: string
          user_id?: string
          vat_rate?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "categories_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      director_onboarding: {
        Row: {
          id: string
          user_id: string
          director_number: number
          onboarding_completed: boolean | null
          director_name: string | null
          pps_number: string | null
          date_of_birth: string | null
          marital_status: string | null
          assessment_basis: string | null
          annual_salary: number | null
          receives_dividends: boolean | null
          estimated_dividends: number | null
          onboarding_data: Json | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          user_id: string
          director_number?: number
          onboarding_completed?: boolean | null
          director_name?: string | null
          pps_number?: string | null
          date_of_birth?: string | null
          marital_status?: string | null
          assessment_basis?: string | null
          annual_salary?: number | null
          receives_dividends?: boolean | null
          estimated_dividends?: number | null
          onboarding_data?: Json | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          director_number?: number
          onboarding_completed?: boolean | null
          director_name?: string | null
          pps_number?: string | null
          date_of_birth?: string | null
          marital_status?: string | null
          assessment_basis?: string | null
          annual_salary?: number | null
          receives_dividends?: boolean | null
          estimated_dividends?: number | null
          onboarding_data?: Json | null
          created_at?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      customers: {
        Row: {
          address: string | null
          created_at: string | null
          email: string | null
          id: string
          name: string
          phone: string | null
          user_id: string
          vat_number: string | null
        }
        Insert: {
          address?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          name: string
          phone?: string | null
          user_id: string
          vat_number?: string | null
        }
        Update: {
          address?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          name?: string
          phone?: string | null
          user_id?: string
          vat_number?: string | null
        }
        Relationships: []
      }
      expenses: {
        Row: {
          account_id: string | null
          amount: number
          category_id: string | null
          created_at: string | null
          description: string
          expense_date: string
          id: string
          notes: string | null
          receipt_url: string | null
          supplier_id: string | null
          user_id: string
          vat_amount: number | null
          vat_rate: number | null
        }
        Insert: {
          account_id?: string | null
          amount: number
          category_id?: string | null
          created_at?: string | null
          description: string
          expense_date: string
          id?: string
          notes?: string | null
          receipt_url?: string | null
          supplier_id?: string | null
          user_id: string
          vat_amount?: number | null
          vat_rate?: number | null
        }
        Update: {
          account_id?: string | null
          amount?: number
          category_id?: string | null
          created_at?: string | null
          description?: string
          expense_date?: string
          id?: string
          notes?: string | null
          receipt_url?: string | null
          supplier_id?: string | null
          user_id?: string
          vat_amount?: number | null
          vat_rate?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "expenses_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      import_batches: {
        Row: {
          account_id: string | null
          created_at: string | null
          filename: string | null
          id: string
          row_count: number | null
          status: string | null
          user_id: string
        }
        Insert: {
          account_id?: string | null
          created_at?: string | null
          filename?: string | null
          id?: string
          row_count?: number | null
          status?: string | null
          user_id: string
        }
        Update: {
          account_id?: string | null
          created_at?: string | null
          filename?: string | null
          id?: string
          row_count?: number | null
          status?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "import_batches_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          created_at: string | null
          customer_id: string | null
          due_date: string | null
          id: string
          invoice_date: string
          invoice_number: string
          notes: string | null
          status: string | null
          subtotal: number
          total: number
          updated_at: string | null
          user_id: string
          vat_amount: number | null
        }
        Insert: {
          created_at?: string | null
          customer_id?: string | null
          due_date?: string | null
          id?: string
          invoice_date: string
          invoice_number: string
          notes?: string | null
          status?: string | null
          subtotal?: number
          total?: number
          updated_at?: string | null
          user_id: string
          vat_amount?: number | null
        }
        Update: {
          created_at?: string | null
          customer_id?: string | null
          due_date?: string | null
          id?: string
          invoice_date?: string
          invoice_number?: string
          notes?: string | null
          status?: string | null
          subtotal?: number
          total?: number
          updated_at?: string | null
          user_id?: string
          vat_amount?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "invoices_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      onboarding_settings: {
        Row: {
          business_description: string | null
          business_name: string | null
          business_type: string | null
          created_at: string | null
          id: string
          onboarding_completed: boolean | null
          rct_registered: boolean | null
          updated_at: string | null
          user_id: string
          vat_number: string | null
          vat_registered: boolean | null
        }
        Insert: {
          business_description?: string | null
          business_name?: string | null
          business_type?: string | null
          created_at?: string | null
          id?: string
          onboarding_completed?: boolean | null
          rct_registered?: boolean | null
          updated_at?: string | null
          user_id: string
          vat_number?: string | null
          vat_registered?: boolean | null
        }
        Update: {
          business_description?: string | null
          business_name?: string | null
          business_type?: string | null
          created_at?: string | null
          id?: string
          onboarding_completed?: boolean | null
          rct_registered?: boolean | null
          updated_at?: string | null
          user_id?: string
          vat_number?: string | null
          vat_registered?: boolean | null
        }
        Relationships: []
      }
      processing_jobs: {
        Row: {
          id: string
          user_id: string
          job_type: string
          status: string
          total_items: number
          processed_items: number
          failed_items: number
          input_data: Json | null
          result_data: Json | null
          error_message: string | null
          started_at: string | null
          completed_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          job_type: string
          status?: string
          total_items?: number
          processed_items?: number
          failed_items?: number
          input_data?: Json | null
          result_data?: Json | null
          error_message?: string | null
          started_at?: string | null
          completed_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          job_type?: string
          status?: string
          total_items?: number
          processed_items?: number
          failed_items?: number
          input_data?: Json | null
          result_data?: Json | null
          error_message?: string | null
          started_at?: string | null
          completed_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          address: string | null
          business_description: string | null
          business_name: string | null
          business_type: string | null
          created_at: string | null
          dashboard_widget_preferences: Json | null
          email: string | null
          id: string
          phone: string | null
          updated_at: string | null
          vat_number: string | null
        }
        Insert: {
          address?: string | null
          business_description?: string | null
          business_name?: string | null
          business_type?: string | null
          created_at?: string | null
          dashboard_widget_preferences?: Json | null
          email?: string | null
          id: string
          phone?: string | null
          updated_at?: string | null
          vat_number?: string | null
        }
        Update: {
          address?: string | null
          business_description?: string | null
          business_name?: string | null
          business_type?: string | null
          created_at?: string | null
          dashboard_widget_preferences?: Json | null
          email?: string | null
          id?: string
          phone?: string | null
          updated_at?: string | null
          vat_number?: string | null
        }
        Relationships: []
      }
      receipts: {
        Row: {
          amount: number | null
          created_at: string | null
          expense_id: string | null
          id: string
          image_url: string
          ocr_data: Json | null
          receipt_date: string | null
          transaction_id: string | null
          user_id: string
          vat_amount: number | null
          vat_rate: number | null
          vendor_name: string | null
        }
        Insert: {
          amount?: number | null
          created_at?: string | null
          expense_id?: string | null
          id?: string
          image_url: string
          ocr_data?: Json | null
          receipt_date?: string | null
          transaction_id?: string | null
          user_id: string
          vat_amount?: number | null
          vat_rate?: number | null
          vendor_name?: string | null
        }
        Update: {
          amount?: number | null
          created_at?: string | null
          expense_id?: string | null
          id?: string
          image_url?: string
          ocr_data?: Json | null
          receipt_date?: string | null
          transaction_id?: string | null
          user_id?: string
          vat_amount?: number | null
          vat_rate?: number | null
          vendor_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "receipts_expense_id_fkey"
            columns: ["expense_id"]
            isOneToOne: false
            referencedRelation: "expenses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "receipts_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      suppliers: {
        Row: {
          address: string | null
          created_at: string | null
          default_category_id: string | null
          email: string | null
          id: string
          name: string
          phone: string | null
          user_id: string
          vat_number: string | null
        }
        Insert: {
          address?: string | null
          created_at?: string | null
          default_category_id?: string | null
          email?: string | null
          id?: string
          name: string
          phone?: string | null
          user_id: string
          vat_number?: string | null
        }
        Update: {
          address?: string | null
          created_at?: string | null
          default_category_id?: string | null
          email?: string | null
          id?: string
          name?: string
          phone?: string | null
          user_id?: string
          vat_number?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "suppliers_default_category_id_fkey"
            columns: ["default_category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      transactions: {
        Row: {
          account_id: string | null
          amount: number
          category_id: string | null
          created_at: string | null
          description: string
          id: string
          import_batch_id: string | null
          is_reconciled: boolean | null
          notes: string | null
          receipt_url: string | null
          reference: string | null
          transaction_date: string
          type: string
          updated_at: string | null
          user_id: string
          vat_amount: number | null
          vat_rate: number | null
        }
        Insert: {
          account_id?: string | null
          amount: number
          category_id?: string | null
          created_at?: string | null
          description: string
          id?: string
          import_batch_id?: string | null
          is_reconciled?: boolean | null
          notes?: string | null
          receipt_url?: string | null
          reference?: string | null
          transaction_date: string
          type?: string
          updated_at?: string | null
          user_id: string
          vat_amount?: number | null
          vat_rate?: number | null
        }
        Update: {
          account_id?: string | null
          amount?: number
          category_id?: string | null
          created_at?: string | null
          description?: string
          id?: string
          import_batch_id?: string | null
          is_reconciled?: boolean | null
          notes?: string | null
          receipt_url?: string | null
          reference?: string | null
          transaction_date?: string
          type?: string
          updated_at?: string | null
          user_id?: string
          vat_amount?: number | null
          vat_rate?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "transactions_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      vat_returns: {
        Row: {
          all_expenses_added: boolean | null
          all_sales_added: boolean | null
          completed_at: string | null
          confirm_accuracy: boolean | null
          created_at: string | null
          credit_notes: boolean | null
          credit_notes_details: string | null
          declaration_penalties_understood: boolean | null
          declaration_period_lock_understood: boolean | null
          declaration_true_and_complete: boolean | null
          eu_purchase_ids: string | null
          eu_purchases: boolean | null
          food_vat_claim: string | null
          id: string
          late_transactions: boolean | null
          lock_period: boolean | null
          manual_adjustment_amount: number | null
          manual_adjustment_reason: string | null
          manual_adjustments: boolean | null
          missing_receipts: boolean | null
          missing_receipts_list: string | null
          motor_vat_claim: string | null
          non_eu_purchase_details: string | null
          non_eu_purchases: boolean | null
          period_end: string
          period_start: string
          purchases_total: number | null
          remove_non_allowed_reason: string | null
          remove_non_allowed_vat: boolean | null
          reviewed_flagged_transactions: boolean | null
          sales_total: number | null
          special_sales: boolean | null
          special_sales_notes: string | null
          status: string | null
          unpaid_invoices: boolean | null
          unpaid_invoices_list: string | null
          updated_at: string | null
          user_id: string
          vat_due: number | null
          vat_notes: string | null
          vat_on_purchases: number | null
          vat_on_sales: number | null
        }
        Insert: {
          all_expenses_added?: boolean | null
          all_sales_added?: boolean | null
          completed_at?: string | null
          confirm_accuracy?: boolean | null
          created_at?: string | null
          credit_notes?: boolean | null
          credit_notes_details?: string | null
          declaration_penalties_understood?: boolean | null
          declaration_period_lock_understood?: boolean | null
          declaration_true_and_complete?: boolean | null
          eu_purchase_ids?: string | null
          eu_purchases?: boolean | null
          food_vat_claim?: string | null
          id?: string
          late_transactions?: boolean | null
          lock_period?: boolean | null
          manual_adjustment_amount?: number | null
          manual_adjustment_reason?: string | null
          manual_adjustments?: boolean | null
          missing_receipts?: boolean | null
          missing_receipts_list?: string | null
          motor_vat_claim?: string | null
          non_eu_purchase_details?: string | null
          non_eu_purchases?: boolean | null
          period_end: string
          period_start: string
          purchases_total?: number | null
          remove_non_allowed_reason?: string | null
          remove_non_allowed_vat?: boolean | null
          reviewed_flagged_transactions?: boolean | null
          sales_total?: number | null
          special_sales?: boolean | null
          special_sales_notes?: string | null
          status?: string | null
          unpaid_invoices?: boolean | null
          unpaid_invoices_list?: string | null
          updated_at?: string | null
          user_id: string
          vat_due?: number | null
          vat_notes?: string | null
          vat_on_purchases?: number | null
          vat_on_sales?: number | null
        }
        Update: {
          all_expenses_added?: boolean | null
          all_sales_added?: boolean | null
          completed_at?: string | null
          confirm_accuracy?: boolean | null
          created_at?: string | null
          credit_notes?: boolean | null
          credit_notes_details?: string | null
          declaration_penalties_understood?: boolean | null
          declaration_period_lock_understood?: boolean | null
          declaration_true_and_complete?: boolean | null
          eu_purchase_ids?: string | null
          eu_purchases?: boolean | null
          food_vat_claim?: string | null
          id?: string
          late_transactions?: boolean | null
          lock_period?: boolean | null
          manual_adjustment_amount?: number | null
          manual_adjustment_reason?: string | null
          manual_adjustments?: boolean | null
          missing_receipts?: boolean | null
          missing_receipts_list?: string | null
          motor_vat_claim?: string | null
          non_eu_purchase_details?: string | null
          non_eu_purchases?: boolean | null
          period_end?: string
          period_start?: string
          purchases_total?: number | null
          remove_non_allowed_reason?: string | null
          remove_non_allowed_vat?: boolean | null
          reviewed_flagged_transactions?: boolean | null
          sales_total?: number | null
          special_sales?: boolean | null
          special_sales_notes?: string | null
          status?: string | null
          unpaid_invoices?: boolean | null
          unpaid_invoices_list?: string | null
          updated_at?: string | null
          user_id?: string
          vat_due?: number | null
          vat_notes?: string | null
          vat_on_purchases?: number | null
          vat_on_sales?: number | null
        }
        Relationships: []
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
    Enums: {},
  },
} as const
