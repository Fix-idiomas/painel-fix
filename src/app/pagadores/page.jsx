'use client';

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

/* utils */
function formatBR(v) {
  if (v == null || isNaN(Number(v))) return '—';
  try { return Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }); }
  catch { return `R$ ${v}`; }
}
async function safeSelect(label, q) {
  const { data, error } = await q;
  if (error) {
    console.error(`[${label}]`, error);
    throw new Error(error.message || label);
  }
  return data;
}

export default function PagadoresPage() {
  const [rows, setRows] = useState([]); // [{id, name, studentCount, monthlyTotal, studentNames}]
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState('');

  // modal CRUD
  const [modalOpen, setModalOpen] = useState(false);
  const [editId, setEditId] = useState(null);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return rows;
    return rows.filter(r =>
      r.name.toLowerCase().includes(s) ||
      r.studentNames.join(' ').toLowerCase().includes(s)
    );
  }, [rows, q]);

  useEffect(() => { loadAll(); }, []);

  async function loadAll() {
    try {
      setLoading(true);

      // 1) pagadores
      const payers = await safeSelect(
        'payers',
        supabase.from('payers').select('id_uuid, name').order('name', { ascending: true })
      );
      if (!payers?.length) { setRows([]); return; }
      const payerIds = payers.map(p => p.id_uuid);

      // 2) alunos desses pagadores
      const studs = await safeSelect(
        'students.ofPayers',
        supabase
          .from('students')
          .select('id_uuid, name, payer_id_uuid')
          .in('payer_id_uuid', payerIds)
      );

      // map pagador -> alunos
      const byPayer = new Map(); // payer_id_uuid -> {ids:Set, names:Set}
      (studs ?? []).forEach(s => {
        if (!s.payer_id_uuid) return;
        if (!byPayer.has(s.payer_id_uuid)) byPayer.set(s.payer_id_uuid, { ids: new Set(), names: new Set() });
        byPayer.get(s.payer_id_uuid).ids.add(s.id_uuid);
        byPayer.get(s.payer_id_uuid).names.add(s.name || s.id_uuid);
      });

      // 3) soma mensalidade por aluno (vínculos ativos)
      const allStudentIds = Array.from(new Set((studs ?? []).map(s => s.id_uuid)));
      let monthlyByStudent = new Map();
      if (allStudentIds.length) {
        const links = await safeSelect(
          'turma_students',
          supabase
            .from('turma_students')
            .select('student_id_uuid, active, monthly_value')
            .in('student_id_uuid', allStudentIds)
        );
        (links ?? []).forEach(l => {
          if (!l.active) return;
          const sid = l.student_id_uuid;
          const mv  = Number(l.monthly_value) || 0;
          monthlyByStudent.set(sid, (monthlyByStudent.get(sid) || 0) + mv);
        });
      }

      // 4) montar linhas
      const list = payers.map(p => {
        const agg = byPayer.get(p.id_uuid);
        const studentIds   = Array.from(agg?.ids || []);
        const studentNames = Array.from(agg?.names || [])
          .sort((a,b)=>a.localeCompare(b,'pt-BR',{sensitivity:'base'}));
        const monthlyTotal = studentIds.reduce((acc, id) => acc + (Number(monthlyByStudent.get(id)) || 0), 0);

        return {
          id: p.id_uuid,
          name: p.name || p.id_uuid,
          studentCount: studentIds.length,
          monthlyTotal,
          studentNames,
        };
      }).sort((a,b)=> a.name.localeCompare(b.name,'pt-BR',{sensitivity:'base'}));

      setRows(list);
    } catch (e) {
      console.error(e);
      alert(e.message || 'Erro ao carregar pagadores');
    } finally {
      setLoading(false);
    }
  }

  function openCreate() { setEditId(null); setModalOpen(true); }
  function openEdit(id) { setEditId(id); setModalOpen(true); }
  async function handleClose(changed) {
    setModalOpen(false);
    setEditId(null);
    if (changed) await loadAll();
  }

  return (
    <main className="mx-auto max-w-7xl px-6 py-8 space-y-6">
      <header className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Pagadores</h1>
          <p className="text-sm text-slate-600">
            Soma das mensalidades dos alunos vinculados (somente vínculos ativos).
          </p>
        </div>
        <div className="flex items-center gap-2">
          <input
            className="rounded border px-3 py-2 text-sm"
            placeholder="Buscar por pagador ou aluno…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <button
            className="rounded bg-indigo-700 px-4 py-2 text-sm text-white hover:bg-indigo-800"
            onClick={openCreate}
          >
            Novo pagador
          </button>
        </div>
      </header>

      <div className="bg-white rounded-lg border overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="text-left font-medium px-3 py-2">Pagador</th>
              <th className="text-left font-medium px-3 py-2">Alunos</th>
              <th className="text-left font-medium px-3 py-2">Mensalidades (soma)</th>
              <th className="text-left font-medium px-3 py-2">Lista de alunos</th>
              <th className="text-left font-medium px-3 py-2">Ações</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td className="px-3 py-6" colSpan={5}>Carregando…</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td className="px-3 py-6 text-slate-500" colSpan={5}>Nenhum pagador encontrado.</td></tr>
            ) : (
              filtered.map((r) => (
                <tr key={r.id} className="border-t align-top">
                  <td className="px-3 py-2">{r.name}</td>
                  <td className="px-3 py-2">{r.studentCount}</td>
                  <td className="px-3 py-2">{formatBR(r.monthlyTotal)}</td>
                  <td className="px-3 py-2">
                    {r.studentNames.length ? (
                      <div className="max-w-[32rem] truncate" title={r.studentNames.join(', ')}>
                        {r.studentNames.join(', ')}
                      </div>
                    ) : '—'}
                  </td>
                  <td className="px-3 py-2">
                    <button
                      className="rounded bg-slate-100 px-3 py-1 text-xs hover:bg-slate-200"
                      onClick={() => openEdit(r.id)}
                    >
                      Editar
                    </button>
                    {/* futuro: "Pagar em grupo" */}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <PayerDialog open={modalOpen} onClose={handleClose} payerId={editId} />
    </main>
  );
}

/* Modal: criar/editar pagador (name) */
function PayerDialog({ open, onClose, payerId }) {
  const isEdit = !!payerId;
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (!isEdit) { setName(''); return; }
    (async () => {
      try {
        const { data, error } = await supabase
          .from('payers')
          .select('id_uuid, name')
          .eq('id_uuid', payerId)
          .single();
        if (error) throw error;
        setName(data?.name || '');
      } catch (e) {
        console.error(e);
        alert(e.message || 'Erro ao carregar pagador.');
      }
    })();
  }, [open, isEdit, payerId]);

  async function handleSave() {
    try {
      setSaving(true);
      if (!name.trim()) { alert('Informe o nome do pagador.'); return; }

      if (isEdit) {
        const { error } = await supabase
          .from('payers')
          .update({ name: name.trim() })
          .eq('id_uuid', payerId);
        if (error) throw error;
      } else {
        const id = crypto.randomUUID();
        const { error } = await supabase
          .from('payers')
          .insert({ id_uuid: id, name: name.trim() });
        if (error) throw error;
      }
      onClose?.(true);
    } catch (e) {
      console.error(e);
      alert(e.message || 'Não foi possível salvar o pagador.');
    } finally {
      setSaving(false);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
      <div className="w-full max-w-md rounded-xl bg-white border shadow-lg">
        <div className="px-5 py-4 border-b flex items-center justify-between">
          <h2 className="text-base font-semibold">{isEdit ? 'Editar pagador' : 'Novo pagador'}</h2>
          <button className="text-slate-500 hover:text-slate-700" onClick={() => onClose?.(false)}>✕</button>
        </div>

        <div className="p-5 space-y-4">
          <label className="text-sm block">
            Nome do pagador
            <input
              className="mt-1 w-full rounded border p-2"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex.: Família Silva"
            />
          </label>
        </div>

        <div className="px-5 py-4 border-t flex items-center justify-end gap-3">
          <button className="rounded border px-4 py-2 text-sm hover:bg-slate-50" onClick={() => onClose?.(false)} disabled={saving}>
            Cancelar
          </button>
          <button
            className="rounded bg-indigo-700 px-4 py-2 text-sm text-white hover:bg-indigo-800 disabled:opacity-50"
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? 'Salvando…' : 'Salvar'}
          </button>
        </div>
      </div>
    </div>
  );
}
