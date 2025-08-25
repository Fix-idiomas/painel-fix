"use client";

import { useEffect, useMemo, useState } from "react";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";

function fmtMoney(v) {
  try { return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(v || 0)); }
  catch { return v; }
}
function toYYYYMM01(d) {
  const dt = new Date(d); dt.setDate(1);
  return dt.toISOString().slice(0, 10); // YYYY-MM-01
}
function fromMonthInput(val) {
  // "2025-08" -> "2025-08-01"
  if (!val) return toYYYYMM01(new Date());
  return `${val}-01`;
}
function toMonthInput(valYYYYMM01) {
  // "2025-08-01" -> "2025-08"
  return (valYYYYMM01 || toYYYYMM01(new Date())).slice(0, 7);
}
function addMonths(yyyyMm01, n) {
  const d = new Date(yyyyMm01); d.setMonth(d.getMonth() + n);
  return toYYYYMM01(d);
}

export default function FinanceiroPage() {
  const supabase = createClientComponentClient();
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [user, setUser] = useState(null);

  // filtros
  const [month, setMonth] = useState(toYYYYMM01(new Date())); // "YYYY-MM-01"
  const [status, setStatus] = useState("all"); // all | pending | overdue | paid | canceled
  const nextMonth = useMemo(() => addMonths(month, 1), [month]);

  // dados
  const [kpi, setKpi] = useState(null);
  const [rows, setRows] = useState([]);

  // bootstrap: user + admin + dados
  useEffect(() => {
    (async () => {
      const { data: { user }, error } = await supabase.auth.getUser();
      if (error || !user) { setUser(null); setIsAdmin(false); return; }
      setUser(user);

      const { data: adminRes } = await supabase.rpc("is_app_admin");
      setIsAdmin(!!adminRes);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    (async () => {
      if (!user) return;
      await Promise.all([fetchKpi(), fetchRows()]);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, month, status]);

  async function fetchKpi() {
    const { data, error } = await supabase
      .from("v_finance_kpis_month")
      .select("*")
      .eq("month", month)
      .maybeSingle();
    if (error) { setKpi(null); return; }
    setKpi(data);
  }

  async function fetchRows() {
    let q = supabase
      .from("v_payments_enriched")
      .select("*")
      .gte("competence_month", month)
      .lt("competence_month", nextMonth)
      .order("due_date", { ascending: true });

    if (status !== "all") {
      // na view, o campo é "effective_status" (overdue calculado)
      q = q.eq("effective_status", status);
    }
    const { data, error } = await q;
    if (error) { setRows([]); setMsg(error.message); return; }
    setRows(data || []);
  }

  // ativa admin para o usuário logado
  async function handleActivateAdmin() {
    setMsg("Ativando admin…");
    // tenta RPC (arquitetura segura, se você criou admin_self_enroll)
    const { data: rpcOK, error: rpcErr } = await supabase.rpc("admin_self_enroll");
    if (!rpcErr && rpcOK) {
      setIsAdmin(true); setMsg("✅ Admin ativado via RPC.");
      return;
    }
    // fallback: upsert direto (arquitetura rápida, sem RLS em app_admins)
    const { error: upErr } = await supabase.from("app_admins").upsert({ user_id: user?.id }, { onConflict: "user_id" });
    if (upErr) { setMsg("Falha ao ativar admin: " + upErr.message); return; }

    // confirma
    const { data: isAdmNow } = await supabase.rpc("is_app_admin");
    setIsAdmin(!!isAdmNow);
    setMsg(isAdmNow ? "✅ Você agora é admin." : "Algo deu errado: ainda não consta como admin.");
  }

  async function handlePreview() {
    setLoading(true); setMsg("Simulando geração…");
    const { data, error } = await supabase.rpc("payments_generate_month", {
      p_month: month,
      p_dry_run: true
    });
    setLoading(false);
    if (error) { setMsg("Erro: " + error.message); return; }
    setMsg(`Prévia: seriam criados ${data} lançamentos para ${toMonthInput(month)}.`);
  }

  async function handleGenerate() {
    setLoading(true); setMsg("Gerando lançamentos…");
    const { data, error } = await supabase.rpc("payments_generate_month", {
      p_month: month,
      p_dry_run: false
    });
    setLoading(false);
    if (error) { setMsg("Erro: " + error.message); return; }
    setMsg(`✅ Criados ${data} lançamentos para ${toMonthInput(month)}.`);
    await Promise.all([fetchKpi(), fetchRows()]);
  }

  async function handleMarkPaid(id) {
    setLoading(true);
    const { error } = await supabase.rpc("payment_mark_paid", { p_payment_id: id });
    setLoading(false);
    if (error) { setMsg("Erro ao marcar pago: " + error.message); return; }
    setMsg("✅ Pagamento marcado como pago.");
    await Promise.all([fetchKpi(), fetchRows()]);
  }

  async function handleCancel(id) {
    const note = window.prompt("Motivo do cancelamento (opcional):") || null;
    setLoading(true);
    const { error } = await supabase.rpc("payment_cancel", { p_payment_id: id, p_note: note });
    setLoading(false);
    if (error) { setMsg("Erro ao cancelar: " + error.message); return; }
    setMsg("✅ Pagamento cancelado.");
    await Promise.all([fetchKpi(), fetchRows()]);
  }

  const total = useMemo(() => ({
    paid: kpi?.total_paid || 0,
    pending: kpi?.total_pending || 0,
    overdue: kpi?.total_overdue || 0,
    billed: kpi?.total_billed || 0,
  }), [kpi]);

  return (
    <main className="p-6 space-y-6">
      <header className="flex flex-wrap items-end gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Financeiro</h1>
          <p className="text-sm opacity-70">Gere lançamentos do mês, veja KPIs e administre pagamentos.</p>
        </div>

        <div className="ml-auto flex items-center gap-3">
          <label className="text-sm">Mês</label>
          <input
            type="month"
            className="border rounded-xl px-3 py-2"
            value={toMonthInput(month)}
            onChange={(e) => setMonth(fromMonthInput(e.target.value))}
          />
          <select
            className="border rounded-xl px-3 py-2"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option value="all">Todos</option>
            <option value="pending">Pendentes</option>
            <option value="overdue">Em atraso</option>
            <option value="paid">Pagos</option>
            <option value="canceled">Cancelados</option>
          </select>
        </div>
      </header>

      {/* KPIs */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard label="Faturado" value={fmtMoney(total.billed)} />
        <KpiCard label="Pagos" value={fmtMoney(total.paid)} />
        <KpiCard label="Pendentes" value={fmtMoney(total.pending)} />
        <KpiCard label="Em atraso" value={fmtMoney(total.overdue)} />
      </section>

      {/* Ações de admin */}
      <section className="p-4 rounded-2xl border">
        {!user && <p className="text-sm">Faça login para administrar o financeiro.</p>}

        {user && !isAdmin && (
          <div className="flex items-center gap-3">
            <button
              onClick={handleActivateAdmin}
              className="px-4 py-2 rounded-xl bg-black text-white"
            >
              Ativar Admin (este usuário)
            </button>
            <p className="text-sm opacity-70">
              Necessário para gerar lançamentos. Se falhar, confirme no backend a whitelist ou a política da tabela <code>app_admins</code>.
            </p>
          </div>
        )}

        {user && isAdmin && (
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={handlePreview}
              disabled={loading}
              className="px-4 py-2 rounded-xl border"
            >
              Prévia do mês
            </button>
            <button
              onClick={handleGenerate}
              disabled={loading}
              className="px-4 py-2 rounded-xl border"
            >
              Gerar mês
            </button>
            <span className="text-sm opacity-70">{msg}</span>
          </div>
        )}
      </section>

      {/* Tabela */}
      <section className="overflow-x-auto">
        <table className="min-w-full border rounded-2xl overflow-hidden">
          <thead className="bg-gray-50">
            <tr className="[&>th]:text-left [&>th]:px-3 [&>th]:py-2">
              <th>Aluno</th>
              <th>Pagador</th>
              <th>Competência</th>
              <th>Vencimento</th>
              <th>Valor</th>
              <th>Status</th>
              <th className="text-right pr-4">Ações</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t [&>td]:px-3 [&>td]:py-2">
                <td>{r.student_name}</td>
                <td>{r.payer_name}</td>
                <td>{new Date(r.competence_month).toLocaleDateString("pt-BR", { year: "numeric", month: "2-digit" })}</td>
                <td>{new Date(r.due_date).toLocaleDateString("pt-BR")}</td>
                <td>{fmtMoney(r.amount)}</td>
                <td>
                  <span className={`px-2 py-1 rounded-full text-xs ${
                    r.effective_status === "paid" ? "bg-green-100" :
                    r.effective_status === "overdue" ? "bg-red-100" :
                    r.effective_status === "pending" ? "bg-yellow-100" :
                    "bg-gray-100"
                  }`}>
                    {r.effective_status}
                  </span>
                  {r.effective_status === "overdue" && r.days_overdue > 0 && (
                    <span className="ml-2 text-xs opacity-70">({r.days_overdue}d)</span>
                  )}
                </td>
                <td className="text-right pr-4">
                  {isAdmin && (
                    <div className="flex gap-2 justify-end">
                      {(r.effective_status !== "paid" && r.status !== "canceled") && (
                        <button
                          onClick={() => handleMarkPaid(r.id)}
                          className="px-3 py-1 rounded-xl border"
                        >
                          Marcar pago
                        </button>
                      )}
                      {r.status !== "canceled" && (
                        <button
                          onClick={() => handleCancel(r.id)}
                          className="px-3 py-1 rounded-xl border"
                        >
                          Cancelar
                        </button>
                      )}
                    </div>
                  )}
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={7} className="text-center py-8 text-sm opacity-70">
                  Sem lançamentos para {toMonthInput(month)} com o filtro selecionado.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
    </main>
  );
}

function KpiCard({ label, value }) {
  return (
    <div className="p-4 border rounded-2xl">
      <div className="text-sm opacity-70">{label}</div>
      <div className="text-xl font-semibold">{value}</div>
    </div>
  );
}
