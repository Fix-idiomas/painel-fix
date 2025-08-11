'use client'
import { useEffect, useMemo, useState } from 'react'
import Tabs from '@/components/Tabs'
import KpiCard from '@/components/KpiCard'
import RevenueChart from '@/components/RevenueChart'
import StudentsTable from '@/components/StudentsTable'
import TeachersTable from '@/components/TeachersTable'
import PaymentsTable from '@/components/PaymentsTable'
import InactiveStudentsTable from '@/components/InactivStudentsTable'
import PayersTable from '@/components/PayersTable'
import { downloadCsv } from '@/lib/exportCsv'
import { supabase } from '@/lib/supabaseClient'
import { saveAs } from 'file-saver'
import Header from '@/components/Header'
import PedagogicalProgress from '@/components/PedagogicalProgress'
import { useRouter } from 'next/navigation'

function yyyymm(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}`
}

function LogoutButton() {
  const router = useRouter()
  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
  }
  return (
    <button
      onClick={handleLogout}
      className="absolute top-4 right-4 bg-slate-200 px-4 py-2 rounded"
    >
      Sair
    </button>
  )
}

export default function Page() {
  // ---------- AUTENTICAÇÃO ----------
  const router = useRouter()
  const [authLoading, setAuthLoading] = useState(true)
  const [user, setUser] = useState(null)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) router.push('/login')
      else setUser(data.user)
      setAuthLoading(false)
    })
  }, [router])

  // ---------- ESTADOS ----------
  const [students, setStudents] = useState([])
  const [payments6m, setPayments6m] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [tab, setTab] = useState('dashboard')
  const [refreshInactive, setRefreshInactive] = useState(0)
  const [showValues, setShowValues] = useState(true)

  // ---------- CARREGAR DADOS ----------
  useEffect(() => {
    async function load() {
      setLoading(true); setError(null)
      // alunos ativos (para KPIs)
      const sRes = await supabase
        .from('students')
        .select('id, name, monthly_fee, status, dob')
        .eq('status', 'Ativo')

      if (sRes.error) { setError(sRes.error.message); setLoading(false); return }
      setStudents(sRes.data || [])

      // últimos 6 meses de pagamentos (inclui due_date)
      const base = new Date()
      const months = Array.from({length:6}).map((_,i)=>{
        const d = new Date(base.getFullYear(), base.getMonth()-5+i, 1)
        return yyyymm(d)
      })

      const pRes = await supabase
        .from('payments')
        .select('id, ref_month, amount, payment_date, due_date, student_id')
        .in('ref_month', months)

      if (pRes.error) { setError(pRes.error.message); setLoading(false); return }
      setPayments6m(pRes.data || [])
      setLoading(false)
    }
    load()
  }, [])

  // ---------- KPIs ----------
  const activeStudents = students.length
  const monthly = useMemo(
    () => students.reduce((sum, s) => sum + Number(s.monthly_fee || 0), 0),
    [students]
  )
  const annual = monthly * 12

  // KPIs do mês atual a partir de payments
  const currentMonth = yyyymm()
  const pmCurrent = payments6m.filter(p => p.ref_month === currentMonth)
  const receivedThisMonth = pmCurrent
    .filter(p => p.payment_date)
    .reduce((sum,p)=> sum + Number(p.amount||0), 0)
  const projectedThisMonth = pmCurrent.reduce((sum,p)=> sum + Number(p.amount||0), 0)
  const pendingThisMonth = Math.max(projectedThisMonth - receivedThisMonth, 0)

  // NOVO: Pagamentos atrasados (qualquer mês, vencidos e não pagos)
  const today = new Date()
  today.setHours(0,0,0,0)
  const overdue = payments6m
    .filter(p => !p.payment_date && p.due_date && new Date(p.due_date) < today)
    .reduce((sum, p) => sum + Number(p.amount || 0), 0)

  const currency = v => Number(v||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'})

  // ---------- CHART (últimos 6 meses: realizado vs previsto) ----------
  const chartMonths = useMemo(() => {
    const base = new Date()
    return Array.from({length:6}).map((_,i)=>{
      const d = new Date(base.getFullYear(), base.getMonth()-5+i, 1)
      return yyyymm(d)
    })
  }, [])
  const labels = chartMonths.map(m => {
    const [y,mm]=m.split('-'); return new Date(y, Number(mm)-1, 1).toLocaleDateString('pt-BR',{month:'short', year:'2-digit'})
  })
  const receivedSeries = chartMonths.map(m =>
    payments6m.filter(p => p.ref_month===m && p.payment_date).reduce((s,p)=>s+Number(p.amount||0),0)
  )
  const projectedSeries = chartMonths.map(m =>
    payments6m.filter(p => p.ref_month===m).reduce((s,p)=>s+Number(p.amount||0),0)
  )

  // ---------- VENCIMENTOS PRÓXIMOS (5 DIAS) ----------
  const fiveDaysLater = new Date(today)
  fiveDaysLater.setDate(today.getDate() + 5)
  fiveDaysLater.setHours(23,59,59,999)

  const upcomingDue = useMemo(() =>
    payments6m.filter(p => {
      if (!p.due_date || p.payment_date) return false // já pago ou sem data
      const due = new Date(p.due_date)
      due.setHours(0,0,0,0)
      return due >= today && due <= fiveDaysLater
    }),
    [payments6m]
  )

  // ---------- ANIVERSARIANTES DO MÊS ----------
  const currentMonthNum = new Date().getMonth() + 1
  const birthdayStudents = useMemo(() =>
    students.filter(s => {
      if (!s.dob) return false
      const [year, month, day] = s.dob.split('-')
      return Number(month) === currentMonthNum
    }),
    [students, currentMonthNum]
  )

  // ---------- EXPORT CSV ----------
  function handleExportCsv() {
    const rows = [
      { metrica: 'Alunos Ativos', valor: activeStudents },
      { metrica: 'Receita Mensal Prevista', valor: monthly },
      { metrica: 'Previsão de Receita Anual', valor: annual },
      { metrica: 'Recebido (Mês Atual)', valor: receivedThisMonth },
      { metrica: 'Pendente (Mês Atual)', valor: pendingThisMonth },
      { metrica: 'Atrasado', valor: overdue },
    ]
    downloadCsv('kpis.csv', rows)
  }

  // ---------- EXPORT BACKUP JSON ----------
  function handleExportBackup() {
    const backup = {
      students,
      payments: payments6m,
      // adicione outros dados se quiser
    }
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' })
    saveAs(blob, 'backup.json')
  }

  // ---------- IMPORTAR DADOS ----------
  function handleImportData(e) {
    const file = e.target.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (evt) => {
      try {
        const data = JSON.parse(evt.target.result)
        // Aqui você pode tratar os dados importados
        alert('Dados importados com sucesso!')
      } catch {
        alert('Arquivo inválido!')
      }
    }
    reader.readAsText(file)
  }

  // ---------- CONTEÚDO DAS ABAS ----------
  const dashboardContent = (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
      <div className="xl:col-span-2">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-6">
          {loading ? (
            <>
              <KpiCard label="Alunos Ativos" value="Carregando..." />
              <KpiCard label="Receita Mensal Prevista" value="Carregando..." />
              <KpiCard label="Previsão de Receita Anual" value="Carregando..." />
            </>
          ) : error ? (
            <>
              <KpiCard label="Alunos Ativos" value="Erro" />
              <KpiCard label="Receita Mensal Prevista" value="Erro" />
              <KpiCard label="Previsão de Receita Anual" value="Erro" />
            </>
          ) : (
            <>
              <KpiCard label="Alunos Ativos" value={showValues ? activeStudents : '•••'} />
              <KpiCard label="Receita Mensal Prevista" value={showValues ? currency(monthly) : '•••'} />
              <KpiCard label="Previsão de Receita Anual" value={showValues ? currency(annual) : '•••'} />
            </>
          )}

          {/* KPIs de pagamentos (reais) com label colorido */}
          <KpiCard label="Recebido (Mês Atual)" value={showValues ? currency(receivedThisMonth) : '•••'} labelClassName="text-green-600" />
          <KpiCard label="Pendente (Mês Atual)" value={showValues ? currency(pendingThisMonth) : '•••'} labelClassName="text-yellow-600" />
          <KpiCard label="Atrasado" value={showValues ? currency(overdue) : '•••'} labelClassName="text-red-600" />
        </div>

        <div className="bg-white p-4 sm:p-6 rounded-xl shadow-sm border border-slate-100">
          <h3 className="text-lg font-semibold text-slate-800 mb-4">Desempenho Financeiro Mensal</h3>
          <RevenueChart labels={labels} received={receivedSeries} projected={projectedSeries} />
        </div>
      </div>

      <div className="space-y-6">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
          <h3 className="text-lg font-semibold text-slate-800 mb-4">Vencimentos Próximos (5 dias)</h3>
          {upcomingDue.length === 0 ? (
            <p className="text-sm text-slate-500">Nenhum vencimento nos próximos 5 dias.</p>
          ) : (
            <ul className="text-sm text-slate-700 space-y-1">
              {upcomingDue.map(p => {
                const aluno = students.find(s => s.id === p.student_id)
                return (
                  <li key={p.id}>
                    {new Date(p.due_date).toLocaleDateString('pt-BR')}
                    {' — '}
                    {aluno ? aluno.name : 'Aluno'}
                    {' — '}
                    {currency(p.amount)}
                  </li>
                )
              })}
            </ul>
          )}
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
          <h3 className="text-lg font-semibold text-slate-800 mb-4">Aniversariantes do Mês</h3>
          {birthdayStudents.length === 0 ? (
            <p className="text-sm text-slate-500">Nenhum aniversariante este mês.</p>
          ) : (
            <ul className="text-sm text-slate-700 space-y-1">
              {birthdayStudents.map(s => {
                const [year, month, day] = s.dob.split('-')
                return (
                  <li key={s.id}>
                    {`${day}/${month}`} — {s.name}
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  )

  const tabs = [
    { key: 'dashboard', label: 'Visão Geral', content: dashboardContent },
    { key: 'students', label: 'Alunos Ativos', content: <StudentsTable /> },
    { key: 'inactive-students', label: 'Alunos Inativos', content: <InactiveStudentsTable refreshKey={refreshInactive} /> },
    { key: 'teachers', label: 'Professores', content: <TeachersTable /> },
    { key: 'payers', label: 'Pagadores', content: <PayersTable /> },
    { key: 'payments', label: 'Pagamentos', content: <PaymentsTable /> },
    { key: 'progress', label: 'Evolução Pedagógica', content: <PedagogicalProgress /> },
  ]

  // Atualiza refreshInactive ao trocar para a aba de inativos
  function handleTabChange(idx) {
    const key = tabs[idx].key
    setTab(key)
    if (key === 'inactive-students') setRefreshInactive(v => v + 1)
  }

  if (authLoading) return <div>Carregando...</div>
  if (!user) return null

  return (
    <main>
      <LogoutButton />
      <Header
        onExport={handleExportCsv}
        onImport={handleImportData}
        onExportBackup={handleExportBackup}
        onToggleValues={() => setShowValues(v => !v)}
        showValues={showValues}
      />
      <Tabs tabs={tabs} initial={0} onTabChange={handleTabChange} />
    </main>
  )
}