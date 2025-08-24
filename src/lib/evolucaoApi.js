// lib/evolucaoApi.js
import { supabase } from './supabaseClient'

const ok = (res) => {
  if (res.error) throw new Error(res.error.message || 'Erro Supabase')
  return res.data ?? null
}

// listar registros (gerais) do prof logado
export async function listarRegistros({ from, to = null }) {
  const res = await supabase.rpc('evolucao_registro_listar_por_professor_auth', {
    p_data_ini: from,
    p_data_fim: to
  })
  return ok(res)
}

// listar itens individuais do prof logado
export async function listarItens({ from, to = null }) {
  const res = await supabase.rpc('evolucao_itens_listar_por_professor_auth', {
    p_data_ini: from,
    p_data_fim: to
  })
  return ok(res)
}

// criar registro + itens
// payload = [{ student_id_uuid, obs }]
export async function criarRegistro({ turmaId, obsGeral, payload, date = null }) {
  const res = await supabase.rpc('evolucao_registro_upsert', {
    p_turma_id: turmaId,
    p_data: date,
    p_observacao_geral: obsGeral,
    p_individuais: payload
  })
  return ok(res) // retorna uuid do registro
}

// deletar registro (RPC segura)
export async function deletarRegistro({ registroId }) {
  const res = await supabase.rpc('evolucao_registro_delete', { p_registro_id: registroId })
  return ok(res)
}
