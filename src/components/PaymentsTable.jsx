'use client'
import { useEffect, useState, useMemo } from 'react'
import { Dialog } from '@headlessui/react'
import { CheckCircleIcon, XMarkIcon } from '@heroicons/react/24/outline'
import { supabase } from '@/lib/supabaseClient'

export default function PaymentsTable() {
  const [payments, setPayments] = useState([])
  const [students, setStudents] = useState([])
  const [payers, setPayers] = useState([])
  const [loading, setLoading] = useState(true)
  const [month, setMonth] = useState(() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  })

  // Modal states
  const [showIndividualModal, setShowIndividualModal] = useState(false)
  const [showGroupModal, setShowGroupModal] = useState(false)
  const [searchAluno, setSearchAluno] = useState('')
  const [searchPayer, setSearchPayer] = useState('')
  const [processing, setProcessing] = useState(false)
  const [successMsg, setSuccessMsg] = useState('')

  // Modal de edição
  const [editPayment, setEditPayment] = useState(null)
  const [editDate, setEditDate] = useState('')
  const [editAmount, setEditAmount] = useState('')

  useEffect(() => {
    async function load() {
      setLoading(true)
      const { data: studentsData } = await supabase.from('students').select('id, name, payer')
      setStudents(studentsData || [])
      const { data: payersData } = await supabase.from('payers').select('id, name')
      setPayers(payersData || [])
      const { data: paymentsData } = await supabase
        .from('payments')
        .select('id, student_id, amount, due_date, payment_date, status')
        .eq('ref_month', month)
      setPayments(paymentsData || [])
      setLoading(false)
    }
    load()
  }, [month])

  const studentsMap = useMemo(() => {
    const map = {}
    students.forEach(s => { map[s.id] = s })
    return map
  }, [students])

  // Alunos ativos sem pagador (para pgto individual)
  const alunosIndividuais = useMemo(() =>
    students.filter(s => !s.payer && s.name?.toLowerCase().includes(searchAluno.toLowerCase()))
  , [students, searchAluno])

  // Pagadores disponíveis (tem alunos pendentes)
  const pagadoresDisponiveis = useMemo(() => {
    const pendentes = payments.filter(p => p.status !== 'Pago')
    const pagadoresSet = new Set()
    pendentes.forEach(p => {
      const aluno = studentsMap[p.student_id]
      if (aluno && aluno.payer) pagadoresSet.add(aluno.payer)
    })
    return payers
      .filter(p => pagadoresSet.has(p.id) && p.name?.toLowerCase().includes(searchPayer.toLowerCase()))
  }, [payments, studentsMap, payers, searchPayer])

  // Marcar pagamento individual
  async function pagarIndividual(studentId) {
    setProcessing(true)
    const pagamento = payments.find(p => p.student_id === studentId && p.status !== 'Pago')
    if (!pagamento) {
      setProcessing(false)
      return
    }
    await supabase.from('payments').update({
      status: 'Pago',
      payment_date: new Date().toISOString().slice(0, 10)
    }).eq('id', pagamento.id)
    setPayments(payments =>
      payments.map(p => p.id === pagamento.id
        ? { ...p, status: 'Pago', payment_date: new Date().toISOString().slice(0, 10) }
        : p
      )
    )
    setProcessing(false)
    setSuccessMsg('Pagamento individual realizado com sucesso!')
    setShowIndividualModal(false)
    setTimeout(() => setSuccessMsg(''), 2500)
  }

  // Marcar grupo como pago
  async function pagarGrupo(payerId) {
    setProcessing(true)
    const alunos = students.filter(s => s.payer === payerId).map(s => s.id)
    const pendentes = payments.filter(p => alunos.includes(p.student_id) && p.status !== 'Pago')
    const ids = pendentes.map(p => p.id)
    if (ids.length === 0) {
      setProcessing(false)
      return
    }
    await supabase.from('payments').update({
      status: 'Pago',
      payment_date: new Date().toISOString().slice(0, 10)
    }).in('id', ids)
    setPayments(payments =>
      payments.map(p => ids.includes(p.id)
        ? { ...p, status: 'Pago', payment_date: new Date().toISOString().slice(0, 10) }
        : p
      )
    )
    setProcessing(false)
    setSuccessMsg('Pagamentos do grupo realizados com sucesso!')
    setShowGroupModal(false)
    setTimeout(() => setSuccessMsg(''), 2500)
  }

  // Função para desfazer pagamento
  async function handleUndo(paymentId) {
    await supabase.from('payments').update({
      status: 'Pendente',
      payment_date: null
    }).eq('id', paymentId)
    setPayments(payments =>
      payments.map(p =>
        p.id === paymentId
          ? { ...p, status: 'Pendente', payment_date: null }
          : p
      )
    )
  }

  // Função para editar pagamento (abre modal)
  function handleEdit(payment) {
    setEditPayment(payment)
    setEditDate(payment.payment_date || '')
    setEditAmount(payment.amount || '')
  }

  // Salvar edição do pagamento
  async function handleEditSave() {
    await supabase.from('payments').update({
      payment_date: editDate,
      amount: Number(editAmount)
    }).eq('id', editPayment.id)
    setPayments(payments =>
      payments.map(p =>
        p.id === editPayment.id
          ? { ...p, payment_date: editDate, amount: Number(editAmount) }
          : p
      )
    )
    setEditPayment(null)
  }

  // Função para excluir
  async function handleDelete(paymentId) {
    if (!window.confirm('Tem certeza que deseja excluir este pagamento?')) return
    await supabase.from('payments').delete().eq('id', paymentId)
    setPayments(payments => payments.filter(p => p.id !== paymentId))
  }

  return (
    <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 relative">
      <h2 className="text-xl font-bold mb-6 text-slate-800">Controle de Mensalidades</h2>
      <div className="flex flex-col sm:flex-row justify-between items-center mb-4 gap-4">
        <select
          className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
          value={month}
          onChange={e => setMonth(e.target.value)}
        >
          {Array.from({ length: 12 }).map((_, i) => {
            const d = new Date()
            d.setMonth(d.getMonth() - i)
            const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
            const label = d.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
            return <option key={value} value={value}>{label}</option>
          })}
        </select>
        <div className="flex gap-2 w-full sm:w-auto">
          <button
            className="bg-blue-700 text-white font-semibold px-4 py-2 rounded-lg hover:bg-blue-800 transition-colors"
            onClick={() => setShowIndividualModal(true)}
          >
            Pgto. Individual
          </button>
          <button
            className="bg-green-700 text-white font-semibold px-4 py-2 rounded-lg hover:bg-green-800 transition-colors"
            onClick={() => setShowGroupModal(true)}
          >
            Pgto. de Grupo
          </button>
        </div>
      </div>

      {/* Feedback visual */}
      {successMsg && (
        <div className="absolute top-4 right-4 flex items-center gap-2 bg-green-100 border border-green-300 text-green-800 px-4 py-2 rounded shadow z-50">
          <CheckCircleIcon className="w-5 h-5" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Modal de edição */}
      <Dialog open={!!editPayment} onClose={() => setEditPayment(null)} className="relative z-50">
        <div className="fixed inset-0 bg-black/30" aria-hidden="true" />
        <div className="fixed inset-0 flex items-center justify-center p-4">
          <Dialog.Panel className="bg-white rounded-lg p-6 shadow-lg w-full max-w-md">
            <Dialog.Title className="font-bold text-lg mb-2">
              Editar Pagamento
            </Dialog.Title>
            {editPayment && (
              <div className="mb-4 text-slate-700 font-semibold">
                {studentsMap[editPayment.student_id]?.name}
              </div>
            )}
            <div className="mb-3">
              <label className="block text-sm mb-1">Data do Pagamento</label>
              <input
                type="date"
                className="w-full border rounded px-3 py-2"
                value={editDate || ''}
                onChange={e => setEditDate(e.target.value)}
              />
            </div>
            <div className="mb-3">
              <label className="block text-sm mb-1">Valor</label>
              <input
                type="number"
                className="w-full border rounded px-3 py-2"
                value={editAmount}
                onChange={e => setEditAmount(e.target.value)}
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                className="px-4 py-2 rounded bg-gray-200 text-slate-700"
                onClick={() => setEditPayment(null)}
              >
                Cancelar
              </button>
              <button
                className="px-4 py-2 rounded bg-orange-600 text-white font-semibold hover:bg-orange-700"
                onClick={handleEditSave}
              >
                Salvar
              </button>
            </div>
          </Dialog.Panel>
        </div>
      </Dialog>

      {/* Modal Individual */}
      <Dialog open={showIndividualModal} onClose={() => setShowIndividualModal(false)} className="relative z-50">
        <div className="fixed inset-0 bg-black/30" aria-hidden="true" />
        <div className="fixed inset-0 flex items-center justify-center p-4">
          <Dialog.Panel className="bg-white rounded-lg p-6 shadow-lg w-full max-w-md">
            <div className="flex justify-between items-center mb-4">
              <Dialog.Title className="font-bold text-lg">Pagamento Individual</Dialog.Title>
              <button onClick={() => setShowIndividualModal(false)}>
                <XMarkIcon className="w-6 h-6 text-slate-400 hover:text-slate-600" />
              </button>
            </div>
            <input
              type="text"
              className="w-full border border-slate-300 rounded px-2 py-1 mb-3 text-sm"
              placeholder="Buscar aluno..."
              value={searchAluno}
              onChange={e => setSearchAluno(e.target.value)}
              autoFocus
            />
            <ul className="max-h-60 overflow-y-auto">
              {alunosIndividuais.map(aluno => (
                <li key={aluno.id} className="mb-2 flex justify-between items-center">
                  <span>{aluno.name}</span>
                  <button
                    className="bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700 text-xs disabled:opacity-60"
                    disabled={processing}
                    onClick={() => pagarIndividual(aluno.id)}
                  >
                    {processing ? 'Processando...' : 'Pagar'}
                  </button>
                </li>
              ))}
              {alunosIndividuais.length === 0 && (
                <li className="text-slate-500">Nenhum aluno disponível</li>
              )}
            </ul>
          </Dialog.Panel>
        </div>
      </Dialog>

      {/* Modal Grupo */}
      <Dialog open={showGroupModal} onClose={() => setShowGroupModal(false)} className="relative z-50">
        <div className="fixed inset-0 bg-black/30" aria-hidden="true" />
        <div className="fixed inset-0 flex items-center justify-center p-4">
          <Dialog.Panel className="bg-white rounded-lg p-6 shadow-lg w-full max-w-md">
            <div className="flex justify-between items-center mb-4">
              <Dialog.Title className="font-bold text-lg">Pagamento de Grupo</Dialog.Title>
              <button onClick={() => setShowGroupModal(false)}>
                <XMarkIcon className="w-6 h-6 text-slate-400 hover:text-slate-600" />
              </button>
            </div>
            <input
              type="text"
              className="w-full border border-slate-300 rounded px-2 py-1 mb-3 text-sm"
              placeholder="Buscar responsável..."
              value={searchPayer}
              onChange={e => setSearchPayer(e.target.value)}
              autoFocus
            />
            <ul className="max-h-60 overflow-y-auto">
              {pagadoresDisponiveis.map(payer => (
                <li key={payer.id} className="mb-2 flex justify-between items-center">
                  <span>{payer.name}</span>
                  <button
                    className="bg-green-600 text-white px-3 py-1 rounded hover:bg-green-700 text-xs disabled:opacity-60"
                    disabled={processing}
                    onClick={() => pagarGrupo(payer.id)}
                  >
                    {processing ? 'Processando...' : 'Pagar Grupo'}
                  </button>
                </li>
              ))}
              {pagadoresDisponiveis.length === 0 && (
                <li className="text-slate-500">Nenhum responsável disponível</li>
              )}
            </ul>
          </Dialog.Panel>
        </div>
      </Dialog>

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Aluno</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Vencimento</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Status</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Valor</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Data Pagamento</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Ações</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-slate-200">
            {loading ? (
              <tr>
                <td colSpan={6} className="text-center py-8 text-slate-500">Carregando...</td>
              </tr>
            ) : payments.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-center py-8 text-slate-500">Nenhum pagamento encontrado.</td>
              </tr>
            ) : (
              payments.map((p) => {
                const student = studentsMap[p.student_id] || {}
                const isPago = p.status === 'Pago'
                const isPendente = p.status !== 'Pago'
                const dueDate = p.due_date ? new Date(p.due_date) : null
                const today = new Date()
                today.setHours(0,0,0,0)
                const isAtrasado = isPendente && dueDate && dueDate < today
                const isVencendo = isPendente && dueDate && dueDate >= today && dueDate <= new Date(today.getTime() + 5 * 24 * 60 * 60 * 1000)

                return (
                  <tr key={p.id} className="hover:bg-slate-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-slate-900">{student.name}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">{dueDate ? dueDate.toLocaleDateString('pt-BR') : '--'}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      {isPago ? (
                        <span className="bg-green-100 text-green-700 px-2 py-1 rounded-full text-xs">Pago</span>
                      ) : isAtrasado ? (
                        <span className="bg-red-100 text-red-700 px-2 py-1 rounded-full text-xs">Atrasado</span>
                      ) : isVencendo ? (
                        <span className="bg-orange-100 text-orange-700 px-2 py-1 rounded-full text-xs">Vencendo</span>
                      ) : (
                        <span className="bg-yellow-100 text-yellow-700 px-2 py-1 rounded-full text-xs">Pendente</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      {p.amount !== undefined && p.amount !== null
                        ? p.amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
                        : '—'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">{p.payment_date ? new Date(p.payment_date).toLocaleDateString('pt-BR') : '—'}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                      <button
                        className="text-orange-600 hover:underline"
                        onClick={() => handleEdit(p)}
                      >
                        Editar
                      </button>
                      <button
                        className="text-red-600 hover:underline"
                        onClick={() => handleDelete(p.id)}
                      >
                        Excluir
                      </button>
                      {p.status === 'Pago' && (
                        <button
                          className="text-blue-600 hover:underline"
                          onClick={() => handleUndo(p.id)}
                        >
                          Desfazer
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}