import { supabase } from './supabaseClient'

// LISTAR turmas com alunos/professores (via view agregadora)
export async function listarTurmas({
  status = null,
  level = null,
  professorIdText = null,
  search = null,
  page = 1,
  pageSize = 20,
} = {}) {
  const { data, error } = await supabase.rpc('turma_list_with_roster', {
    p_status: status,
    p_level: level,
    p_professor_id_text: professorIdText,
    p_search: search,
    p_page: page,
    p_page_size: pageSize,
  })
  if (error) throw error
  return data || []
}

// CRIAR turma
export async function criarTurma({ name, level = null, capacity = 3, status = 'active', start_date = null, end_date = null, notes = null }) {
  const { data, error } = await supabase.rpc('turma_create', {
    p_name: name,
    p_level: level,
    p_capacity: capacity,
    p_status: status,
    p_start_date: start_date,
    p_end_date: end_date,
    p_notes: notes,
  })
  if (error) throw error
  return data // retorna uuid da turma criada
}

// ADICIONAR aluno (student_id é INTEGER)
export async function addAluno(turmaId, studentId) {
  const { error } = await supabase.rpc('turma_add_student', {
    p_turma_id: turmaId,
    p_student_id: Number(studentId),
  })
  if (error) throw error
}

// ATRIBUIR professor (ID como texto; RPC faz cast p/ int/uuid)
export async function addProfessor(turmaId, teacherIdText, papel = 'titular') {
  const { error } = await supabase.rpc('turma_add_teacher', {
    p_turma_id: turmaId,
    p_teacher_id_text: String(teacherIdText),
    p_papel: papel,
  })
  if (error) throw error
}

// ATUALIZAR turma (editar nome/nível/capacidade/status)
export async function atualizarTurma(id, patch) {
  const { error } = await supabase.rpc('turma_update', {
    p_id: id,
    p_name: patch?.name ?? null,
    p_level: patch?.level ?? null,
    p_capacity: patch?.capacity ?? null,
    p_status: patch?.status ?? null,
    p_start_date: patch?.start_date ?? null,
    p_end_date: patch?.end_date ?? null,
    p_notes: patch?.notes ?? null,
  })
  if (error) throw error
}

export async function removerAluno(turmaId, studentId) {
  const { error } = await supabase.rpc('turma_remove_student', {
    p_turma_id: turmaId,
    p_student_id: Number(studentId),
  })
  if (error) throw error
}

export async function removerProfessor(turmaId, teacherIdText) {
  const { error } = await supabase.rpc('turma_remove_teacher', {
    p_turma_id: turmaId,
    p_teacher_id_text: String(teacherIdText),
  })
  if (error) throw error
}