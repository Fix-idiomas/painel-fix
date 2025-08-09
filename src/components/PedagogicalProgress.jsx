'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'

export default function PedagogicalProgress() {
  const [students, setStudents] = useState([])
  const [selectedStudent, setSelectedStudent] = useState('')
  const [progress, setProgress] = useState([])
  const [loading, setLoading] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ date: '', description: '', attendance: '' })
  const [saving, setSaving] = useState(false)

  // Buscar alunos ativos
  useEffect(() => {
    async function fetchStudents() {
      const { data, error } = await supabase
        .from('students')
        .select('id, name')
        .eq('status', 'Ativo')
        .order('name', { ascending: true })
      if (!error && data) setStudents(data)
    }
    fetchStudents()
  }, [])

  // Buscar evolução do aluno selecionado
  useEffect(() => {
    if (!selectedStudent) {
      setProgress([])
      return
    }
    setLoading(true)
    supabase
      .from('pedagogical_progress')
      .select('id, date, description, attendance')
      .eq('student_id', selectedStudent)
      .order('date', { ascending: false })
      .then(({ data }) => {
        setProgress(data || [])
        setLoading(false)
      })
  }, [selectedStudent])

  // Adicionar novo registro
  async function handleAdd(e) {
    e.preventDefault()
    if (!form.date || !form.description || !form.attendance) return
    setSaving(true)
    const { data, error } = await supabase
      .from('pedagogical_progress')
      .insert([{
        student_id: selectedStudent,
        date: form.date,
        description: form.description,
        attendance: form.attendance
      }])
      .select()
      .single()
    setSaving(false)
    if (!error && data) {
      setProgress([data, ...progress])
      setShowForm(false)
      setForm({ date: '', description: '', attendance: '' })
    } else {
      alert('Erro ao salvar!')
    }
  }

  // Excluir registro
  async function handleDelete(id) {
    if (!window.confirm('Tem certeza que deseja excluir este registro?')) return
    await supabase.from('pedagogical_progress').delete().eq('id', id)
    setProgress(progress => progress.filter(p => p.id !== id))
  }

  return (
    <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 gap-4">
        <h2 className="text-lg font-semibold text-slate-800 mb-0">Evolução Pedagógica</h2>
        <div className="flex gap-2">
          <button className="bg-purple-600 hover:bg-purple-700 text-white font-semibold px-5 py-2 rounded transition">
            Analisar Evolução <span role="img" aria-label="sparkles">✨</span>
          </button>
          <button
            className="bg-orange-600 hover:bg-orange-700 text-white font-semibold px-5 py-2 rounded transition"
            onClick={() => setShowForm(true)}
            disabled={!selectedStudent}
          >
            Novo Registro
          </button>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-4 mb-4 items-center">
        <select
          className="border rounded px-4 py-2 min-w-[250px]"
          value={selectedStudent}
          onChange={e => setSelectedStudent(e.target.value)}
        >
          <option value="">Selecione um aluno</option>
          {students.map(s => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
      </div>

      {/* Formulário para novo registro */}
      {showForm && (
        <form
          className="bg-slate-50 border rounded-lg p-4 mb-4 flex flex-col gap-2"
          onSubmit={handleAdd}
        >
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="date"
              className="border rounded px-3 py-2"
              value={form.date}
              onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
              required
            />
            <select
              className="border rounded px-3 py-2"
              value={form.attendance}
              onChange={e => setForm(f => ({ ...f, attendance: e.target.value }))}
              required
            >
              <option value="">Presença/Falta</option>
              <option value="presente">Presente</option>
              <option value="falta">Falta</option>
            </select>
            <input
              type="text"
              className="border rounded px-3 py-2 flex-1"
              placeholder="Descrição"
              value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              required
            />
          </div>
          <div className="flex gap-2 mt-2">
            <button
              type="submit"
              className="bg-green-600 hover:bg-green-700 text-white font-semibold px-5 py-2 rounded transition"
              disabled={saving}
            >
              Salvar
            </button>
            <button
              type="button"
              className="bg-slate-200 hover:bg-slate-300 text-slate-700 font-semibold px-5 py-2 rounded transition"
              onClick={() => setShowForm(false)}
              disabled={saving}
            >
              Cancelar
            </button>
          </div>
        </form>
      )}

      <div>
        {loading && <div className="text-slate-500">Carregando...</div>}
        {!loading && progress.length === 0 && selectedStudent && (
          <div className="text-slate-500">Nenhum registro encontrado.</div>
        )}
        {progress.map(reg => (
          <div
            key={reg.id}
            className="bg-slate-50 rounded-lg p-4 mb-3 border flex flex-col sm:flex-row sm:items-center"
          >
            <div className="flex-1">
              <div className="font-semibold mb-1 flex gap-2 items-center">
                {new Date(reg.date).toLocaleDateString('pt-BR')}
                {reg.attendance && (
                  <span className={
                    reg.attendance === 'presente'
                      ? 'bg-green-100 text-green-700 px-2 py-0.5 rounded text-xs'
                      : 'bg-red-100 text-red-700 px-2 py-0.5 rounded text-xs'
                  }>
                    {reg.attendance === 'presente' ? 'Presente' : 'Falta'}
                  </span>
                )}
              </div>
              <div className="text-slate-700">{reg.description}</div>
            </div>
            <button
              className="text-red-500 font-semibold ml-0 sm:ml-4 mt-2 sm:mt-0"
              onClick={() => handleDelete(reg.id)}
            >
              Excluir
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}