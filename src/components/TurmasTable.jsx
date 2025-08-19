'use client'
import { useEffect, useState } from 'react'
import { listarTurmas, criarTurma, addAluno, addProfessor, atualizarTurma, removerAluno } from '../lib/turmasApi'
import { listarAlunos } from '../lib/alunosApi'
import { listarProfessores } from '../lib/professoresApi'

export default function TurmasTable() {
  const [alunos, setAlunos] = useState([])
  const [alunosLoading, setAlunosLoading] = useState(false)
  const [professores, setProfessores] = useState([])
  const [professoresLoading, setProfessoresLoading] = useState(false)
  const [turmas, setTurmas] = useState([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [form, setForm] = useState({ name: '', level: 'K1', capacity: 3 })

  // Modal de edição
  const [showEditModal, setShowEditModal] = useState(false)
  const [editForm, setEditForm] = useState({ id: null, name: '', level: 'K1', capacity: 3, status: 'active', students: [] })
  const [editBusy, setEditBusy] = useState(false)
  const [editErr, setEditErr] = useState('')

  // estados dos modais
  const [showAlunoModal, setShowAlunoModal] = useState(false)
  const [showProfModal, setShowProfModal] = useState(false)
  const [targetTurma, setTargetTurma] = useState(null)
  const [studentId, setStudentId] = useState('')
  const [teacherId, setTeacherId] = useState('')
  const [papel, setPapel] = useState('titular')
  const [actionBusy, setActionBusy] = useState(false)
  const [actionError, setActionError] = useState('')

  async function openAlunoModal(t) {
    setTargetTurma(t)
    setStudentId('')
    setActionError('')
    setShowAlunoModal(true)
    setAlunosLoading(true)
    try {
      const lista = await listarAlunos()
      setAlunos(lista)
    } catch (e) {
      setAlunos([])
    } finally {
      setAlunosLoading(false)
    }
  }

  async function openProfModal(t) {
    setTargetTurma(t)
    setTeacherId('')
    setPapel('titular')
    setActionError('')
    setShowProfModal(true)
    setProfessoresLoading(true)
    try {
      const lista = await listarProfessores()
      setProfessores(lista)
    } catch (e) {
      setProfessores([])
    } finally {
      setProfessoresLoading(false)
    }
  }

  async function carregar() {
    setLoading(true)
    setErrorMsg('')
    try {
      const data = await listarTurmas({ page: 1, pageSize: 50 })
      setTurmas(data)
    } catch (err) {
      setErrorMsg(err.message || 'Erro ao listar turmas')
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => { carregar() }, [])

  async function onCriar(e) {
    e.preventDefault()
    setErrorMsg('')
    if (!form.name?.trim()) return setErrorMsg('Informe o nome da turma')
    try {
      setCreating(true)
      await criarTurma({
        name: form.name.trim(),
        level: form.level,
        capacity: Number(form.capacity) || 3,
        status: 'active'
      })
      setForm({ name: '', level: 'K1', capacity: 3 })
      await carregar()
    } catch (err) {
      setErrorMsg(err.message || 'Erro ao criar turma')
    } finally {
      setCreating(false)
    }
  }

  function openEditModal(t) {
    setEditErr('')
    setEditForm({
      id: t.id,
      name: t.name || '',
      level: t.level || 'K1',
      capacity: Number(t.capacity ?? 3),
      status: t.status || 'active',
      students: t.students || []
    })
    setShowEditModal(true)
    // Carrega alunos se ainda não carregou (para mostrar nomes)
    if (alunos.length === 0) {
      listarAlunos().then(setAlunos).catch(() => setAlunos([]))
    }
  }

  // Handler do modal de edição
  async function confirmarEdicao(e) {
    e.preventDefault()
    setEditErr('')
    if (!editForm.name?.trim()) {
      setEditErr('Informe o nome da turma')
      return
    }
    try {
      setEditBusy(true)
      await atualizarTurma(editForm.id, {
        name: editForm.name.trim(),
        level: editForm.level,
        capacity: Math.max(1, Math.min(3, Number(editForm.capacity) || 3)),
        status: editForm.status,
      })
      setShowEditModal(false)
      await carregar()
    } catch (err) {
      setEditErr(err.message || 'Erro ao salvar alterações')
    } finally {
      setEditBusy(false)
    }
  }

  async function confirmarAddAluno(e) {
    e.preventDefault()
    setActionError('')
    if (!studentId) return setActionError('Selecione o aluno')
    try {
      setActionBusy(true)
      await addAluno(targetTurma.id, studentId)
      setShowAlunoModal(false)
      await carregar()
    } catch (err) {
      const msg = String(err.message || '')
      if (msg.includes('turma_capacity_exceeded')) {
        setActionError('Capacidade máxima já atingida nesta turma.')
      } else if (msg.includes('student_already_active_in_other_turma')) {
        setActionError('Este aluno já está ativo em outra turma.')
      } else {
        setActionError(err.message || 'Erro ao adicionar aluno')
      }
    } finally {
      setActionBusy(false)
    }
  }

  async function confirmarAddProfessor(e) {
    e.preventDefault()
    setActionError('')
    if (!teacherId) return setActionError('Selecione o professor')
    try {
      setActionBusy(true)
      await addProfessor(targetTurma.id, teacherId, papel)
      setShowProfModal(false)
      await carregar()
    } catch (err) {
      const msg = String(err.message || '')
      if (msg.includes('already_assigned')) {
        setActionError('Professor já está atribuído a esta turma.')
      } else if (msg.includes('invalid_role')) {
        setActionError('Papel inválido. Use "titular" ou "sub".')
      } else {
        setActionError(err.message || 'Erro ao atribuir professor')
      }
    } finally {
      setActionBusy(false)
    }
  }

  // Função para remover aluno da turma (usada no modal de edição)
  async function handleRemoverAlunoModal(alunoId) {
    if (!window.confirm('Remover este aluno da turma?')) return
    setActionBusy(true)
    try {
      await removerAluno(editForm.id, alunoId)
      // Atualiza a lista de alunos no modal
      const turmaAtualizada = await listarTurmas({ page: 1, pageSize: 1, id: editForm.id })
      setEditForm(f => ({
        ...f,
        students: turmaAtualizada[0]?.students || []
      }))
      await carregar()
    } catch (err) {
      alert('Erro ao remover aluno: ' + (err.message || err))
    } finally {
      setActionBusy(false)
    }
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
      {/* Formulário de criação */}
      <div className="px-6 py-4 border-b border-slate-100 bg-slate-50 flex flex-wrap items-center gap-2">
        <form onSubmit={onCriar} className="flex flex-wrap items-center gap-2 w-full">
          <input
            className="h-9 px-3 rounded-md border border-slate-300 text-[14px] placeholder:text-slate-400 min-w-[180px]"
            placeholder="Nome da turma"
            value={form.name}
            onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
          />
          <select
            className="h-9 px-3 rounded-md border border-slate-300 text-[14px]"
            value={form.level}
            onChange={e => setForm(f => ({ ...f, level: e.target.value }))}
          >
            <option>K1</option><option>K2</option><option>K3</option>
            <option>K4</option><option>KP1</option><option>KP2</option>
          </select>
          <input
            type="number" min={1} max={3}
            className="h-9 w-[72px] px-3 rounded-md border border-slate-300 text-[14px]"
            value={form.capacity}
            onChange={e => setForm(f => ({ ...f, capacity: e.target.value }))}
            title="Capacidade (1 a 3)"
          />
          <button type="submit" disabled={creating} className="h-9 px-3 rounded-md bg-emerald-600 text-white text-[14px] flex items-center gap-1 disabled:opacity-60">
            {creating ? 'Criando…' : 'Criar'}
          </button>
          <button type="button" onClick={carregar} className="h-9 px-3 rounded-md border border-slate-300 text-[14px] flex items-center gap-1 hover:bg-slate-100">
            Recarregar
          </button>
          {errorMsg && <div className="ml-4 text-[13px] text-red-600">{errorMsg}</div>}
        </form>
      </div>

      {/* Conteúdo */}
      <div className="px-6 py-4">
        {loading ? (
          <div className="text-[14px] text-slate-500">Carregando…</div>
        ) : turmas.length === 0 ? (
          <div className="text-[14px] text-slate-500">Nenhuma turma cadastrada.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full border-collapse">
              <thead>
                <tr>
                  <th className="border-b px-4 py-2 text-left">Nome</th>
                  <th className="border-b px-4 py-2 text-left">Nível</th>
                  <th className="border-b px-4 py-2 text-left">Capacidade</th>
                  <th className="border-b px-4 py-2 text-left">Alunos ativos</th>
                  <th className="border-b px-4 py-2 text-right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {turmas.map((t, idx) => (
                  <tr key={t.id} className={idx % 2 === 0 ? 'even:bg-slate-50' : ''}>
                    <td className="border-b px-4 py-2 font-medium text-slate-900">{t.name}</td>
                    <td className="border-b px-4 py-2">{t.level ?? '-'}</td>
                    <td className="border-b px-4 py-2">
                      <span className={`inline-block px-2 py-1 rounded text-xs font-semibold
                        ${t.active_students >= t.capacity ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-700'}`}>
                        {t.capacity ?? '-'}
                      </span>
                    </td>
                    <td className="border-b px-4 py-2">
                      {t.students && t.students.length > 0
                        ? t.students.length
                        : <span className="text-slate-400 text-xs">Nenhum aluno</span>
                      }
                    </td>
                    <td className="border-b px-4 py-2 text-right space-x-2">
                      <button
                        className="inline-flex items-center gap-1 text-[13px] text-blue-700 hover:underline"
                        title="Editar turma"
                        onClick={() => openEditModal(t)}
                      >
                        Editar
                      </button>
                      <button
                        className="inline-flex items-center gap-1 text-[13px] text-emerald-700 hover:underline"
                        title="Adicionar aluno"
                        onClick={() => openAlunoModal(t)}
                      >
                        Aluno
                      </button>
                      <button
                        className="inline-flex items-center gap-1 text-[13px] text-indigo-700 hover:underline"
                        title="Atribuir professor"
                        onClick={() => openProfModal(t)}
                      >
                        Professor
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal — Editar turma */}
      {showEditModal && (
        <Modal onClose={() => setShowEditModal(false)} title="Editar turma">
          <form onSubmit={confirmarEdicao} className="space-y-3">
            <div>
              <label className="block text-[13px] text-slate-600 mb-1">Nome</label>
              <input
                autoFocus
                className="w-full h-9 px-3 rounded-md border border-slate-300 text-[14px]"
                value={editForm.name}
                onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[13px] text-slate-600 mb-1">Nível</label>
                <select
                  className="w-full h-9 px-3 rounded-md border border-slate-300 text-[14px]"
                  value={editForm.level}
                  onChange={e => setEditForm(f => ({ ...f, level: e.target.value }))}
                >
                  <option>K1</option><option>K2</option><option>K3</option>
                  <option>K4</option><option>KP1</option><option>KP2</option>
                </select>
              </div>
              <div>
                <label className="block text-[13px] text-slate-600 mb-1">Capacidade (1 a 3)</label>
                <input
                  type="number" min={1} max={3}
                  className="w-full h-9 px-3 rounded-md border border-slate-300 text-[14px]"
                  value={editForm.capacity}
                  onChange={e => setEditForm(f => ({ ...f, capacity: e.target.value }))}
                />
              </div>
            </div>
            {/* Lista de alunos com nome e botão Remover */}
            {editForm.students && editForm.students.length > 0 && (
              <div>
                <label className="block text-[13px] text-slate-600 mb-1">Alunos da turma</label>
                <ul className="space-y-1">
                  {editForm.students.map(aluno => {
                    const alunoInfo = alunos.find(a => a.id === aluno.id)
                    return (
                      <li key={aluno.id} className="flex items-center gap-2">
                        <span>
                          {alunoInfo
                            ? `${alunoInfo.name} (${aluno.id})`
                            : aluno.id}
                        </span>
                        <button
                          type="button"
                          className="text-xs text-red-600 hover:underline"
                          disabled={actionBusy}
                          onClick={() => handleRemoverAlunoModal(aluno.id)}
                        >
                          Remover
                        </button>
                      </li>
                    )
                  })}
                </ul>
              </div>
            )}
            <div>
              <label className="block text-[13px] text-slate-600 mb-1">Status</label>
              <select
                className="w-full h-9 px-3 rounded-md border border-slate-300 text-[14px]"
                value={editForm.status}
                onChange={e => setEditForm(f => ({ ...f, status: e.target.value }))}
              >
                <option value="active">active</option>
                <option value="paused">paused</option>
                <option value="closed">closed</option>
              </select>
            </div>
            {editErr && <div className="text-[13px] text-red-600">{editErr}</div>}
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setShowEditModal(false)} className="h-9 px-3 rounded-md border border-slate-300 text-[14px]">
                Cancelar
              </button>
              <button
                type="submit"
                disabled={editBusy}
                className="h-9 px-3 rounded-md bg-blue-700 text-white text-[14px] disabled:opacity-60"
              >
                {editBusy ? 'Salvando…' : 'Salvar'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Modal — Adicionar aluno */}
      {showAlunoModal && (
        <Modal onClose={() => setShowAlunoModal(false)} title={`Adicionar aluno — ${targetTurma?.name}`}>
          <form onSubmit={confirmarAddAluno} className="space-y-3">
            <div>
              <label className="block text-[13px] text-slate-600 mb-1">Selecione o aluno</label>
              {alunosLoading ? (
                <div className="text-[13px] text-slate-500">Carregando alunos…</div>
              ) : (
                <select
                  className="w-full h-9 px-3 rounded-md border border-slate-300 text-[14px]"
                  value={studentId}
                  onChange={e => setStudentId(e.target.value)}
                  autoFocus
                >
                  <option value="">Selecione um aluno</option>
                  {alunos.map(aluno => (
                    <option key={aluno.id} value={aluno.id}>
                      {aluno.name} ({aluno.id})
                    </option>
                  ))}
                </select>
              )}
            </div>
            {actionError && <div className="text-[13px] text-red-600">{actionError}</div>}
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setShowAlunoModal(false)} className="h-9 px-3 rounded-md border border-slate-300 text-[14px]">
                Cancelar
              </button>
              <button type="submit" disabled={actionBusy} className="h-9 px-3 rounded-md bg-emerald-700 text-white text-[14px] disabled:opacity-60">
                {actionBusy ? 'Adicionando…' : 'Adicionar'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Modal — Atribuir professor */}
      {showProfModal && (
        <Modal onClose={() => setShowProfModal(false)} title={`Atribuir professor — ${targetTurma?.name}`}>
          <form onSubmit={confirmarAddProfessor} className="space-y-3">
            <div>
              <label className="block text-[13px] text-slate-600 mb-1">Selecione o professor</label>
              {professoresLoading ? (
                <div className="text-[13px] text-slate-500">Carregando professores…</div>
              ) : (
                <select
                  className="w-full h-9 px-3 rounded-md border border-slate-300 text-[14px]"
                  value={teacherId}
                  onChange={e => setTeacherId(e.target.value)}
                  autoFocus
                >
                  <option value="">Selecione um professor</option>
                  {professores.map(prof => (
                    <option key={prof.id} value={prof.id}>
                      {prof.name} ({prof.id})
                    </option>
                  ))}
                </select>
              )}
            </div>
            <div>
              <label className="block text-[13px] text-slate-600 mb-1">Papel</label>
              <select
                className="w-full h-9 px-3 rounded-md border border-slate-300 text-[14px]"
                value={papel}
                onChange={e => setPapel(e.target.value)}
              >
                <option value="titular">titular</option>
                <option value="sub">sub</option>
              </select>
            </div>
            {actionError && <div className="text-[13px] text-red-600">{actionError}</div>}
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setShowProfModal(false)} className="h-9 px-3 rounded-md border border-slate-300 text-[14px]">
                Cancelar
              </button>
              <button type="submit" disabled={actionBusy} className="h-9 px-3 rounded-md bg-indigo-700 text-white text-[14px] disabled:opacity-60">
                {actionBusy ? 'Atribuindo…' : 'Atribuir'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}

/* Modal simples em-line (sem libs externas) */
function Modal({ title, children, onClose }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-xl shadow-lg border border-slate-200 w-full max-w-md mx-4">
        <div className="px-5 py-3 border-b border-slate-200 flex items-center justify-between">
          <h3 className="text-[16px] font-semibold text-slate-900">{title}</h3>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-700 text-[20px] leading-none">×</button>
        </div>
        <div className="px-5 py-4">{children}</div>
      </div>
    </div>
  )
}