import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing Supabase environment variables. Please check your .env file.')
  console.error('VITE_SUPABASE_URL:', supabaseUrl ? 'Set' : 'Missing')
  console.error('VITE_SUPABASE_ANON_KEY:', supabaseAnonKey ? 'Set' : 'Missing')
  throw new Error('Missing Supabase environment variables. Please check your .env file and ensure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are set.')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true
  }
})

export type Database = {
  public: {
    Tables: {
      clients: {
        Row: {
          id: string
          name: string
          site: string
          mobile_number: string
          created_at: string
        }
        Insert: {
          id: string
          name: string
          site: string
          mobile_number: string
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          site?: string
          mobile_number?: string
          created_at?: string
        }
      }
      stock: {
        Row: {
          id: number
          plate_size: string
          total_quantity: number
          available_quantity: number
          on_rent_quantity: number
          updated_at: string
        }
        Insert: {
          id?: number
          plate_size: string
          total_quantity?: number
          available_quantity?: number
          on_rent_quantity?: number
          updated_at?: string
        }
        Update: {
          id?: number
          plate_size?: string
          total_quantity?: number
          available_quantity?: number
          on_rent_quantity?: number
          updated_at?: string
        }
      }
      challans: {
        Row: {
          id: number
          challan_number: string
          client_id: string
          challan_date: string
          status: string
          created_at: string
          driver_name: string | null
        }
        Insert: {
          id?: number
          challan_number: string
          client_id: string
          challan_date: string
          status?: string
          created_at?: string
          driver_name?: string | null
        }
        Update: {
          id?: number
          challan_number?: string
          client_id?: string
          challan_date?: string
          status?: string
          created_at?: string
          driver_name?: string | null
        }
      }
      challan_items: {
        Row: {
          id: number
          challan_id: number
          plate_size: string
          borrowed_quantity: number
          returned_quantity: number
          status: string
          created_at: string
          borrowed_stock: number
        }
        Insert: {
          id?: number
          challan_id: number
          plate_size: string
          borrowed_quantity: number
          returned_quantity?: number
          status?: string
          created_at?: string
          borrowed_stock?: number
        }
        Update: {
          id?: number
          challan_id?: number
          plate_size?: string
          borrowed_quantity?: number
          returned_quantity?: number
          status?: string
          created_at?: string
          borrowed_stock?: number
        }
      }
      returns: {
        Row: {
          id: number
          return_challan_number: string
          client_id: string
          return_date: string
          created_at: string
          driver_name: string | null
        }
        Insert: {
          id?: number
          return_challan_number: string
          client_id: string
          return_date: string
          created_at?: string
          driver_name?: string | null
        }
        Update: {
          id?: number
          return_challan_number?: string
          client_id?: string
          return_date?: string
          created_at?: string
          driver_name?: string | null
        }
      }
      return_line_items: {
        Row: {
          id: number
          return_id: number
          plate_size: string
          returned_quantity: number
          damage_notes: string | null
          created_at: string
          damaged_quantity: number
          lost_quantity: number
          returned_borrowed_stock: number
        }
        Insert: {
          id?: number
          return_id: number
          plate_size: string
          returned_quantity: number
          damage_notes?: string | null
          created_at?: string
          damaged_quantity?: number
          lost_quantity?: number
          returned_borrowed_stock?: number
        }
        Update: {
          id?: number
          return_id?: number
          plate_size?: string
          returned_quantity?: number
          damage_notes?: string | null
          created_at?: string
          damaged_quantity?: number
          lost_quantity?: number
          returned_borrowed_stock?: number
        }
      }
      bills: {
        Row: {
          id: number
          client_id: string
          period_start: string
          period_end: string
          total_amount: number
          payment_status: string
          created_at: string
        }
        Insert: {
          id?: number
          client_id: string
          period_start: string
          period_end: string
          total_amount?: number
          payment_status?: string
          created_at?: string
        }
        Update: {
          id?: number
          client_id?: string
          period_start?: string
          period_end?: string
          total_amount?: number
          payment_status?: string
          created_at?: string
        }
      }
    }
  }
}