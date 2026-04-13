import { isSupabaseConfigured } from '../lib/supabase'
import type { AppRepository } from './appRepository'
import { LocalStorageAppRepository } from './localStorageAppRepository'
import { SupabaseAppRepository } from './supabaseAppRepository'

export function createAppRepository(): AppRepository {
  const preferredMode = import.meta.env.VITE_STORAGE_MODE

  if (preferredMode === 'supabase' && isSupabaseConfigured) {
    return new SupabaseAppRepository()
  }

  if (preferredMode === 'supabase' && !isSupabaseConfigured) {
    console.warn('VITE_STORAGE_MODE=supabase ですが Supabase 環境変数が不足しているため localStorage を使います。')
  }

  return new LocalStorageAppRepository()
}
