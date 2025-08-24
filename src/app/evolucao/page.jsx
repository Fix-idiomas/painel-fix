'use client';

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

/* utils */
const isUuid = (v) =>
  typeof v === 'string' &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);

const pickKey = (row, candidates, fallback = null) =>
  candidates.find((k) => row && Object.prototype.hasOwnProperty.call(row, k)) || fallback;

async function softProbeTable(table) {
  try {
    const { data, error } = await supabase.from(table).select('*').limit(1);
    if (error) return { exists: false, row: null, error };
    return { exists: true, row: data?.[0] || null };
  } catch (e) {
    return { exists: false, row: null, error: e };
  }
}

async function safeSelect(label, q) {
  const { data, error } = await q;
  if (error) {
    console.error(`[${label}]`, error);
    throw new Error(error.message || label);
  }
  return data;
}

/* page */
export default function EvolucaoPage() {
  // schemas
  const [turmaKeys, setTurmaKeys]   = useState({ id: 'id_uuid', name: 'nome' });
  const [teacherKeys, setTeachKeys] = useState({ id: 'id_uuid', name: 'name' });
  const [grpKeys, setGrpKeys]       = useState({ id: 'id_uuid', turma: 'turma_id_uuid', teacher: 'teacher_id_uuid', date: 'lesson_date', notes: 'notes' });
  const [indKeys, setIndKeys]       = useState({ id: 'id_uuid', group: 'group_id_uuid', student: 'student_id_uuid', notes: 'notes', createdAt: 'created_at' });
  const [tsKeys, setTsKeys]         = useState({ turma: 'turma_id_uuid', student: 'student_id_uuid', active: 'active' });
  const [studentKeys, setStudentKeys] = useState({ id: 'id_uuid', name: 'name' });

  // dados base
  const [turmas, setTurmas]     = useState([]);
  const [teachers, setTeachers] = useState([]);

  // filtros
  const [month, setMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
  const [fTurma, setFTurma]     = useState('');
  const [fTeacher, setFTeacher] = useState('');

  // lista de aulas (grupos) e contagem de registros individuais por grupo
  const [groups, setGroups]     = useState([]);
  const [indCount, setIndCount] = useState(new Map());
  const [loadingList, setLoadingList] = useState(false);

  // modal registrar aula
  const [open, setOpen] = useState(false);
  const [lDate, setLDate] = useState('');
  const [lTurma, setLTurma] = useState('');
  const [lTeacher, setLTeacher] = useState('');
  const [gNotes, setGNotes] = useState(''); // observação geral
  const [saving, setSaving] = useState(false);

  // alunos da turma selecionada (no modal) + seleção + observações individuais
  const [modalStudents, setModalStudents] = useState([]); // {id, name}
  const [selStudents, setSelStudents] = useState(new Set()); // Set<uuid>
  const [indNotes, setIndNotes] = useState({}); // { [studentId]: text }

  /* boot: detectar schemas e carregar turmas/professores */
  useEffect(() => {
    (async () => {
      try {
        // turmas
        const pT = await softProbeTable('turmas');
        let tk = { id: 'id_uuid', name: 'nome' };
        if (pT.exists && pT.row) {
          const r = pT.row;
          tk = {
            id:   pickKey(r, ['id_uuid','id'], 'id_uuid'),
            name: pickKey(r, ['nome','name','title'], 'nome'),
          };
        }
        setTurmaKeys(tk);
        const tData = await safeSelect('turmas', supabase.from('turmas').select(`id:${tk.id}, nome:${tk.name}`).order(tk.name));
        setTurmas(tData ?? []);

        // teachers
        const pTeach = await softProbeTable('teachers');
        if (pTeach.exists && pTeach.row) {
          const r = pTeach.row;
          setTeachKeys({ id: pickKey(r, ['id_uuid','id'], 'id_uuid'), name: pickKey(r, ['name','nome'], 'name') });
        }
        const tch = await safeSelect('teachers', supabase.from('teachers').select('id:id_uuid, name').order('name'));
        setTeachers(tch ?? []);

        // grupo
        const pG = await softProbeTable('evolucao_registro_grupo');
        if (pG.exists && pG.row) {
          const r = pG.row;
          setGrpKeys({
            id:      pickKey(r, ['id_uuid','id'], 'id_uuid'),
            turma:   pickKey(r, ['turma_id_uuid','turma_id'], 'turma_id_uuid'),
            teacher: pickKey(r, ['teacher_id_uuid','professor_id_uuid','teacher_id'], 'teacher_id_uuid'),
            date:    pickKey(r, ['lesson_date','date','created_at'], 'lesson_date'),
            notes:   pickKey(r, ['notes','observacao','obs'], 'notes'),
          });
        }

        // individual
        const pI = await softProbeTable('evolucao_registro_individual');
        if (pI.exists && pI.row) {
          const r = pI.row;
          setIndKeys({
            id:        pickKey(r, ['id_uuid','id'], 'id_uuid'),
            group:     pickKey(r, ['group_id_uuid','group_id'], 'group_id_uuid'),
            student:   pickKey(r, ['student_id_uuid','student_id','aluno_id_uuid','aluno_id'], 'student_id_uuid'),
            notes:     pickKey(r, ['notes','observacao','obs'], 'notes'),
            createdAt: pickKey(r, ['created_at','date','data'], 'created_at'),
          });
        }

        // turma_students + students (para o modal)
        const pTS = await softProbeTable('turma_students');
        if (pTS.exists && pTS.row) {
          const r = pTS.row;
          setTsKeys({
            turma:   pickKey(r, ['turma_id_uuid','turma_id'], 'turma_id_uuid'),
            student: pickKey(r, ['student_id_uuid','student_id','aluno_id_uuid','aluno_id'], 'student_id_uuid'),
            active:  pickKey(r, ['active','is_active','ativo'], 'active'),
          });
        }
        const pS = await softProbeTable('students');
        if (pS.exists && pS.row) {
          const r = pS.row;
          setStudentKeys({ id: pickKey(r, ['id_uuid','id'], 'id_uuid'), name: pickKey(r, ['name','nome'], 'name') });
        }
      } catch (e) {
        console.error(e);
        alert(e.message || 'Falha ao carregar.');
      }
    })();
  }, []);

  /* carregar lista de aulas (grupos) do mês/filtros */
  useEffect(() => {
    (async () => {
      try {
        setLoadingList(true);
        const [y, m] = month.split('-').map(Number);
        const start = new Date(y, m - 1, 1);
        const end   = new Date(y, m, 1); // mês seguinte

        let q = supabase
          .from('evolucao_registro_grupo')
          .select(`id:${grpKeys.id}, ${grpKeys.date}, ${grpKeys.turma}, ${grpKeys.teacher}, ${grpKeys.notes}`)
          .gte(grpKeys.date, start.toISOString().slice(0,10))
          .lt(grpKeys.date, end.toISOString().slice(0,10))
          .order(grpKeys.date, { ascending: false });
        if (isUuid(fTurma))   q = q.eq(grpKeys.turma, fTurma);
        if (isUuid(fTeacher)) q = q.eq(grpKeys.teacher, fTeacher);

        const { data, error } = await q;
        if (error) throw error;

        setGroups(data ?? []);

        // buscar contagem de individuais por grupo (em lote)
        const ids = (data ?? []).map(g => g.id).filter(Boolean);
        if (ids.length) {
          const ind = await safeSelect('ind(byGroup)',
            supabase.from('evolucao_registro_individual').select(`id:${indKeys.id}, ${indKeys.group}`).in(indKeys.group, ids)
          );
          const map = new Map();
          (ind ?? []).forEach(r => {
            const gid = r[indKeys.group];
            map.set(gid, (map.get(gid) || 0) + 1);
          });
          setIndCount(map);
        } else {
          setIndCount(new Map());
        }
      } catch (e) {
        console.error(e);
        alert(e.message || 'Erro ao listar aulas.');
      } finally {
        setLoadingList(false);
      }
    })();
  }, [month, fTurma, fTeacher, grpKeys]);

  const mapTurmaNome = useMemo(() => new Map(turmas.map(t => [t.id, t.nome || t.id])), [turmas]);
  const mapTeacherNome = useMemo(() => new Map(teachers.map(t => [t.id, t.name || t.id])), [teachers]);

  /* --- helpers modal --- */
  function toggleStudent(id) {
    setSelStudents(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }
  function selectAllModalStudents() {
    setSelStudents(new Set(modalStudents.map(s => s.id)));
  }
  function clearAllModalStudents() {
    setSelStudents(new Set());
  }
  function applyGeneralToEmpty() {
    if (!gNotes.trim()) return;
    setIndNotes(prev => {
      const next = { ...prev };
      for (const s of modalStudents) {
        if (selStudents.has(s.id) && !next[s.id]) {
          next[s.id] = gNotes;
        }
      }
      return next;
    });
  }

  /* carregar alunos ativos da turma (ao abrir ou trocar turma no modal) */
  useEffect(() => {
    (async () => {
      if (!open || !isUuid(lTurma)) {
        setModalStudents([]);
        setSelStudents(new Set());
        setIndNotes({});
        return;
      }
      try {
        // vínculos da turma
        const vincs = await safeSelect('ts(modal)', supabase.from('turma_students').select('*').eq(tsKeys.turma, lTurma));
        const activeIds = Array.from(new Set((vincs ?? []).filter(v => (typeof v[tsKeys.active]==='boolean' ? v[tsKeys.active] : !!v[tsKeys.active])).map(v=> v[tsKeys.student]).filter(Boolean)));
        if (!activeIds.length) {
          setModalStudents([]);
          setSelStudents(new Set());
          setIndNotes({});
          return;
        }
        const studs = await safeSelect('students(inModal)', supabase.from('students').select('*').in(studentKeys.id, activeIds));
        const list = (studs ?? [])
          .map(a => ({ id: a[studentKeys.id], name: a[studentKeys.name] || '(sem nome)' }))
          .sort((a,b)=> (a.name||'').localeCompare(b.name||'', 'pt-BR', {sensitivity:'base'}));
        setModalStudents(list);
        setSelStudents(new Set(list.map(s => s.id))); // por padrão, todos selecionados
        setIndNotes({});
      } catch (e) {
        console.error(e);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, lTurma]);

  /* salvar aula + observações */
  async function handleSave() {
    if (!lDate) return alert('Informe a data da aula.');
    if (!isUuid(lTurma)) return alert('Selecione a turma.');
    if (!isUuid(lTeacher)) return alert('Selecione o professor executante.');

    setSaving(true);
    try {
      // 1) cria o CABEÇALHO (grupo)
      const payloadG = {
        [grpKeys.turma]: lTurma,
        [grpKeys.teacher]: lTeacher,
        [grpKeys.date]: lDate,
        [grpKeys.notes]: gNotes || null,
      };
      const { data: gData, error: gErr } = await supabase
        .from('evolucao_registro_grupo')
        .insert(payloadG)
        .select(`id:${grpKeys.id}`)
        .single();
      if (gErr) throw gErr;
      const groupId = gData?.id;

      // 2) cria INDIVIDUAIS (um por aluno selecionado)
      const rows = [];
      for (const s of modalStudents) {
        if (!selStudents.has(s.id)) continue;
        rows.push({
          [indKeys.group]: groupId,
          [indKeys.student]: s.id,
          [indKeys.notes]: indNotes[s.id]?.trim() || null,
        });
      }
      if (rows.length) {
        const { error: iErr } = await supabase.from('evolucao_registro_individual').insert(rows);
        if (iErr) throw iErr;
      }

      // fechar modal + limpar
      setOpen(false);
      setLDate(''); setLTurma(''); setLTeacher(''); setGNotes('');
      setModalStudents([]); setSelStudents(new Set()); setIndNotes({});

      // recarregar lista (aproveita os filtros atuais)
      setMonth(v => v); // nudge
    } catch (e) {
      console.error(e);
      alert(e.message || 'Não foi possível salvar o registro da aula.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-7xl px-6 py-8 space-y-6">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Evolução Pedagógica</h1>
          <p className="text-sm text-slate-600">Registre aulas com observação geral da turma e observações por aluno.</p>
        </div>
        <button
          className="rounded bg-indigo-700 px-4 py-2 text-sm text-white hover:bg-indigo-800"
          onClick={() => setOpen(true)}
        >
          Registrar aula
        </button>
      </div>

      {/* filtros */}
      <div className="bg-white rounded-lg border p-4 flex flex-wrap gap-4 items-end">
        <label className="text-sm">
          Mês
          <input
            type="month"
            className="mt-1 border rounded px-3 py-2 bg-white"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
          />
        </label>

        <label className="text-sm">
          Turma
          <select
            className="mt-1 border rounded px-3 py-2 bg-white"
            value={fTurma}
            onChange={(e) => setFTurma(e.target.value)}
          >
            <option value="">Todas</option>
            {turmas.map((t) => (
              <option key={t.id} value={t.id}>{t.nome || t.id}</option>
            ))}
          </select>
        </label>

        <label className="text-sm">
          Professor
          <select
            className="mt-1 border rounded px-3 py-2 bg-white"
            value={fTeacher}
            onChange={(e) => setFTeacher(e.target.value)}
          >
            <option value="">Todos</option>
            {teachers.map((t) => (
              <option key={t.id} value={t.id}>{t.name || t.id}</option>
            ))}
          </select>
        </label>
      </div>

      {/* tabela de aulas (grupos) */}
      <div className="bg-white rounded-lg border overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="text-left font-medium px-3 py-2">Data</th>
              <th className="text-left font-medium px-3 py-2">Turma</th>
              <th className="text-left font-medium px-3 py-2">Professor</th>
              <th className="text-left font-medium px-3 py-2">Obs. geral</th>
              <th className="text-center font-medium px-3 py-2">Individuais</th>
            </tr>
          </thead>
          <tbody>
            {loadingList ? (
              <tr><td className="px-3 py-4" colSpan={5}>Carregando…</td></tr>
            ) : groups.length === 0 ? (
              <tr><td className="px-3 py-4 text-slate-500" colSpan={5}>Nenhuma aula registrada no período.</td></tr>
            ) : (
              groups.map((g) => (
                <tr key={g.id} className="border-t">
                  <td className="px-3 py-2">{g[grpKeys.date] || '-'}</td>
                  <td className="px-3 py-2">{mapTurmaNome.get(g[grpKeys.turma]) || g[grpKeys.turma]}</td>
                  <td className="px-3 py-2">{mapTeacherNome.get(g[grpKeys.teacher]) || g[grpKeys.teacher]}</td>
                  <td className="px-3 py-2 truncate max-w-[22rem]">{g[grpKeys.notes] || '-'}</td>
                  <td className="px-3 py-2 text-center">{indCount.get(g.id) || 0}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* modal: registrar aula */}
      {open && (
        <Modal title="Registrar aula" onClose={() => setOpen(false)}>
          <div className="p-5 space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <label className="text-sm">
                Data
                <input
                  type="date"
                  className="mt-1 border rounded px-3 py-2 bg-white w-full"
                  value={lDate}
                  onChange={(e) => setLDate(e.target.value)}
                />
              </label>
              <label className="text-sm md:col-span-2">
                Turma
                <select
                  className="mt-1 border rounded px-3 py-2 bg-white w-full"
                  value={lTurma}
                  onChange={(e) => setLTurma(e.target.value)}
                >
                  <option value="">Selecione</option>
                  {turmas.map((t) => (
                    <option key={t.id} value={t.id}>{t.nome || t.id}</option>
                  ))}
                </select>
              </label>
            </div>

            <label className="text-sm block">
              Professor executante
              <select
                className="mt-1 border rounded px-3 py-2 bg-white w-full"
                value={lTeacher}
                onChange={(e) => setLTeacher(e.target.value)}
              >
                <option value="">Selecione</option>
                {teachers.map((t) => (
                  <option key={t.id} value={t.id}>{t.name || t.id}</option>
                ))}
              </select>
            </label>

            <label className="text-sm block">
              Observação geral da turma
              <textarea
                className="mt-1 border rounded px-3 py-2 bg-white w-full"
                rows={3}
                placeholder="Ex.: Conteúdo, desempenho geral, recados…"
                value={gNotes}
                onChange={(e) => setGNotes(e.target.value)}
              />
            </label>

            {/* Alunos ativos da turma */}
            <div className="text-sm">
              <div className="flex items-center justify-between mb-2">
                <div className="font-medium">Observações individuais</div>
                <div className="flex gap-2">
                  <button className="rounded border px-2 py-1 text-xs hover:bg-slate-50" type="button" onClick={selectAllModalStudents}>Selecionar todos</button>
                  <button className="rounded border px-2 py-1 text-xs hover:bg-slate-50" type="button" onClick={clearAllModalStudents}>Limpar</button>
                  <button className="rounded border px-2 py-1 text-xs hover:bg-slate-50" type="button" onClick={applyGeneralToEmpty}>Aplicar obs. geral nos vazios</button>
                </div>
              </div>

              {(!isUuid(lTurma)) ? (
                <div className="text-slate-500">Selecione uma turma para carregar os alunos ativos.</div>
              ) : modalStudents.length === 0 ? (
                <div className="text-slate-500">Nenhum aluno ativo encontrado nesta turma.</div>
              ) : (
                <div className="max-h-80 overflow-auto border rounded">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 text-slate-600">
                      <tr>
                        <th className="px-3 py-2 w-10"></th>
                        <th className="px-3 py-2 text-left">Aluno</th>
                        <th className="px-3 py-2 text-left">Observação</th>
                      </tr>
                    </thead>
                    <tbody>
                      {modalStudents.map((s) => (
                        <tr key={s.id} className="border-t align-top">
                          <td className="px-3 py-2">
                            <input type="checkbox" checked={selStudents.has(s.id)} onChange={() => toggleStudent(s.id)} />
                          </td>
                          <td className="px-3 py-2">{s.name}</td>
                          <td className="px-3 py-2">
                            <textarea
                              className="border rounded px-2 py-1 bg-white w-full"
                              rows={2}
                              placeholder="Observação deste aluno (opcional)"
                              value={indNotes[s.id] || ''}
                              onChange={(e) => setIndNotes((prev) => ({ ...prev, [s.id]: e.target.value }))}
                              disabled={!selStudents.has(s.id)}
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          <div className="px-5 py-4 border-t flex items-center justify-end gap-3">
            <button className="rounded border px-4 py-2 text-sm hover:bg-slate-50" onClick={() => setOpen(false)} disabled={saving}>
              Cancelar
            </button>
            <button
              className="rounded bg-indigo-700 px-4 py-2 text-sm text-white hover:bg-indigo-800 disabled:opacity-50"
              onClick={handleSave}
              disabled={saving || !lDate || !isUuid(lTurma) || !isUuid(lTeacher) || selStudents.size === 0}
            >
              {saving ? 'Salvando…' : 'Salvar'}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

/* UI */
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
