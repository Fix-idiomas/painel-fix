import { supabase } from './supabaseClient'
export async function listarProfessores() {
  const { data, error } = await supabase.from('teachers').select('id_uuid, name, email').order('name')
  if (error) throw error
  return (data ?? []).map(p => ({ id: p.id_uuid, nome: p.name, email: p.email }))
}
