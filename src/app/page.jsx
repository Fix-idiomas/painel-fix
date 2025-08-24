'use client';

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

const fmtBRL = (n) =>
  (Number(n) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const isoDate = (d) => (d ? new Date(d).toISOString().slice(0, 10) : null);
const today = () => new Date();
const clampDue = (d) => Math.min(Math.max(Number(d || 1), 1), 28);
const pickKey = (row, candidates, fallback) =>
  candidates.find((k) => row && Object.prototype.hasOwnProperty.call(row, k)) || fallback;

export default function DashboardPage() {
  const [ym, setYm] = useState(() => {
    const d = new Date();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    return `${d.getFullYear()}-${m}`;
  });

  const [loading, setLoading] = useState(true);
  const [cards, setCards] = useState({
    ativos: 0,
    previstoMes: 0,
    recebidoMes: 0,
    pendenteMes: 0,
    atrasado: 0,
    previsaoAnual: 0,
  });
  const [vencimentos, setVencimentos] = useState([]);
  const [aniversariantes, setAniversariantes] = useState([]);

  const [paymentsSchema, setPaymentsSchema] = useState({
    amountKey: 'amount',
    dateKey: 'paid_at',
    studentKey: 'student_id_uuid',
    refMonthKey: null,
  });

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        // --- autodetect do schema de payments
        const { data: probe } = await supabase.from('payments').select('*').limit(1);
        if (probe && probe[0]) {
          const s = probe[0];
          setPaymentsSchema({
            amountKey:  pickKey(s, ['amount', 'value', 'paid_value', 'total'], 'amount'),
            dateKey:    pickKey(s, ['paid_at', 'payment_date', 'date', 'created_at'], 'paid_at'),
            studentKey: pickKey(s, ['student_id_uuid', 'student_id'], 'student_id_uuid'),
            refMonthKey: pickKey(s, ['reference_month', 'competencia', 'month_ref'], null),
          });
        }

        // --- vínculos ativos => ids de alunos ativos
        const { data: vincs, error: eV } = await supabase
          .from('turma_students')
          .select('student_id_uuid, active')
          .eq('active', true);
        if (eV) throw eV;

        const activeIds = Array.from(new Set((vincs ?? []).map(v => v.student_id_uuid).filter(Boolean)));

        const { data: payers, error: eP } = await supabase
  .from('payers')
  .select('id_uuid, name')
  .order('name', { ascending: true });
if (eP) throw eP;

// alunos desses pagadores
const payerIds = (payers ?? []).map(p => p.id_uuid);
const { data: students, error: eS } = await supabase
  .from('students')
  .select('id_uuid, name, birth_date, payer_id_uuid')
  .in('payer_id_uuid', payerIds);
if (eS) throw eS;

// se precisar da mensalidade/ativo
const sIds = (students ?? []).map(s => s.id_uuid);
const { data: links, error: eL } = sIds.length ? await supabase
  .from('turma_students')
  .select('student_id_uuid, active, monthly_value')
  .in('student_id_uuid', sIds) : { data: [], error: null };
if (eL) throw eL;

        const currentPayers = (payers ?? []).filter(p => activeIds.includes(p.student_id_uuid));

        // --- students (para nomes/contatos/aniversários)
        const sidList = Array.from(new Set(currentPayers.map(p => p.student_id_uuid)));
        let studentsMap = new Map();
        if (sidList.length) {
          const { data: students, error: eS } = await supabase
            .from('students')
            .select('id_uuid, name, email, phone, birth_date')
            .in('id_uuid', sidList);
          if (eS) throw eS;
          studentsMap = new Map((students ?? []).map(s => [s.id_uuid, s]));
        }

        // --- responsibles (apenas para exibir nomes em “vencimentos próximos”)
        const respIds = Array.from(new Set(currentPayers.map(p => p.responsible_id).filter(Boolean)));
        let respMap = new Map();
        if (respIds.length) {
          const { data: resps } = await supabase.from('responsibles').select('id, name');
          respMap = new Map((resps ?? []).map(r => [r.id, r]));
        }

        // --- pagamentos do mês (TODOS — ativos e inativos contam para “Recebido”)
        const [year, month] = ym.split('-').map(Number);
        const start = new Date(year, month - 1, 1);
        const end   = new Date(year, month, 1);

        let payments = [];
        if (paymentsSchema.refMonthKey) {
          const { data, error } = await supabase
            .from('payments')
            .select('*')
            .eq(paymentsSchema.refMonthKey, isoDate(start));
          if (error) throw error;
          payments = data ?? [];
        } else {
          const { data, error } = await supabase
            .from('payments')
            .select('*')
            .gte(paymentsSchema.dateKey, isoDate(start))
            .lt(paymentsSchema.dateKey, isoDate(end));
          if (error) throw error;
          payments = data ?? [];
        }

        const paidByStudent = new Map();
        for (const p of payments) {
          const sid = p[paymentsSchema.studentKey];
          const amt = Number(p[paymentsSchema.amountKey] || 0);
          if (!sid || !isFinite(amt)) continue;
          paidByStudent.set(sid, (paidByStudent.get(sid) || 0) + amt);
        }

        // ========== CÁLCULOS DOS CARDS ==========
        // Previsto: soma dos ativos
        const previstos = currentPayers.reduce((acc, p) => acc + Number(p.monthly_value || 0), 0);

        // Recebido: soma de TODOS os pagamentos do mês (inclui inativos)
        const recebidosTodos = Array.from(paidByStudent.values()).reduce((a, b) => a + b, 0);

        // Pendente/Atrasado: só dos ATIVOS, aluno-a-aluno
        let pendente = 0;
        let atrasado = 0;
        const hoje = today();

        for (const p of currentPayers) {
          const valor = Number(p.monthly_value || 0);
          const pago  = Number(paidByStudent.get(p.student_id_uuid) || 0);
          const falta = Math.max(valor - pago, 0);

          pendente += falta;

          const dueDate = new Date(year, month - 1, clampDue(p.due_day));
          if (falta > 0 && hoje > dueDate) atrasado += falta;
        }

        setCards({
          ativos: activeIds.length,
          previstoMes: previstos,
          recebidoMes: recebidosTodos,
          pendenteMes: pendente,
          atrasado,
          previsaoAnual: previstos * 12,
        });

        // --- vencimentos próximos (5 dias)
        const in5 = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() + 5);
        const proxs = currentPayers
          .map((p) => {
            const due = new Date(year, month - 1, clampDue(p.due_day));
            return {
              student: studentsMap.get(p.student_id_uuid)?.name || '(sem nome)',
              responsible: p.responsible_id ? (respMap.get(p.responsible_id)?.name || '') : '',
              date: due,
              value: Number(p.monthly_value || 0),
            };
          })
          .filter((x) => x.date >= hoje && x.date <= in5)
          .sort((a, b) => a.date - b.date)
          .slice(0, 5);

        setVencimentos(proxs);

        // --- aniversariantes do mês (dos ativos)
        const anivs = [];
        for (const s of studentsMap.values()) {
          if (!s.birth_date) continue;
          const bd = new Date(s.birth_date);
          if (bd.getMonth() + 1 !== month) continue;
          anivs.push({ student: s.name || '(sem nome)', day: bd.getDate() });
        }
        setAniversariantes(anivs.sort((a, b) => a.day - b.day).slice(0, 10));
      } catch (e) {
        console.error(e);
        alert(e.message || 'Erro ao carregar o Dashboard.');
      } finally {
        setLoading(false);
      }
    })();
  }, [ym, paymentsSchema.refMonthKey]);

  const resumo = useMemo(() => ([
    { title: 'Alunos Ativos', value: loading ? '—' : cards.ativos },
    { title: 'Receita Mensal Prevista', value: fmtBRL(cards.previstoMes) },
    { title: 'Recebido (Mês Atual)', value: fmtBRL(cards.recebidoMes) },
    { title: 'Pendente (Mês Atual)', value: fmtBRL(cards.pendenteMes) },
    { title: 'Atrasado', value: fmtBRL(cards.atrasado) },
    { title: 'Previsão de Receita Anual', value: fmtBRL(cards.previsaoAnual) },
  ]), [cards, loading]);

  return (
    <main className="min-h-screen bg-neutral-50">
      <div className="mx-auto max-w-7xl px-6 py-8 space-y-6">
        {/* Filtro de mês */}
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold tracking-tight">Visão Geral</h1>
          <label className="text-sm">
            Mês
            <input
              type="month"
              className="ml-2 border rounded px-3 py-2 bg-white"
              value={ym}
              onChange={(e) => setYm(e.target.value)}
            />
          </label>
        </div>

        {/* Cards */}
        <section className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-6 gap-4">
          {resumo.map((c) => (
            <div key={c.title} className="rounded-lg border bg-white p-4">
              <div className="text-xs text-slate-500">{c.title}</div>
              <div className="mt-1 text-xl font-semibold">{c.value}</div>
            </div>
          ))}
        </section>

        {/* Vencimentos próximos & aniversariantes */}
        <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="rounded-lg border bg-white p-4">
            <div className="font-medium mb-2">Vencimentos Próximos (5 dias)</div>
            {vencimentos.length === 0 ? (
              <div className="text-sm text-slate-500">Nenhum vencimento nos próximos 5 dias.</div>
            ) : (
              <ul className="space-y-2 text-sm">
                {vencimentos.map((v, i) => (
                  <li key={i} className="flex items-center justify-between">
                    <div>
                      <div className="font-medium">{v.student}</div>
                      {v.responsible && (
                        <div className="text-xs text-slate-500">Resp.: {v.responsible}</div>
                      )}
                    </div>
                    <div className="text-right">
                      <div className="text-slate-600">
                        {new Date(v.date).toLocaleDateString('pt-BR')}
                      </div>
                      <div className="text-slate-900 font-medium">{fmtBRL(v.value)}</div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="rounded-lg border bg-white p-4">
            <div className="font-medium mb-2">Aniversariantes do Mês</div>
            {aniversariantes.length === 0 ? (
              <div className="text-sm text-slate-500">Nenhum aniversariante este mês.</div>
            ) : (
              <ul className="space-y-2 text-sm">
                {aniversariantes.map((a, i) => (
                  <li key={i} className="flex items-center justify-between">
                    <div className="font-medium">{a.student}</div>
                    <div className="text-slate-600">
                      {String(a.day).padStart(2, '0')}/{ym.split('-')[1]}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        {/* Placeholder gráfico */}
        <section className="rounded-lg border bg-white p-4">
          <div className="font-medium mb-2">Desempenho Financeiro Mensal</div>
          <div className="text-sm text-slate-500">[Gráfico aqui em breve]</div>
        </section>
      </div>
    </main>
  );
}
