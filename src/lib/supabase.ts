import { createClient } from '@supabase/supabase-js'
import { expireAdminSession, readAdminSession } from './adminSession'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = supabaseUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      fetch: async (input, init) => {
        if (!readAdminSession()) {
          expireAdminSession()
          return new Response(JSON.stringify({ message: 'Sesi berakhir, silakan masuk kembali.', code: 'SESSION_EXPIRED' }), {
            status: 401, headers: { 'Content-Type': 'application/json' },
          })
        }
        const response = await fetch(input, init)
        if (response.status === 401) expireAdminSession()
        return response
      },
    },
  })
  : null

export const isSupabaseConfigured = Boolean(supabase)
