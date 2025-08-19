'use client'
import { useEffect, useState } from 'react'
import { listarTurmas, criarTurma } from '@/lib/turmasApi'
import SendMailPanel from '@/components/SendMailPanel'


export default function TurmasPage() {
  const [turmas, setTurmas] = useState([])
  const [form, setForm] = useState({ name: '', level: 'K1', capacity: 3 })
  const [loading, setLoading] = useState(true)
  const [errorMsg, setErrorMsg] = useState('')

  async function carregar() {
    setLoading(true)
    setErrorMsg('')
    try {
      const data = await listarTurmas()
      setTurmas(data)
    } catch (err) {
      setErrorMsg(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { carregar() }, [])

  async function onCriar(e) {
    e.preventDefault()
    setErrorMsg('')
    if (!form.name) return setErrorMsg('Nome obrigatório')
    try {
      await criarTurma(form)
      setForm({ name: '', level: 'K1', capacity: 3 })
      await carregar()
    } catch (err) {
      setErrorMsg(err.message)
    }
  }

  return (
    <div className="max-w-4xl mx-auto py-8 px-4">
      <h1 className="text-2xl font-bold mb-6">Turmas</h1>
      <form onSubmit={onCriar} className="flex flex-wrap items-center gap-3 mb-6">
        <input
          className="h-9 px-3 rounded-md border border-slate-300 text-[14px] placeholder:text-slate-400 min-w-[180px]"
          value={form.name}
          onChange={e => setForm({ ...form, name: e.target.value })}
          placeholder="Nome da turma"
        />
        <select
          className="h-9 px-3 rounded-md border border-slate-300 text-[14px]"
          value={form.level}
          onChange={e => setForm({ ...form, level: e.target.value })}
        >
          <option>K1</option><option>K2</option><option>K3</option>
          <option>K4</option><option>KP1</option><option>KP2</option>
        </select>
        <input
          type="number" min={1} max={3}
          className="h-9 w-[72px] px-3 rounded-md border border-slate-300 text-[14px]"
          value={form.capacity}
          onChange={e => setForm({ ...form, capacity: Number(e.target.value) })}
        />
        <button
          type="submit"
          className="h-9 px-4 rounded-md bg-slate-900 text-white text-[14px]"
        >
          Criar
        </button>
        {errorMsg && <span className="text-red-600 text-sm ml-4">{errorMsg}</span>}
      </form>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 mb-8">
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
                </tr>
              </thead>
              <tbody>
                {turmas.map(t => (
                  <tr key={t.id} className="hover:bg-slate-50">
                    <td className="border-b px-4 py-2 font-medium text-slate-900">{t.name}</td>
                    <td className="border-b px-4 py-2">{t.level ?? '-'}</td>
                    <td className="border-b px-4 py-2">{t.capacity ?? '-'}</td>
                    <td className="border-b px-4 py-2">{t.active_students ?? 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Painel de envio de e-mail */}
      <SendMailPanel />
    </div>
  )
}