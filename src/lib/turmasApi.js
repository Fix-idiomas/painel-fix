// lib/turmasApi.js
import { supabase } from './supabaseClient'

const ok = (res) => {
  if (res.error) throw new Error(res.error.message || 'Erro Supabase')
  return res.data ?? null
}

// turmas do professor (via RLS/policies)
export async function listarTurmasDoProfessor() {
  const res = await supabase.from('turmas').select('id_uuid, nome').order('nome')
  return ok(res)?.map(t => ({ id: t.id_uuid, nome: t.nome })) ?? []
}

// alunos da turma
export async function listarAlunosDaTurma(turmaId) {
  const res = await supabase
    .from('turma_students')
    .select('student_id_uuid, students:student_id_uuid ( name, email )')
    .eq('turma_id', turmaId)
  const rows = ok(res) ?? []
  return rows.map(r => ({
    student_id_uuid: r.student_id_uuid,
    name: r.students?.name ?? '',
    email: r.students?.email ?? null
  }))
}
