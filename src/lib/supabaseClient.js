import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_KEY

if (!supabaseUrl) throw new Error('NEXT_PUBLIC_SUPABASE_URL ausente (.env.local)')
if (!supabaseKey) throw new Error('NEXT_PUBLIC_SUPABASE_ANON_KEY ausente (.env.local)')

export const supabase = createClient(supabaseUrl, supabaseKey)
