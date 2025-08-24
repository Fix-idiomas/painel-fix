// lib/evolucaoRegistroDelete.js
import { supabase } from './supabaseClient'
export async function evolucaoRegistroDelete(registroId) {
  const { data, error } = await supabase.rpc('evolucao_registro_delete', { p_registro_id: registroId })
  if (error) throw error
  return data ?? null
}
