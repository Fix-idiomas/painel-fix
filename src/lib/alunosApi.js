import { supabase } from './supabaseClient'

export async function listarAlunos() {
  const { data, error } = await supabase
    .from('students')
    .select('id, name')
    .order('name', { ascending: true })

  if (error) throw new Error(error.message)
  return data || []
}