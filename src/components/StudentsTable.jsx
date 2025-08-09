'use client'
import { useEffect, useState, useMemo } from 'react'
import { supabase } from '@/lib/supabaseClient'

export default function StudentsTable({ onInactivate }) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [students, setStudents] = useState([])
  const [search, setSearch] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editId, setEditId] = useState(null)
  const [teachers, setTeachers] = useState([])
  const [payers, setPayers] = useState([])

  const [form, setForm] = useState({
    name: '',
    email: '',
    contact: '',
    address: '',
    dob: '',
    cpf: '',
    monthly_fee: '',
    due_day: '',
    teacher: '',
    payer: '',
    next_month: false,
    status: 'Ativo'
  })

  // Carrega alunos
  useEffect(() => {
    async function load() {
      setLoading(true)
      setError(null)
      const { data, error } = await supabase
        .from('students')
        .select('id, name, contact, monthly_fee, status, email, address, dob, cpf, due_day, teacher, payer, next_month')
        .eq('status', 'Ativo')
        .order('name', { ascending: true })
      if (error) setError(error.message)
      else setStudents(data || [])
      setLoading(false)
    }
    load()
  }, [showModal])

  // Carrega professores
  useEffect(() => {
    async function loadTeachers() {
      const { data, error } = await supabase
        .from('teachers')
        .select('id, name')
        .order('name', { ascending: true })
      if (!error) setTeachers(data || [])
    }
    loadTeachers()
  }, [showModal])

  // Carrega pagadores
  useEffect(() => {
    async function loadPayers() {
      const { data, error } = await supabase
        .from('payers')
        .select('id, name')
        .order('name', { ascending: true })
      if (!error) setPayers(data || [])
    }
    loadPayers()
  }, [showModal])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return students
    return students.filter(s =>
      (s.name || '').toLowerCase().includes(q) ||
      (s.contact || '').toLowerCase().includes(q)
    )
  }, [students, search])

  const currency = v =>
    Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

  async function handleSubmit(e) {
    e.preventDefault()
    const dataToSave = {
      name: form.name || null,
      email: form.email || null,
      contact: form.contact || null,
      address: form.address || null,
      dob: form.dob || null,
      cpf: form.cpf || null,
      monthly_fee: form.monthly_fee ? Number(form.monthly_fee) : null,
      due_day: form.due_day ? Number(form.due_day) : null,
      teacher: form.teacher ? Number(form.teacher) : null,
      payer: form.payer ? Number(form.payer) : null, // Aqui é o segredo!
      next_month: !!form.next_month,
      status: form.status || null
    }
    console.log('Salvando aluno:', dataToSave)
    if (editId) {
      await supabase.from('students').update(dataToSave).eq('id', editId)
    } else {
      await supabase.from('students').insert([dataToSave])
    }
    setShowModal(false)
    setEditId(null)
    setForm({
      name: '',
      email: '',
      contact: '',
      address: '',
      dob: '',
      cpf: '',
      monthly_fee: '',
      due_day: '',
      teacher: '',
      payer: '',
      next_month: false,
      status: 'Ativo'
    })
  }

  async function handleDelete(id) {
    if (window.confirm('Tem certeza que deseja excluir este aluno?')) {
      await supabase.from('students').delete().eq('id', id)
      setStudents(students => students.filter(s => s.id !== id))
    }
  }

  async function handleInactivate(id) {
    if (window.confirm('Tem certeza que deseja inativar este aluno?')) {
      await supabase.from('students').update({ status: 'Inativo' }).eq('id', id)
      setStudents(students => students.filter(s => s.id !== id))
      if (onInactivate) onInactivate()
    }
  }

  function handleEdit(st) {
    setForm({
      name: st.name || '',
      email: st.email || '',
      contact: st.contact || '',
      address: st.address || '',
      dob: st.dob || '',
      cpf: st.cpf || '',
      monthly_fee: st.monthly_fee || '',
      due_day: st.due_day || '',
      teacher: st.teacher ? String(st.teacher) : '',
      payer: st.payer ? String(st.payer) : '',
      next_month: st.next_month || false,
      status: st.status || 'Ativo'
    })
    setEditId(st.id)
    setShowModal(true)
  }

  function handleCloseModal() {
    setShowModal(false)
    setEditId(null)
    setForm({
      name: '',
      email: '',
      contact: '',
      address: '',
      dob: '',
      cpf: '',
      monthly_fee: '',
      due_day: '',
      teacher: '',
      payer: '',
      next_month: false,
      status: 'Ativo'
    })
  }

  return (
    <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
      <div className="flex flex-col sm:flex-row justify-between items-center mb-4 gap-4">
        <h3 className="text-lg font-semibold text-slate-800">Cadastro de Alunos Ativos</h3>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            type="text"
            placeholder="Buscar aluno..."
            className="w-full sm:w-64 px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
          />
          <button
            className="bg-orange-600 text-white font-semibold px-4 py-2 rounded-lg hover:bg-orange-700 transition-colors"
            onClick={() => setShowModal(true)}
          >
            Novo Aluno
          </button>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Nome</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Contato</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Valor Mensal</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Ações</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-slate-200">
            {loading && (
              <tr>
                <td colSpan={4} className="text-center py-8 text-slate-500">Carregando...</td>
              </tr>
            )}
            {error && !loading && (
              <tr>
                <td colSpan={4} className="text-center py-8 text-red-600">Erro: {error}</td>
              </tr>
            )}
            {!loading && !error && filtered.length === 0 && (
              <tr>
                <td colSpan={4} className="text-center py-8 text-slate-500">Nenhum aluno ativo encontrado.</td>
              </tr>
            )}
            {!loading && !error && filtered.map(st => (
              <tr key={st.id} className="hover:bg-slate-50">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm font-semibold text-slate-900">{st.name}</div>
                  <div className="text-xs text-slate-500">{st.status}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">{st.contact || '—'}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-800">
                  {currency(st.monthly_fee)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2">
                  <button
                    className="text-green-600 hover:underline"
                    title="Editar"
                    onClick={() => handleEdit(st)}
                  >
                    Editar
                  </button>
                  <button
                    className="text-red-600 hover:underline"
                    title="Excluir"
                    onClick={() => handleDelete(st.id)}
                  >
                    Excluir
                  </button>
                  <button
                    className="text-orange-600 hover:underline"
                    title="Inativar"
                    onClick={() => handleInactivate(st.id)}
                  >
                    Inativar
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {showModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.06)', backdropFilter: 'blur(4px)' }}
        >
          <div className="bg-white rounded-xl shadow-xl p-8 w-full max-w-md relative">
            <h2 className="text-xl font-bold mb-6">
              {editId ? 'Editar Aluno' : 'Adicionar Novo Aluno'}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-3">
              <input
                type="text"
                placeholder="Nome completo"
                className="w-full border rounded px-3 py-2"
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                required
              />
              <input
                type="email"
                placeholder="E-mail"
                className="w-full border rounded px-3 py-2"
                value={form.email}
                onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
              />
              <input
                type="text"
                placeholder="Contato (Telefone/WhatsApp)"
                className="w-full border rounded px-3 py-2"
                value={form.contact}
                onChange={e => setForm(f => ({ ...f, contact: e.target.value }))}
              />
              <input
                type="text"
                placeholder="Endereço completo"
                className="w-full border rounded px-3 py-2"
                value={form.address}
                onChange={e => setForm(f => ({ ...f, address: e.target.value }))}
              />
              <div className="flex gap-2">
                <input
                  type="date"
                  className="w-1/2 border rounded px-3 py-2"
                  value={form.dob}
                  onChange={e => setForm(f => ({ ...f, dob: e.target.value }))}
                />
                <input
                  type="text"
                  placeholder="CPF"
                  className="w-1/2 border rounded px-3 py-2"
                  value={form.cpf}
                  onChange={e => setForm(f => ({ ...f, cpf: e.target.value }))}
                />
              </div>
              <div className="flex gap-2">
                <input
                  type="number"
                  placeholder="Valor Mensalidade"
                  className="w-1/2 border rounded px-3 py-2"
                  value={form.monthly_fee}
                  onChange={e => setForm(f => ({ ...f, monthly_fee: e.target.value }))}
                />
                <input
                  type="number"
                  placeholder="Dia Vencimento"
                  className="w-1/2 border rounded px-3 py-2"
                  value={form.due_day}
                  onChange={e => setForm(f => ({ ...f, due_day: e.target.value }))}
                />
              </div>
              <select
                className="w-full border rounded px-3 py-2"
                value={form.teacher}
                onChange={e => setForm(f => ({ ...f, teacher: e.target.value }))}
              >
                <option value="">Professor</option>
                {teachers.map(t => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
              <select
                className="w-full border rounded px-3 py-2"
                value={form.payer}
                onChange={e => setForm(f => ({ ...f, payer: e.target.value }))}
              >
                <option value="">O próprio aluno</option>
                {payers.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={form.next_month}
                  onChange={e => setForm(f => ({ ...f, next_month: e.target.checked }))}
                />
                Primeiro pagamento no próximo mês
              </label>
              <select
                className="w-full border rounded px-3 py-2"
                value={form.status}
                onChange={e => setForm(f => ({ ...f, status: e.target.value }))}
              >
                <option value="Ativo">Ativo</option>
                <option value="Inativo">Inativo</option>
              </select>
              <div className="flex justify-end gap-2 mt-4">
                <button
                  type="button"
                  className="px-4 py-2 rounded bg-gray-200 text-slate-700"
                  onClick={handleCloseModal}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded bg-orange-600 text-white font-semibold hover:bg-orange-700"
                >
                  Salvar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}