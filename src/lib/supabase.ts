import { createClient } from '@supabase/supabase-js'

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
      events: {
        Row: {
          id: string
          name: string
          host_user_id: string
          host_auth_user_id: string | null
          capacity: number
          participants_per_block: number
          winners_per_block: number
          block_count: number
          share_token: string
          created_at: string
        }
        Insert: {
          id: string
          name: string
          host_user_id: string
          host_auth_user_id?: string | null
          capacity: number
          participants_per_block: number
          winners_per_block: number
          block_count: number
          share_token: string
          created_at: string
        }
        Update: Partial<{
          id: string
          name: string
          host_user_id: string
          host_auth_user_id?: string | null
          capacity: number
          participants_per_block: number
          winners_per_block: number
          block_count: number
          share_token: string
          created_at: string
        }>
        Relationships: []
      }
      participants: {
        Row: {
          id: string
          event_id: string
          name: string
          source_type: 'open' | 'invite'
          invite_id: string | null
          assigned_block_index: number
          assigned_seed: number
          joined_at: string
        }
        Insert: {
          id: string
          event_id: string
          name: string
          source_type: 'open' | 'invite'
          invite_id?: string | null
          assigned_block_index: number
          assigned_seed: number
          joined_at: string
        }
        Update: Partial<{
          id: string
          event_id: string
          name: string
          source_type: 'open' | 'invite'
          invite_id?: string | null
          assigned_block_index: number
          assigned_seed: number
          joined_at: string
        }>
        Relationships: []
      }
      event_invites: {
        Row: {
          id: string
          event_id: string
          display_name: string
          invite_token: string
          status: 'pending' | 'joined'
          fixed_block_index: number | null
          fixed_seed: number | null
          joined_participant_id: string | null
          created_at: string
        }
        Insert: {
          id: string
          event_id: string
          display_name: string
          invite_token: string
          status: 'pending' | 'joined'
          fixed_block_index?: number | null
          fixed_seed?: number | null
          joined_participant_id?: string | null
          created_at: string
        }
        Update: Partial<{
          id: string
          event_id: string
          display_name: string
          invite_token: string
          status: 'pending' | 'joined'
          fixed_block_index?: number | null
          fixed_seed?: number | null
          joined_participant_id?: string | null
          created_at: string
        }>
        Relationships: []
      }
      matches: {
        Row: {
          id: string
          event_id: string
          block_id: string | null
          stage_type: 'block' | 'final'
          round_index: number
          match_index: number
          slot1_source: Json
          slot2_source: Json
          participant_sources: Json | null
          advance_count: number | null
          is_final_stage: boolean | null
          participant_ids: Json | null
          qualified_participant_ids: Json | null
          player1_participant_id: string | null
          player2_participant_id: string | null
          winner_participant_id: string | null
          next_match_id: string | null
          next_slot: number | null
        }
        Insert: {
          id: string
          event_id: string
          block_id?: string | null
          stage_type: 'block' | 'final'
          round_index: number
          match_index: number
          slot1_source: Json
          slot2_source: Json
          participant_sources?: Json | null
          advance_count?: number | null
          is_final_stage?: boolean | null
          participant_ids?: Json | null
          qualified_participant_ids?: Json | null
          player1_participant_id?: string | null
          player2_participant_id?: string | null
          winner_participant_id?: string | null
          next_match_id?: string | null
          next_slot?: number | null
        }
        Update: Partial<{
          id: string
          event_id: string
          block_id?: string | null
          stage_type: 'block' | 'final'
          round_index: number
          match_index: number
          slot1_source: Json
          slot2_source: Json
          participant_sources?: Json | null
          advance_count?: number | null
          is_final_stage?: boolean | null
          participant_ids?: Json | null
          qualified_participant_ids?: Json | null
          player1_participant_id?: string | null
          player2_participant_id?: string | null
          winner_participant_id?: string | null
          next_match_id?: string | null
          next_slot?: number | null
        }>
        Relationships: []
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabasePublishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY
const supabaseClientKey = supabasePublishableKey || supabaseAnonKey

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseClientKey)

export const supabase = isSupabaseConfigured
  ? createClient<Database>(supabaseUrl, supabaseClientKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      },
      realtime: {
        params: {
          eventsPerSecond: 10,
        },
      },
    })
  : null
