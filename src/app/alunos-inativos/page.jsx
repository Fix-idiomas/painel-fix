'use client';

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

const pickKey = (row, candidates, fallback) =>
  candidates.find((k) => row && Object.prototype.hasOwnProperty.call(row, k)) || fallback;

export default function AlunosInativosPage() {
  const [rows, setRows] = useState([]);   // [{ id, name, email, phone, turmas:[{id,nome}] }]
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [hasActive, setHasActive] = useState(true); // detectado por “probe”
  const [keys, setKeys] = useState({
    studentKey: 'student_id_uuid',
    turmaKey: 'turma_id',
  });

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        // 0) PROBE: testa se a coluna 'active' existe (independe de ter linhas)
        const probe = await supabase.from('turma_students').select('active').limit(1);
        if (probe.error) {
          const msg = (probe.error.message || '').toLowerCase();
          if (msg.includes('column') && msg.includes('active')) {
            setHasActive(false);
          } else {
            // erro diferente (ex.: RLS) – exiba de forma clara
            throw probe.error;
          }
        } else {
          setHasActive(true);
        }

        // 1) lê vínculos (pode vir vazio; usamos chaves padrão quando não há sample)
        const { data: vincs, error: eV } = await supabase.from('turma_students').select('*');
        if (eV) throw eV;

        const sample = vincs?.[0] || {};
        const studentKey = pickKey(
          sample,
          ['student_id_uuid', 'aluno_id', 'student_id', 'student', 'aluno_uuid'],
          'student_id_uuid'
        );
        const turmaKey = pickKey(sample, ['turma_id', 'id_turma_uuid', 'turma_uuid', 'turma'], 'turma_id');
        setKeys({ studentKey, turmaKey });

        if (!hasActive && probe.error) {
          // sem coluna 'active' => não há conceito de "inativo"
          setRows([]);
          setLoading(false);
          return;
        }

        // 2) apenas vínculos inativos
        const inativos = (vincs ?? []).filter((r) => r.active === false);

        // 3) agrupa turmas por aluno
        const alunosSet = new Set();
        const turmasSet = new Set();
        const turmaIdsByAluno = new Map();

        for (const r of inativos) {
          const sid = r[studentKey];
          const tid = r[turmaKey];
          if (!sid || !tid) continue;
          alunosSet.add(sid);
          turmasSet.add(tid);
          if (!turmaIdsByAluno.has(sid)) turmaIdsByAluno.set(sid, new Set());
          turmaIdsByAluno.get(sid).add(tid);
        }

        // 4) alunos
        let alunos = [];
        if (alunosSet.size) {
          const { data, error } = await supabase
            .from('students')
            .select('id_uuid, name, email, phone')
            .in('id_uuid', Array.from(alunosSet));
          if (error) throw error;
          alunos = data ?? [];
        }

        // 5) turmas
        let turmasMap = new Map();
        if (turmasSet.size) {
          const { data, error } = await supabase
            .from('turmas')
            .select('id_uuid, nome')
            .in('id_uuid', Array.from(turmasSet));
          if (error) throw error;
          turmasMap = new Map((data ?? []).map((t) => [t.id_uuid, t]));
        }

        // 6) monta linhas
        const list = (alunos ?? []).map((a) => {
          const ids = Array.from(turmaIdsByAluno.get(a.id_uuid) || []);
          const turmas = ids.map((id) => ({ id, nome: turmasMap.get(id)?.nome || '' }));
          turmas.sort((x, y) => (x.nome || '').localeCompare(y.nome || '', 'pt-BR', { sensitivity: 'base' }));
          return {
            id: a.id_uuid,
            name: a.name ?? '',
            email: a.email ?? '',
            phone: a.phone ?? '',
            turmas,
          };
        });

        list.sort((a, b) => (a.name || '').localeCompare(b.name || '', 'pt-BR', { sensitivity: 'base' }));
        setRows(list);
      } catch (e) {
        console.error(e);
        alert(e.message || 'Erro ao carregar alunos inativos');
      } finally {
        setLoading(false);
      }
    })();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const filtered = useMemo(() => {
    if (!q.trim()) return rows;
    const v = q.toLowerCase().trim();
    return rows.filter(
      (r) =>
        (r.name && r.name.toLowerCase().includes(v)) ||
        (r.email && r.email.toLowerCase().includes(v)) ||
        (r.phone && r.phone.toLowerCase().includes(v))
    );
  }, [rows, q]);

  async function reactivateOne(studentId, turmaId) {
    try {
      const { error } = await supabase
        .from('turma_students')
        .update({ active: true })
        .eq(keys.studentKey, studentId)
        .eq(keys.turmaKey, turmaId);
      if (error) throw error;

      setRows((prev) =>
        prev
          .map((r) =>
            r.id !== studentId ? r : { ...r, turmas: r.turmas.filter((t) => t.id !== turmaId) }
          )
          .filter((r) => r.turmas.length > 0)
      );
    } catch (e) {
      console.error(e);
      alert(e.message || 'Não foi possível reativar este vínculo.');
    }
  }

  async function reactivateAll(studentId, turmaIds) {
    try {
      const { error } = await supabase
        .from('turma_students')
        .update({ active: true })
        .eq(keys.studentKey, studentId)
        .in(keys.turmaKey, turmaIds);
      if (error) throw error;

      setRows((prev) => prev.filter((r) => r.id !== studentId));
    } catch (e) {
      console.error(e);
      alert(e.message || 'Não foi possível reativar os vínculos deste aluno.');
    }
  }

  async function deleteLink(studentId, turmaId) {
    if (!confirm('Excluir definitivamente o vínculo deste aluno com a turma?')) return;
    try {
      const { error } = await supabase
        .from('turma_students')
        .delete()
        .eq(keys.studentKey, studentId)
        .eq(keys.turmaKey, turmaId);
      if (error) throw error;

      setRows((prev) =>
        prev
          .map((r) =>
            r.id !== studentId ? r : { ...r, turmas: r.turmas.filter((t) => t.id !== turmaId) }
          )
          .filter((r) => r.turmas.length > 0)
      );
    } catch (e) {
      console.error(e);
      alert(e.message || 'Não foi possível excluir o vínculo.');
    }
  }

  return (
    <main className="space-y-6">
      <header className="flex items-end justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Alunos Inativos</h1>
          <p className="text-sm text-slate-600">
            Lista de alunos com vínculos desativados em turmas. Reative por turma ou todos.
          </p>
          {!hasActive && (
            <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1 inline-block mt-2">
              Observação: sua tabela <code>turma_students</code> não possui a coluna <code>active</code>.
              Sem esse campo, não é possível identificar “inativos”.
            </p>
          )}
        </div>

        <div className="w-64">
          <label className="text-sm block">
            Buscar aluno
            <input
              type="text"
              className="mt-1 w-full border rounded px-3 py-2 bg-white"
              placeholder="Nome, email ou telefone…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </label>
        </div>
      </header>

      <section className="bg-white rounded-lg border">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="bg-slate-50 text-slate-600">
                <th className="text-left font-medium px-4 py-3">Nome</th>
                <th className="text-left font-medium px-4 py-3">Contato</th>
                <th className="text-left font-medium px-4 py-3">Turmas (inativas)</th>
                <th className="text-left font-medium px-4 py-3">Ações</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={4} className="px-4 py-6 text-center text-slate-500">Carregando…</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={4} className="px-4 py-6 text-center text-slate-500">Nenhum aluno inativo.</td></tr>
              ) : (
                filtered.map((r) => (
                  <tr key={r.id} className="border-t align-top">
                    <td className="px-4 py-3 font-medium">{r.name || '(sem nome)'}</td>
                    <td className="px-4 py-3">
                      {r.email || r.phone ? (
                        <div className="space-y-0.5">
                          {r.email && <div className="text-slate-700">{r.email}</div>}
                          {r.phone && <div className="text-slate-500 text-xs">{r.phone}</div>}
                        </div>
                      ) : '—'}
                    </td>
                    <td className="px-4 py-3">
                      {r.turmas.length === 0 ? (
                        <span className="text-xs text-slate-400">Sem turmas.</span>
                      ) : (
                        <div className="flex flex-wrap gap-2">
                          {r.turmas.map((t) => (
                            <span key={t.id} className="inline-flex items-center gap-2 rounded-full border bg-white px-3 py-1 text-xs">
                              <span className="font-medium">{t.nome || t.id}</span>
                              <button
                                className="text-emerald-700 hover:text-emerald-800"
                                title="Reativar aluno nesta turma"
                                onClick={() => reactivateOne(r.id, t.id)}
                              >
                                Reativar
                              </button>
                              <button
                                className="text-rose-600 hover:text-rose-700"
                                title="Excluir vínculo"
                                onClick={() => deleteLink(r.id, t.id)}
                              >
                                Excluir
                              </button>
                            </span>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {r.turmas.length > 0 && (
                        <button
                          className="rounded border px-3 py-1.5 text-xs hover:bg-emerald-50 border-emerald-200 text-emerald-700"
                          onClick={() => reactivateAll(r.id, r.turmas.map((t) => t.id))}
                        >
                          Reativar todas
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
