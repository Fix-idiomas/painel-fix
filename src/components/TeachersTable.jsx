'use client'
import { useEffect, useState, useMemo } from 'react'
import { supabase } from '@/lib/supabaseClient'

export default function TeachersTable() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [teachers, setTeachers] = useState([])
  const [search, setSearch] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editId, setEditId] = useState(null)
  const [studentsCount, setStudentsCount] = useState({})

  const [form, setForm] = useState({
    name: '',
    contact: ''
  })

  // Carregar professores
  useEffect(() => {
    async function load() {
      setLoading(true)
      setError(null)
      const { data, error } = await supabase
        .from('teachers')
        .select('id, name, contact')
        .order('name', { ascending: true })
      if (error) setError(error.message)
      else setTeachers(data || [])
      setLoading(false)
    }
    load()
  }, [showModal])

  // Carregar contagem de alunos por professor (usando id)
  useEffect(() => {
    async function loadCounts() {
      const { data, error } = await supabase
        .from('students')
        .select('teacher')
      if (!error && data) {
        const counts = {}
        data.forEach(row => {
          if (row.teacher) {
            counts[row.teacher] = (counts[row.teacher] || 0) + 1
          }
        })
        setStudentsCount(counts)
      }
    }
    loadCounts()
  }, [teachers, showModal])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return teachers
    return teachers.filter(t =>
      (t.name || '').toLowerCase().includes(q) ||
      (t.contact || '').toLowerCase().includes(q)
    )
  }, [teachers, search])

  async function handleSubmit(e) {
    e.preventDefault()
    if (editId) {
      await supabase.from('teachers').update(form).eq('id', editId)
    } else {
      await supabase.from('teachers').insert([form])
    }
    setShowModal(false)
    setEditId(null)
    setForm({ name: '', contact: '' })
  }

  async function handleDelete(id) {
    if (window.confirm('Tem certeza que deseja excluir este professor?')) {
      await supabase.from('teachers').delete().eq('id', id)
      setTeachers(teachers => teachers.filter(t => t.id !== id))
    }
  }

  function handleEdit(t) {
    setForm({
      name: t.name || '',
      contact: t.contact || ''
    })
    setEditId(t.id)
    setShowModal(true)
  }

  function handleCloseModal() {
    setShowModal(false)
    setEditId(null)
    setForm({ name: '', contact: '' })
  }

  return (
    <div className="bg-white p-6 rounded-xl shadow-sm border">
      <div className="flex flex-col sm:flex-row justify-between items-center mb-4 gap-4">
        <h3 className="text-lg font-semibold text-slate-800">Cadastro de Professores</h3>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            type="text"
            placeholder="Buscar professor..."
            className="w-full sm:w-64 px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
          />
          <button
            className="bg-orange-600 text-white font-semibold px-4 py-2 rounded-lg hover:bg-orange-700 transition-colors"
            onClick={() => setShowModal(true)}
          >
            Novo Professor
          </button>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Nome</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Contato</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Alunos</th>
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
                <td colSpan={4} className="text-center py-8 text-slate-500">Nenhum professor encontrado.</td>
              </tr>
            )}
            {!loading && !error && filtered.map(t => (
              <tr key={t.id} className="hover:bg-slate-50">
                <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-slate-900">{t.name}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">{t.contact || '—'}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-800">
                  {studentsCount[t.id] || 0}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2">
                  <button
                    className="text-green-600 hover:underline"
                    title="Editar"
                    onClick={() => handleEdit(t)}
                  >
                    Editar
                  </button>
                  <button
                    className="text-red-600 hover:underline"
                    title="Excluir"
                    onClick={() => handleDelete(t.id)}
                  >
                    Excluir
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {/* Modal Novo Professor / Editar */}
      {showModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.06)', backdropFilter: 'blur(4px)' }}
        >
          <div className="bg-white rounded-xl shadow-xl p-8 w-full max-w-md relative">
            <h2 className="text-xl font-bold mb-6">
              {editId ? 'Editar Professor' : 'Adicionar Novo Professor'}
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
                type="text"
                placeholder="Contato (Telefone/WhatsApp)"
                className="w-full border rounded px-3 py-2"
                value={form.contact}
                onChange={e => setForm(f => ({ ...f, contact: e.target.value }))}
              />
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