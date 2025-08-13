'use client'
import { useEffect, useMemo, useState } from 'react'
import { Dialog } from '@headlessui/react'
import { CheckCircleIcon, XMarkIcon } from '@heroicons/react/24/outline'
import { supabase } from '@/lib/supabaseClient'

// Status canônicos do banco
const PaymentStatus = {
  OPEN: 'open',
  PAID: 'paid',
  CANCELED: 'canceled',
}

// Normaliza qualquer valor vindo do banco (legados/pt-br) para os canônicos
const norm = (s) => {
  const v = String(s ?? '').trim().toLowerCase()
  if (v === 'pago' || v === 'paid') return PaymentStatus.PAID
  if (v === 'cancelado' || v === 'cancelada' || v === 'canceled')
    return PaymentStatus.CANCELED
  // pendente/pending/open → open
  return PaymentStatus.OPEN
}

export default function PaymentsTable({ orgId, refreshKey = 0, onChange }) {
  const [payments, setPayments] = useState([])
  const [students, setStudents] = useState([])
  const [payers, setPayers] = useState([])
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState(false)
  const [showCanceled, setShowCanceled] = useState(false)
  const [successMsg, setSuccessMsg] = useState('')

  const [month, setMonth] = useState(() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  })
// === opções do seletor de meses (passado e futuro) ===
const yyyymm = (d) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`

// quantos meses quer no passado e no futuro
const PAST_MONTHS = 12
const FUTURE_MONTHS = 12   // troque p/ 3, 6, etc. se preferir

const monthOptions = useMemo(() => {
  const base = new Date()
  const out = []
  // passado → futuro (inclui o mês atual quando i = 0)
  for (let i = -PAST_MONTHS; i <= FUTURE_MONTHS; i++) {
    const d = new Date(base.getFullYear(), base.getMonth() + i, 1)
    out.push({
      value: yyyymm(d),
      label: d.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }),
    })
  }
  return out
}, [])

  // Modal states
  const [showIndividualModal, setShowIndividualModal] = useState(false)
  const [showGroupModal, setShowGroupModal] = useState(false)
  const [searchAluno, setSearchAluno] = useState('')
  const [searchPayer, setSearchPayer] = useState('')

  // Edição
  const [editPayment, setEditPayment] = useState(null)
  const [editDate, setEditDate] = useState('')
  const [editAmount, setEditAmount] = useState('')

  // Carrega dados (org, mês, refresh)
  useEffect(() => {
    if (!orgId) return
    async function load() {
      setLoading(true)

      const sRes = await supabase
        .from('students')
        .select('id, name, status, payer')
        .eq('org_id', orgId)
        .eq('status', 'Ativo')
      if (!sRes.error) setStudents(sRes.data || [])

      const pRes = await supabase
        .from('payers')
        .select('id, name')
        .eq('org_id', orgId)
        .order('name', { ascending: true })
      if (!pRes.error) setPayers(pRes.data || [])

      const payRes = await supabase
        .from('payments')
        .select('id, student_id, amount, due_date, payment_date, status, ref_month')
        .eq('ref_month', month)
        .eq('org_id', orgId)
        .order('due_date', { ascending: true })
      if (!payRes.error) setPayments(payRes.data || [])

      setLoading(false)
    }
    load()
  }, [orgId, month, refreshKey])

  const studentsMap = useMemo(() => {
    const m = {}
    for (const s of students) m[s.id] = s
    return m
  }, [students])

  // Só mostra pagamentos de alunos ATIVOS; oculta cancelados se showCanceled = false
  const visiblePayments = useMemo(() => {
    return payments.filter((p) => {
      const st = studentsMap[p.student_id]
      if (!st) return false
      if (!showCanceled && norm(p.status) === PaymentStatus.CANCELED) return false
      return true
    })
  }, [payments, studentsMap, showCanceled])

  // Alunos ativos sem pagador (para pgto individual)
  const alunosIndividuais = useMemo(
    () =>
      students.filter(
        (s) => !s.payer && s.name?.toLowerCase().includes(searchAluno.toLowerCase())
      ),
    [students, searchAluno]
  )

  // Pagadores com algum pagamento aberto no mês
  const pagadoresDisponiveis = useMemo(() => {
    const pendentes = visiblePayments.filter((p) => norm(p.status) === PaymentStatus.OPEN)
    const pagadoresSet = new Set()
    pendentes.forEach((p) => {
      const aluno = studentsMap[p.student_id]
      if (aluno?.payer) pagadoresSet.add(aluno.payer)
    })
    return payers.filter(
      (p) => pagadoresSet.has(p.id) && p.name?.toLowerCase().includes(searchPayer.toLowerCase())
    )
  }, [visiblePayments, studentsMap, payers, searchPayer])

  // Helpers
  const callParent = () => {
    try {
      onChange?.()
    } catch {}
  }
  const today = (() => {
    const d = new Date()
    d.setHours(0, 0, 0, 0)
    return d
  })()
  const currency = (v) =>
    Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

  // Ações
  async function pagarIndividual(studentId) {
    setProcessing(true)
    const pagamento = visiblePayments.find(
      (p) => p.student_id === studentId && norm(p.status) !== PaymentStatus.PAID
    )
    if (!pagamento) {
      setProcessing(false)
      return
    }

    const todayStr = new Date().toISOString().slice(0, 10)
    const { error } = await supabase
      .from('payments')
      .update({
        status: PaymentStatus.PAID,
        payment_date: todayStr,
      })
      .eq('id', pagamento.id)

    if (error) {
      alert('Erro ao marcar como pago: ' + error.message)
      setProcessing(false)
      return
    }

    setPayments((ps) =>
      ps.map((p) =>
        p.id === pagamento.id ? { ...p, status: PaymentStatus.PAID, payment_date: todayStr } : p
      )
    )
    setProcessing(false)
    setSuccessMsg('Pagamento individual realizado com sucesso!')
    setShowIndividualModal(false)
    setTimeout(() => setSuccessMsg(''), 2200)
    callParent()
  }

  async function pagarGrupo(payerId) {
    setProcessing(true)
    const alunos = students.filter((s) => s.payer === payerId).map((s) => s.id)
    const pendentes = visiblePayments.filter(
      (p) => alunos.includes(p.student_id) && norm(p.status) === PaymentStatus.OPEN
    )
    const ids = pendentes.map((p) => p.id)
    if (ids.length === 0) {
      setProcessing(false)
      return
    }

    const todayStr = new Date().toISOString().slice(0, 10)
    const { error } = await supabase
      .from('payments')
      .update({
        status: PaymentStatus.PAID,
        payment_date: todayStr,
      })
      .in('id', ids)

    if (error) {
      alert('Erro ao pagar grupo: ' + error.message)
      setProcessing(false)
      return
    }

    setPayments((ps) =>
      ps.map((p) =>
        ids.includes(p.id) ? { ...p, status: PaymentStatus.PAID, payment_date: todayStr } : p
      )
    )
    setProcessing(false)
    setSuccessMsg('Pagamentos do grupo realizados com sucesso!')
    setShowGroupModal(false)
    setTimeout(() => setSuccessMsg(''), 2200)
    callParent()
  }

  async function handleUndo(paymentId) {
    const { error } = await supabase
      .from('payments')
      .update({
        status: PaymentStatus.OPEN,
        payment_date: null,
      })
      .eq('id', paymentId)

    if (error) {
      alert('Erro ao desfazer pagamento: ' + error.message)
      return
    }

    setPayments((ps) =>
      ps.map((p) =>
        p.id === paymentId ? { ...p, status: PaymentStatus.OPEN, payment_date: null } : p
      )
    )
    callParent()
  }

  function handleEdit(payment) {
    setEditPayment(payment)
    setEditDate(payment.payment_date || '')
    setEditAmount(payment.amount ?? '')
  }

  async function handleEditSave() {
    const { error } = await supabase
      .from('payments')
      .update({
        payment_date: editDate || null,
        amount: editAmount === '' ? null : Number(editAmount),
      })
      .eq('id', editPayment.id)

    if (error) {
      alert('Erro ao salvar edição: ' + error.message)
      return
    }

    setPayments((ps) =>
      ps.map((p) =>
        p.id === editPayment.id
          ? {
              ...p,
              payment_date: editDate || null,
              amount: editAmount === '' ? null : Number(editAmount),
            }
          : p
      )
    )
    setEditPayment(null)
    callParent()
  }

  // Cancelar / Restaurar (soft delete)
  async function handleCancel(paymentId) {
    if (!window.confirm('Cancelar este pagamento? Ele será ignorado nos relatórios.')) return

    const { error } = await supabase
      .from('payments')
      .update({
        status: PaymentStatus.CANCELED,
        payment_date: null,
      })
      .eq('id', paymentId)

    if (error) {
      alert('Erro ao cancelar pagamento: ' + error.message)
      return
    }

    setPayments((ps) =>
      ps.map((p) =>
        p.id === paymentId ? { ...p, status: PaymentStatus.CANCELED, payment_date: null } : p
      )
    )
    callParent()
  }

  async function handleRestore(paymentId) {
    const { error } = await supabase
      .from('payments')
      .update({ status: PaymentStatus.OPEN })
      .eq('id', paymentId)

    if (error) {
      alert('Erro ao restaurar pagamento: ' + error.message)
      return
    }

    setPayments((ps) =>
      ps.map((p) => (p.id === paymentId ? { ...p, status: PaymentStatus.OPEN } : p))
    )
    callParent()
  }

  return (
    <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 relative">
      <h2 className="text-xl font-bold mb-6 text-slate-800">Controle de Mensalidades</h2>

      <div className="flex flex-col sm:flex-row justify-between items-center mb-4 gap-4">
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <select
  className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
  value={month}
  onChange={e => setMonth(e.target.value)}
>
  {monthOptions.map(opt => (
    <option key={opt.value} value={opt.value}>
      {opt.label}
    </option>
  ))}
</select>

          <label className="flex items-center gap-2 text-sm text-slate-600">
            <input
              type="checkbox"
              checked={showCanceled}
              onChange={(e) => setShowCanceled(e.target.checked)}
            />
            Mostrar cancelados
          </label>
        </div>

        <div className="flex gap-2 w-full sm:w-auto">
          <button
            className="bg-blue-700 text-white font-semibold px-4 py-2 rounded-lg hover:bg-blue-800 transition-colors"
            onClick={() => setShowIndividualModal(true)}
            disabled={loading || processing}
          >
            Pgto. Individual
          </button>
          <button
            className="bg-green-700 text-white font-semibold px-4 py-2 rounded-lg hover:bg-green-800 transition-colors"
            onClick={() => setShowGroupModal(true)}
            disabled={loading || processing}
          >
            Pgto. de Grupo
          </button>
        </div>
      </div>

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
            <Dialog.Title className="font-bold text-lg mb-2">Editar Pagamento</Dialog.Title>
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
                onChange={(e) => setEditDate(e.target.value)}
              />
            </div>
            <div className="mb-3">
              <label className="block text-sm mb-1">Valor</label>
              <input
                type="number"
                className="w-full border rounded px-3 py-2"
                value={editAmount}
                onChange={(e) => setEditAmount(e.target.value)}
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
      <Dialog
        open={showIndividualModal}
        onClose={() => setShowIndividualModal(false)}
        className="relative z-50"
      >
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
              onChange={(e) => setSearchAluno(e.target.value)}
              autoFocus
            />
            <ul className="max-h-60 overflow-y-auto">
              {alunosIndividuais.map((aluno) => (
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
      <Dialog
        open={showGroupModal}
        onClose={() => setShowGroupModal(false)}
        className="relative z-50"
      >
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
              onChange={(e) => setSearchPayer(e.target.value)}
              autoFocus
            />
            <ul className="max-h-60 overflow-y-auto">
              {pagadoresDisponiveis.map((payer) => (
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

      {/* Tabela */}
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                Aluno
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                Vencimento
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                Valor
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                Data Pagamento
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                Ações
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-slate-200">
            {loading ? (
              <tr>
                <td colSpan={6} className="text-center py-8 text-slate-500">
                  Carregando...
                </td>
              </tr>
            ) : visiblePayments.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-center py-8 text-slate-500">
                  Nenhum pagamento encontrado.
                </td>
              </tr>
            ) : (
              visiblePayments.map((p) => {
                const student = studentsMap[p.student_id] || {}
                const dueDate = p.due_date ? new Date(p.due_date) : null
                const isPaid = norm(p.status) === PaymentStatus.PAID
                const isOpen = norm(p.status) === PaymentStatus.OPEN
                const isCanceled = norm(p.status) === PaymentStatus.CANCELED
                const isLate = isOpen && dueDate && dueDate < today
                const isSoon =
                  isOpen &&
                  dueDate &&
                  dueDate >= today &&
                  dueDate <= new Date(today.getTime() + 5 * 24 * 60 * 60 * 1000)

                return (
                  <tr key={p.id} className="hover:bg-slate-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-slate-900">
                      {student.name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      {dueDate ? dueDate.toLocaleDateString('pt-BR') : '—'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      {isPaid && (
                        <span className="bg-green-100 text-green-700 px-2 py-1 rounded-full text-xs">
                          Pago
                        </span>
                      )}
                      {isOpen && isLate && (
                        <span className="bg-red-100 text-red-700 px-2 py-1 rounded-full text-xs">
                          Atrasado
                        </span>
                      )}
                      {isOpen && !isLate && isSoon && (
                        <span className="bg-orange-100 text-orange-700 px-2 py-1 rounded-full text-xs">
                          Vencendo
                        </span>
                      )}
                      {isOpen && !isLate && !isSoon && (
                        <span className="bg-yellow-100 text-yellow-700 px-2 py-1 rounded-full text-xs">
                          Pendente
                        </span>
                      )}
                      {isCanceled && (
                        <span className="bg-slate-200 text-slate-700 px-2 py-1 rounded-full text-xs">
                          Cancelado
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      {p.amount != null ? currency(p.amount) : '—'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      {p.payment_date ? new Date(p.payment_date).toLocaleDateString('pt-BR') : '—'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                      {!isCanceled && (
                        <button className="text-orange-600 hover:underline" onClick={() => handleEdit(p)}>
                          Editar
                        </button>
                      )}
                      {!isCanceled && (
                        <button className="text-red-600 hover:underline" onClick={() => handleCancel(p.id)}>
                          Cancelar
                        </button>
                      )}
                      {isPaid && (
                        <button className="text-blue-600 hover:underline" onClick={() => handleUndo(p.id)}>
                          Desfazer
                        </button>
                      )}
                      {showCanceled && isCanceled && (
                        <button
                          className="text-green-700 hover:underline"
                          onClick={() => handleRestore(p.id)}
                        >
                          Restaurar
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
