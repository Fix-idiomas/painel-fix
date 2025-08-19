import { supabase } from './supabaseClient'

export async function listarProfessores() {
  const { data, error } = await supabase
    .from('teachers')
    .select('id, name')
    .order('name', { ascending: true })

  if (error) throw new Error(error.message)
  return data || []
}