'use client';

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import NewStudentDialog from '@/components/alunos/NewStudentDialog';

function formatBR(v) {
  if (v == null || isNaN(Number(v))) return '—';
  try { return Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }); }
  catch { return `R$ ${v}`; }
}

export default function AlunosAtivosPage() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return rows;
    return rows.filter(r =>
      (r.name || '').toLowerCase().includes(s) ||
      (r.payer || '').toLowerCase().includes(s) ||
      (r.email || '').toLowerCase().includes(s)
    );
  }, [rows, q]);

  useEffect(() => { loadAll(); }, []);

  async function loadAll() {
    try {
      setLoading(true);

      // alunos
      const { data: studs, error: e1 } = await supabase
        .from('students')
        .select('id_uuid, name, email, payer_id_uuid, due_day')
        .order('name', { ascending: true });
      if (e1) throw e1;

      // pagadores
      const payerIds = Array.from(new Set((studs ?? []).map(s => s.payer_id_uuid).filter(Boolean)));
      let payerById = new Map();
      if (payerIds.length) {
        const { data: pays, error: e2 } = await supabase
          .from('payers')
          .select('id_uuid, name')
          .in('id_uuid', payerIds);
        if (e2) throw e2;
        payerById = new Map((pays ?? []).map(p => [p.id_uuid, p.name || p.id_uuid]));
      }

      // soma mensalidade por aluno (vínculos ativos)
      const studentIds = (studs ?? []).map(s => s.id_uuid);
      let monthlyByStudent = new Map();
      if (studentIds.length) {
        const { data: links, error: e3 } = await supabase
          .from('turma_students')
          .select('student_id_uuid, active, monthly_value')
          .in('student_id_uuid', studentIds);
        if (e3) throw e3;
        (links ?? []).forEach(l => {
          if (!l.active) return;
          const sid = l.student_id_uuid;
          const mv  = Number(l.monthly_value) || 0;
          monthlyByStudent.set(sid, (monthlyByStudent.get(sid) || 0) + mv);
        });
      }

      const list = (studs ?? []).map(s => ({
        id: s.id_uuid,
        name: s.name || s.id_uuid,
        email: s.email || '',
        payer: payerById.get(s.payer_id_uuid) || '—',
        monthly: monthlyByStudent.get(s.id_uuid) || 0,
        dueDay: s.due_day ?? null,
      }));

      setRows(list);
    } catch (e) {
      console.error(e);
      alert(e.message || 'Erro ao carregar alunos.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto max-w-7xl px-6 py-8 space-y-6">
      <header className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Alunos Ativos</h1>
          <p className="text-sm text-slate-600">
            Cadastre novos alunos, vincule ao pagador e à turma com a mensalidade.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <input
            className="rounded border px-3 py-2 text-sm"
            placeholder="Buscar nome, pagador ou email…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <button
            className="rounded bg-emerald-600 px-4 py-2 text-sm text-white hover:bg-emerald-700"
            onClick={() => setOpen(true)}
          >
            Novo Aluno
          </button>
        </div>
      </header>

      <div className="bg-white rounded-lg border overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="text-left font-medium px-3 py-2">Aluno</th>
              <th className="text-left font-medium px-3 py-2">Contato</th>
              <th className="text-left font-medium px-3 py-2">Mensalidade</th>
              <th className="text-left font-medium px-3 py-2">Responsável</th>
              <th className="text-left font-medium px-3 py-2">Vencimento</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td className="px-3 py-6" colSpan={5}>Carregando…</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td className="px-3 py-6 text-slate-500" colSpan={5}>Nenhum aluno encontrado.</td></tr>
            ) : (
              filtered.map((r) => (
                <tr key={r.id} className="border-t">
                  <td className="px-3 py-2">{r.name}</td>
                  <td className="px-3 py-2">{r.email || '—'}</td>
                  <td className="px-3 py-2">{formatBR(r.monthly)}</td>
                  <td className="px-3 py-2">{r.payer}</td>
                  <td className="px-3 py-2">{r.dueDay ? `dia ${r.dueDay}` : '—'}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <NewStudentDialog
        open={open}
        onClose={(changed) => { setOpen(false); if (changed) loadAll(); }}
      />
    </main>
  );
}
