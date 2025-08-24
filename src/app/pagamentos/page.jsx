'use client';

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

/* ===== helpers ===== */
const fmtBRL = (n) =>
  (Number(n) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const firstDay = (year, month) => new Date(year, month - 1, 1);
const nextMonthFirstDay = (year, month) => new Date(year, month, 1); // month já +1
const isoDate = (d) => (d ? new Date(d).toISOString().slice(0, 10) : null);
const today = () => new Date();
const pickKey = (row, candidates) =>
  candidates.find((k) => row && Object.prototype.hasOwnProperty.call(row, k));

/* ===== componente ===== */
export default function PagamentosPage() {
  // mês selecionado yyyy-mm
  const [ym, setYm] = useState(() => {
    const d = new Date();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    return `${d.getFullYear()}-${m}`;
  });

  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState([]); // [{student_id, student_name, email, phone, responsible_id, responsible_name, monthly_value, due_date, paid_sum, status}]
  const [totals, setTotals] = useState({ due: 0, received: 0, pending: 0, late: 0 });
  const [q, setQ] = useState('');

  // esquema da tabela payments (auto detecção)
  const [paymentsSchema, setPaymentsSchema] = useState({
    amountKey: 'amount',
    dateKey: 'paid_at',
    studentKey: 'student_id_uuid',
    refMonthKey: null, // 'reference_month' se existir
  });

  // modal individual já existia
  const [paying, setPaying] = useState(null); // {student_id, student_name, toPay}

  // novo: modal de pagamento de grupo
  const [groupOpen, setGroupOpen] = useState(false);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        // ==== detectar colunas de payments ====
        const { data: probe } = await supabase.from('payments').select('*').limit(1);
        if (probe && probe[0]) {
          const sample = probe[0];
          const amountKey = pickKey(sample, ['amount', 'value', 'paid_value', 'total']) || 'amount';
          const dateKey   = pickKey(sample, ['paid_at', 'payment_date', 'date', 'created_at']) || 'paid_at';
          const studentKey= pickKey(sample, ['student_id_uuid', 'student_id']) || 'student_id_uuid';
          const refMonthKey = pickKey(sample, ['reference_month', 'competencia', 'month_ref']) || null;
          setPaymentsSchema({ amountKey, dateKey, studentKey, refMonthKey });
        }

        // ==== base (payers + vínculos ativos) ====
        const { data: vincs, error: eV } = await supabase
          .from('turma_students')
          .select('student_id_uuid, active')
          .eq('active', true);
        if (eV) throw eV;

        const activeStudentIds = Array.from(
          new Set((vincs ?? []).map((v) => v.student_id_uuid).filter(Boolean))
        );

        // Corrigido: não buscar student_id_uuid em payers, pois não existe
        const { data: payers, error: eP } = await supabase
          .from('payers')
          .select('monthly_value, due_day, responsible_id');
        if (eP) throw eP;

        const currentPayers = (payers ?? []).filter((p) =>
          activeStudentIds.includes(p.student_id_uuid)
        );

        // students
        const sidList = Array.from(
          new Set(currentPayers.map((p) => p.student_id_uuid).filter(Boolean))
        );
        let studentsMap = new Map();
        if (sidList.length) {
          const { data: students, error: eS } = await supabase
            .from('students')
            .select('id_uuid, name, email, phone')
            .in('id_uuid', sidList);
          if (eS) throw eS;
          studentsMap = new Map((students ?? []).map((s) => [s.id_uuid, s]));
        }

        // responsibles
        const respIds = Array.from(
          new Set((currentPayers ?? []).map((p) => p.responsible_id).filter(Boolean))
        );
        let respMap = new Map();
        if (respIds.length) {
          const { data: resps } = await supabase
            .from('responsibles')
            .select('id, name');
          respMap = new Map((resps ?? []).map((r) => [r.id, r]));
        }

        // ==== pagamentos do mês ====
        const [year, month] = ym.split('-').map(Number);
        const start = firstDay(year, month);
        const end   = nextMonthFirstDay(year, month);

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

        // soma paga por aluno
        const paidByStudent = new Map();
        for (const p of payments) {
          const sid = p[paymentsSchema.studentKey];
          const amt = Number(p[paymentsSchema.amountKey] || 0);
          if (!sid || !isFinite(amt)) continue;
          paidByStudent.set(sid, (paidByStudent.get(sid) || 0) + amt);
        }

        // ==== montar linhas ====
        const hoje = today();
        const list = currentPayers.map((p) => {
          const s = studentsMap.get(p.student_id_uuid);
          const dueDay = Math.min(Math.max(Number(p.due_day || 1), 1), 28);
          const dueDate = new Date(year, month - 1, dueDay);
          const paid = Number(paidByStudent.get(p.student_id_uuid) || 0);
          const value = Number(p.monthly_value || 0);

          let status = 'Pendente';
          if (paid >= value - 0.009) status = 'Pago';
          else if (hoje > dueDate) status = 'Atrasado';

          return {
            student_id: p.student_id_uuid,
            student_name: s?.name || '(sem nome)',
            email: s?.email || '',
            phone: s?.phone || '',
            responsible_id: p.responsible_id ?? null,
            responsible_name: p.responsible_id ? (respMap.get(p.responsible_id)?.name || '') : '',
            monthly_value: value,
            due_date: dueDate,
            paid_sum: paid,
            status,
          };
        }).sort((a, b) => a.student_name.localeCompare(b.student_name, 'pt-BR', { sensitivity: 'base' }));

        // ==== totais ====
        const due = list.reduce((acc, r) => acc + r.monthly_value, 0);
        const received = list.reduce((acc, r) => acc + Math.min(r.paid_sum, r.monthly_value), 0);
        const late = list
          .filter((r) => r.status === 'Atrasado')
          .reduce((acc, r) => acc + Math.max(r.monthly_value - r.paid_sum, 0), 0);
        const pending = Math.max(due - received, 0);

        setRows(list);
        setTotals({ due, received, pending, late });
      } catch (e) {
        console.error(e);
        alert(e.message || 'Erro ao carregar pagamentos');
      } finally {
        setLoading(false);
      }
    })();
  }, [ym, paymentsSchema.refMonthKey]);

  const filtered = useMemo(() => {
    if (!q.trim()) return rows;
    const v = q.toLowerCase().trim();
    return rows.filter((r) =>
      r.student_name.toLowerCase().includes(v) ||
      (r.email && r.email.toLowerCase().includes(v)) ||
      (r.phone && r.phone.toLowerCase().includes(v)) ||
      (r.responsible_name && r.responsible_name.toLowerCase().includes(v))
    );
  }, [rows, q]);

  async function registerPayment({ student_id, amount, date }) {
    const record = {};
    record[paymentsSchema.studentKey] = student_id;
    record[paymentsSchema.amountKey]  = Number(amount || 0);
    record[paymentsSchema.dateKey]    = isoDate(date || today());

    if (paymentsSchema.refMonthKey) {
      const [yy, mm] = ym.split('-').map(Number);
      record[paymentsSchema.refMonthKey] = isoDate(firstDay(yy, mm));
    }

    const { error } = await supabase.from('payments').insert(record);
    if (error) throw error;

    // atualiza UI
    setRows((prev) =>
      prev.map((r) =>
        r.student_id !== student_id
          ? r
          : {
              ...r,
              paid_sum: r.paid_sum + Number(amount || 0),
              status:
                r.paid_sum + Number(amount || 0) >= r.monthly_value - 0.009
                  ? 'Pago'
                  : r.status,
            }
      )
    );
    setTotals((t) => {
      const received = t.received + Number(amount || 0);
      const pending = Math.max(t.due - received, 0);
      return { ...t, received, pending };
    });
  }

  async function registerGroupPayments(records /* [{student_id, amount, date}] */) {
    if (!records || records.length === 0) return;

    // monta batch para insert
    const batch = records.map((r) => {
      const rec = {};
      rec[paymentsSchema.studentKey] = r.student_id;
      rec[paymentsSchema.amountKey]  = Number(r.amount || 0);
      rec[paymentsSchema.dateKey]    = isoDate(r.date || today());
      if (paymentsSchema.refMonthKey) {
        const [yy, mm] = ym.split('-').map(Number);
        rec[paymentsSchema.refMonthKey] = isoDate(firstDay(yy, mm));
      }
      return rec;
    });

    const totalAdded = batch.reduce((a, b) => a + (Number(b[paymentsSchema.amountKey]) || 0), 0);

    const { error } = await supabase.from('payments').insert(batch);
    if (error) throw error;

    // atualiza UI
    setRows((prev) =>
      prev.map((r) => {
        const add = records.find((x) => x.student_id === r.student_id);
        if (!add) return r;
        const newPaid = r.paid_sum + Number(add.amount || 0);
        return {
          ...r,
          paid_sum: newPaid,
          status: newPaid >= r.monthly_value - 0.009 ? 'Pago' : r.status,
        };
      })
    );
    setTotals((t) => {
      const received = t.received + totalAdded;
      const pending = Math.max(t.due - received, 0);
      return { ...t, received, pending };
    });
  }

  // opções de responsáveis (para o modal)
  const responsiblesOptions = useMemo(() => {
    const map = new Map();
    for (const r of rows) {
      if (!r.responsible_id) continue;
      if (!map.has(r.responsible_id)) {
        map.set(r.responsible_id, { id: r.responsible_id, name: r.responsible_name });
      }
    }
    return Array.from(map.values()).sort((a, b) =>
      (a.name || '').localeCompare(b.name || '', 'pt-BR', { sensitivity: 'base' })
    );
  }, [rows]);

  return (
    <main className="min-h-screen bg-neutral-50">
      <div className="mx-auto max-w-7xl px-6 py-8 space-y-6">
        {/* Cabeçalho / Filtros */}
        <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold tracking-tight">Pagamentos</h1>
            <p className="text-sm text-slate-600">Gerencie os recebimentos por mês de competência.</p>
          </div>
          <div className="flex items-center gap-3">
            <label className="text-sm">
              Mês
              <input
                type="month"
                className="ml-2 border rounded px-3 py-2 bg-white"
                value={ym}
                onChange={(e) => setYm(e.target.value)}
              />
            </label>
            <div className="w-80">
              <label className="text-sm block">
                Buscar
                <input
                  className="mt-1 w-full border rounded px-3 py-2 bg-white"
                  placeholder="Aluno, email, telefone, responsável…"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                />
              </label>
            </div>
            <button
              className="rounded-md bg-emerald-700 px-4 py-2 text-white hover:bg-emerald-800"
              onClick={() => setGroupOpen(true)}
            >
              Pgto. de Grupo
            </button>
          </div>
        </header>

        {/* Cards de resumo */}
        <section className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card title="Previsto no mês" value={fmtBRL(totals.due)} />
          <Card title="Recebido (mês)" value={fmtBRL(totals.received)} />
          <Card title="Pendente (mês)" value={fmtBRL(totals.pending)} />
          <Card title="Atrasado" value={fmtBRL(totals.late)} />
        </section>

        {/* Tabela */}
        <section className="bg-white rounded-lg border">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="bg-slate-50 text-slate-600">
                  <th className="text-left font-medium px-4 py-3">Aluno</th>
                  <th className="text-left font-medium px-4 py-3">Contato</th>
                  <th className="text-left font-medium px-4 py-3">Responsável</th>
                  <th className="text-left font-medium px-4 py-3">Vencimento</th>
                  <th className="text-right font-medium px-4 py-3">Valor</th>
                  <th className="text-right font-medium px-4 py-3">Pago</th>
                  <th className="text-left font-medium px-4 py-3">Status</th>
                  <th className="text-left font-medium px-4 py-3">Ações</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={8} className="px-4 py-6 text-center text-slate-500">Carregando…</td></tr>
                ) : filtered.length === 0 ? (
                  <tr><td colSpan={8} className="px-4 py-6 text-center text-slate-500">Nada para este mês.</td></tr>
                ) : (
                  filtered.map((r) => {
                    const toPay = Math.max(r.monthly_value - r.paid_sum, 0);
                    return (
                      <tr key={r.student_id} className="border-t">
                        <td className="px-4 py-3 font-medium">{r.student_name}</td>
                        <td className="px-4 py-3">
                          {(r.email || r.phone) ? (
                            <div className="space-y-0.5">
                              {r.email && <div className="text-slate-700">{r.email}</div>}
                              {r.phone && <div className="text-slate-500 text-xs">{r.phone}</div>}
                            </div>
                          ) : '—'}
                        </td>
                        <td className="px-4 py-3">{r.responsible_name || '—'}</td>
                        <td className="px-4 py-3">{new Date(r.due_date).toLocaleDateString('pt-BR')}</td>
                        <td className="px-4 py-3 text-right">{fmtBRL(r.monthly_value)}</td>
                        <td className="px-4 py-3 text-right">{fmtBRL(r.paid_sum)}</td>
                        <td className="px-4 py-3"><StatusBadge status={r.status} /></td>
                        <td className="px-4 py-3">
                          {toPay > 0 ? (
                            <button
                              className="rounded border px-3 py-1.5 text-xs hover:bg-slate-50"
                              onClick={() => setPaying({ student_id: r.student_id, student_name: r.student_name, toPay })}
                            >
                              Registrar pagamento
                            </button>
                          ) : (
                            <span className="text-xs text-slate-400">Quitado</span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      {paying && (
        <PaymentDialog
          data={paying}
          onClose={() => setPaying(null)}
          onSave={async ({ amount, date }) => {
            await registerPayment({ student_id: paying.student_id, amount, date });
            setPaying(null);
          }}
        />
      )}

      {groupOpen && (
        <GroupPaymentDialog
          onClose={() => setGroupOpen(false)}
          responsibles={responsiblesOptions}
          rows={rows}
          onSave={async (records) => {
            await registerGroupPayments(records);
            setGroupOpen(false);
          }}
          ym={ym}
        />
      )}
    </main>
  );
}

/* ===== componentes miúdos ===== */

function Card({ title, value }) {
  return (
    <div className="rounded-lg border bg-white px-4 py-3">
      <div className="text-xs text-slate-500">{title}</div>
      <div className="text-xl font-semibold mt-1">{value}</div>
    </div>
  );
}

function StatusBadge({ status }) {
  const map = {
    'Pago':       'bg-emerald-50 text-emerald-700 border-emerald-200',
    'Pendente':   'bg-amber-50 text-amber-700 border-amber-200',
    'Atrasado':   'bg-rose-50 text-rose-700 border-rose-200',
  };
  const cls = map[status] || 'bg-slate-50 text-slate-600 border-slate-200';
  return <span className={`inline-block text-xs px-2 py-1 rounded border ${cls}`}>{status}</span>;
}

function PaymentDialog({ data, onClose, onSave }) {
  const [amount, setAmount] = useState(String(data.toPay || ''));
  const [date, setDate] = useState(isoDate(today()));
  const [busy, setBusy] = useState(false);

  async function handleSave() {
    if (amount === '' || Number(amount) <= 0) return alert('Informe um valor válido.');
    setBusy(true);
    try {
      await onSave({ amount: Number(String(amount).replace(',', '.')), date });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title={`Pagamento — ${data.student_name}`} onClose={onClose}>
      <div className="p-5 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <label className="block text-sm">Valor (R$)
            <input className="mt-1 w-full border rounded px-3 py-2 bg-white"
                   inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </label>
          <label className="block text-sm">Data
            <input type="date" className="mt-1 w-full border rounded px-3 py-2 bg-white"
                   value={date} onChange={(e) => setDate(e.target.value)} />
          </label>
        </div>
      </div>
      <div className="px-5 py-4 border-t flex items-center justify-end gap-3">
        <button className="rounded border px-4 py-2 text-sm hover:bg-slate-50" onClick={onClose} disabled={busy}>Cancelar</button>
        <button className="rounded bg-emerald-700 px-4 py-2 text-sm text-white hover:bg-emerald-800 disabled:opacity-50"
                onClick={handleSave} disabled={busy}>
          {busy ? 'Salvando…' : 'Salvar'}
        </button>
      </div>
    </Modal>
  );
}

/* === Modal de Pagamento de Grupo === */
function GroupPaymentDialog({ onClose, responsibles, rows, onSave, ym }) {
  const [responsibleId, setResponsibleId] = useState('');
  const [items, setItems] = useState([]); // [{student_id,name,due,pay,checked}]
  const [totalInput, setTotalInput] = useState(''); // opcional
  const [date, setDate] = useState(isoDate(today()));
  const [busy, setBusy] = useState(false);

  // quando escolhe responsável, puxa os alunos dele
  useEffect(() => {
    if (!responsibleId) {
      setItems([]);
      return;
    }
    const list = rows
      .filter((r) => r.responsible_id === responsibleId)
      .map((r) => ({
        student_id: r.student_id,
        name: r.student_name,
        due: Math.max(r.monthly_value - r.paid_sum, 0),
        pay: Math.max(r.monthly_value - r.paid_sum, 0),
        checked: Math.max(r.monthly_value - r.paid_sum, 0) > 0,
      }));
    setItems(list);
    setTotalInput(String(list.reduce((a, b) => a + (b.pay || 0), 0)));
  }, [responsibleId, rows]);

  const totalSelected = useMemo(
    () => items.filter(i => i.checked).reduce((a, b) => a + (Number(b.pay) || 0), 0),
    [items]
  );

  function toggleAll(val) {
    setItems((prev) => prev.map((i) => ({ ...i, checked: val })));
  }

  function distribute() {
    // distribui totalInput entre os itens selecionados respeitando "due"
    let total = Number(String(totalInput).replace(',', '.')) || 0;
    if (total <= 0) return;

    const selected = items.map((i) => ({ ...i }));
    for (const it of selected) {
      if (!it.checked) { it.pay = 0; continue; }
      const quota = Math.min(it.due, total);
      it.pay = quota;
      total -= quota;
    }
    setItems(selected);
  }

  async function handleSave() {
    const records = items
      .filter((i) => i.checked && Number(i.pay) > 0)
      .map((i) => ({ student_id: i.student_id, amount: Number(i.pay), date }));

    if (records.length === 0) {
      alert('Selecione ao menos um aluno com valor > 0.');
      return;
    }

    setBusy(true);
    try {
      await onSave(records);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title="Pagamento de Grupo" onClose={onClose}>
      <div className="p-5 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <label className="block text-sm">Responsável
            <select className="mt-1 w-full border rounded px-3 py-2 bg-white"
                    value={responsibleId} onChange={(e) => setResponsibleId(e.target.value)}>
              <option value="">— Selecionar —</option>
              {responsibles.map((r) => (
                <option key={r.id} value={r.id}>{r.name}</option>
              ))}
            </select>
          </label>
          <label className="block text-sm">Mês
            <input type="month" className="mt-1 w-full border rounded px-3 py-2 bg-white" value={ym} disabled />
          </label>
          <label className="block text-sm">Data do recebimento
            <input type="date" className="mt-1 w-full border rounded px-3 py-2 bg-white"
                   value={date} onChange={(e) => setDate(e.target.value)} />
          </label>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
          <label className="block text-sm">Valor recebido (opcional)
            <input className="mt-1 w-full border rounded px-3 py-2 bg-white"
                   inputMode="decimal" placeholder="Somar e distribuir"
                   value={totalInput} onChange={(e) => setTotalInput(e.target.value)} />
          </label>
          <button className="h-10 rounded border px-4 text-sm mt-6 hover:bg-slate-50"
                  onClick={distribute}>
            Distribuir entre selecionados
          </button>
          <div className="mt-6 text-sm text-slate-600">
            Total selecionado: <strong>{fmtBRL(totalSelected)}</strong>
          </div>
        </div>

        <div className="flex items-center gap-3 text-sm">
          <button className="rounded border px-3 py-1 hover:bg-slate-50"
                  onClick={() => toggleAll(true)}>Selecionar todos</button>
          <button className="rounded border px-3 py-1 hover:bg-slate-50"
                  onClick={() => toggleAll(false)}>Limpar seleção</button>
        </div>

        <div className="overflow-x-auto border rounded">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="bg-slate-50 text-slate-600">
                <th className="text-left font-medium px-3 py-2">Aluno</th>
                <th className="text-right font-medium px-3 py-2">Devido</th>
                <th className="text-right font-medium px-3 py-2">Pagar</th>
                <th className="text-left font-medium px-3 py-2">Sel.</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr><td colSpan={4} className="px-3 py-4 text-center text-slate-500">Selecione um responsável.</td></tr>
              ) : items.map((it) => (
                <tr key={it.student_id} className="border-t">
                  <td className="px-3 py-2">{it.name}</td>
                  <td className="px-3 py-2 text-right">{fmtBRL(it.due)}</td>
                  <td className="px-3 py-2 text-right">
                    <input className="w-32 border rounded px-2 py-1 text-right bg-white"
                           inputMode="decimal"
                           value={it.pay}
                           onChange={(e) => {
                             const v = e.target.value;
                             setItems((prev) => prev.map((x) =>
                               x.student_id === it.student_id ? { ...x, pay: Number(v) || 0 } : x
                             ));
                           }} />
                  </td>
                  <td className="px-3 py-2">
                    <input type="checkbox" checked={it.checked}
                           onChange={(e) => {
                             const c = e.target.checked;
                             setItems((prev) => prev.map((x) =>
                               x.student_id === it.student_id ? { ...x, checked: c } : x
                             ));
                           }} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="px-5 py-4 border-t flex items-center justify-end gap-3">
        <button className="rounded border px-4 py-2 text-sm hover:bg-slate-50" onClick={onClose} disabled={busy}>Cancelar</button>
        <button className="rounded bg-emerald-700 px-4 py-2 text-sm text-white hover:bg-emerald-800 disabled:opacity-50"
                onClick={handleSave} disabled={busy || !responsibleId}>
          {busy ? 'Salvando…' : 'Salvar recebimento'}
        </button>
      </div>
    </Modal>
  );
}

function Modal({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
      <div className="w-full max-w-4xl rounded-xl bg-white border shadow-lg">
        <div className="px-5 py-4 border-b flex items-center justify-between">
          <h2 className="text-base font-semibold">{title}</h2>
          <button className="text-slate-500 hover:text-slate-700" onClick={onClose}>✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}
