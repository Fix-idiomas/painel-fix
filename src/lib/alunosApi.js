// lib/alunosApi.js
import { supabase } from './supabaseClient'
const ok = (r) => { if (r.error) throw new Error(r.error.message); return r.data ?? null }

export async function listarAlunosAtivos() {
  const { data, error } = await supabase
    .from('turma_students')
    .select('student_id_uuid, status, students:student_id_uuid ( name, email )')
    .eq('status', 'ativo')
  if (error) throw error
  return (data ?? []).map(r => ({ id: r.student_id_uuid, nome: r.students?.name, email: r.students?.email }))
}

export async function listarAlunosInativos() {
  const { data, error } = await supabase
    .from('turma_students')
    .select('student_id_uuid, status, students:student_id_uuid ( name, email )')
    .neq('status', 'ativo')
  if (error) throw error
  return (data ?? []).map(r => ({ id: r.student_id_uuid, nome: r.students?.name, email: r.students?.email }))
}
