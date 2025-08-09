'use client'
import { useEffect, useState, useMemo } from 'react'
import { supabase } from '@/lib/supabaseClient'

export default function InactiveStudentsTable({ refreshKey }) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [students, setStudents] = useState([])
  const [search, setSearch] = useState('')
  const [reactivatingId, setReactivatingId] = useState(null)
  const [reactivateError, setReactivateError] = useState(null)

  useEffect(() => {
    async function load() {
      setLoading(true)
      setError(null)
      const { data, error } = await supabase
        .from('students')
        .select('id, name, contact, monthly_fee, status')
        .eq('status', 'Inativo')
        .order('name', { ascending: true })
      if (error) setError(error.message)
      else setStudents(data || [])
      setLoading(false)
    }
    load()
  }, [refreshKey])

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

  // Função para reativar aluno com proteção e feedback
  async function handleReactivate(id) {
    setReactivatingId(id)
    setReactivateError(null)
    const { error } = await supabase.from('students').update({ status: 'Ativo' }).eq('id', id)
    if (error) {
      setReactivateError('Erro ao reativar aluno.')
    } else {
      setStudents(students => students.filter(s => s.id !== id))
    }
    setReactivatingId(null)
  }

  return (
    <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
      <div className="flex flex-col sm:flex-row justify-between items-center mb-4 gap-4">
        <h3 className="text-lg font-semibold text-slate-800">Cadastro de Alunos Inativos</h3>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          type="text"
          placeholder="Buscar aluno..."
          className="w-full sm:w-64 px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
        />
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
                <td colSpan={4} className="text-center py-8 text-slate-500">Nenhum aluno inativo encontrado.</td>
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
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  <button
                    className="text-green-600 hover:underline disabled:opacity-50"
                    title="Reativar"
                    onClick={() => handleReactivate(st.id)}
                    disabled={reactivatingId === st.id}
                  >
                    {reactivatingId === st.id ? 'Reativando...' : 'Reativar'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {reactivateError && (
          <div className="text-red-600 text-sm mt-2">{reactivateError}</div>
        )}
      </div>
    </div>
  )
}      