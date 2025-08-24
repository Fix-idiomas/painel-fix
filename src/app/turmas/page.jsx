'use client';

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import Header from '@/components/layout/Header';
import Tabs from '@/components/Tabs';

/* ================= helpers ================= */
const isUuid = (v) =>
  typeof v === 'string' &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);

const pickKey = (row, candidates, fallback = null) =>
  candidates.find((k) => row && Object.prototype.hasOwnProperty.call(row, k)) || fallback;

async function safeSelect(label, q) {
  const { data, error } = await q;
  if (error) {
    console.error(`[${label}]`, error);
    throw new Error(error.message || `[${label}] falhou`);
  }
  return data;
}
// “probe” que não explode caso a tabela não exista
async function softProbeTable(table) {
  try {
    const { data, error } = await supabase.from(table).select('*').limit(1);
    if (error) return { exists: false, row: null, error };
    return { exists: true, row: data?.[0] || null };
  } catch (e) {
    return { exists: false, row: null, error: e };
  }
}

/* ================= page ================= */
export default function TurmasPage() {
  const [turmas, setTurmas] = useState([]);
  const [alunos, setAlunos] = useState([]);
  const [teachers, setTeachers] = useState([]);

  const [turmaId, setTurmaId] = useState('');
  const [alunoId, setAlunoId] = useState('');
  const [loading, setLoading] = useState(false);

  // schemas detectados
  const [turmaKeys, setTurmaKeys] = useState({
    id: 'id_uuid', name: 'nome', status: null, inicio: null, fim: null, titular: null
  });
  const [studentKeys, setStudentKeys] = useState({ id: 'id_uuid', name: 'name' });
  const [teacherKeys, setTeacherKeys] = useState({ id: 'id_uuid', name: 'name' });

  // vínculo turma-professor
  const [tpTable, setTpTable] = useState(null); // 'turma_teachers' | 'turma_professor' | null
  const [tpKeys, setTpKeys] = useState({ turma: 'turma_id_uuid', teacher: 'teacher_id_uuid', role: null });

  // ===== Drawer (todas as turmas)
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerQ, setDrawerQ] = useState('');
  const [drawerStatus, setDrawerStatus] = useState('todas'); // todas | ativas | inativas

  // ===== Nova turma (modal)
  const [newOpen, setNewOpen] = useState(false);
  const [nNome, setNNome] = useState('');
  const [nStatus, setNStatus] = useState('ativa');
  const [nInicio, setNInicio] = useState('');
  const [nFim, setNFim] = useState('');
  const [nTitular, setNTitular] = useState('');
  const [nSubs, setNSubs] = useState([]); // teacher ids
  const [busy, setBusy] = useState(false);

  // ===== Registrar aula (modal)
  const [lessonOpen, setLessonOpen] = useState(false);
  const [lDate, setLDate] = useState('');
  const [lTurma, setLTurma] = useState('');
  const [lTeacher, setLTeacher] = useState('');
  const [lessonBusy, setLessonBusy] = useState(false);

  // tabela e chaves para salvar as aulas
  const [lessonTbl, setLessonTbl] = useState(null); // 'aulas' | 'lessons' | 'turma_aulas' | null
  const [lessonKeys, setLessonKeys] = useState({
    id: 'id_uuid', turma: 'turma_id_uuid', teacher: 'teacher_id_uuid', date: 'date'
  });

  /* ============== boot: detectar esquemas e carregar listas ============== */
  useEffect(() => {
    (async () => {
      try {
        // TURMAS
        const pT = await softProbeTable('turmas');
        let tk = { id: 'id_uuid', name: 'nome', status: null, inicio: null, fim: null, titular: null };
        if (pT.exists && pT.row) {
          const r = pT.row;
          tk = {
            id:      pickKey(r, ['id_uuid','id'], 'id_uuid'),
            name:    pickKey(r, ['nome','name','title'], 'nome'),
            status:  pickKey(r, ['status','situacao'], null),
            inicio:  pickKey(r, ['inicio','start_date','start'], null),
            fim:     pickKey(r, ['fim','end_date','end'], null),
            titular: pickKey(r, ['teacher_id_uuid','titular_id_uuid','professor_id_uuid'], null),
          };
        }
        setTurmaKeys(tk);

        let selTurmas = `id:${tk.id}, nome:${tk.name}`;
        if (tk.status) selTurmas += `, ${tk.status}`;
        if (tk.inicio) selTurmas += `, ${tk.inicio}`;
        if (tk.fim)    selTurmas += `, ${tk.fim}`;
        const turmasData = await safeSelect('turmas', supabase.from('turmas').select(selTurmas).order(tk.name));
        setTurmas(turmasData ?? []);

        // STUDENTS
        const pS = await softProbeTable('students');
        if (pS.exists && pS.row) {
          const r = pS.row;
          setStudentKeys({
            id:   pickKey(r, ['id_uuid','id'], 'id_uuid'),
            name: pickKey(r, ['name','nome'], 'name'),
          });
        }
        const sData = await safeSelect('students', supabase.from('students').select('id:id_uuid, name').order('name'));
        setAlunos(sData ?? []);

        // TEACHERS
        const pTeach = await softProbeTable('teachers');
        if (pTeach.exists && pTeach.row) {
          const r = pTeach.row;
          setTeacherKeys({
            id:   pickKey(r, ['id_uuid','id'], 'id_uuid'),
            name: pickKey(r, ['name','nome'], 'name'),
          });
        }
        const tchs = await safeSelect('teachers', supabase.from('teachers').select('id:id_uuid, name').order('name'));
        setTeachers(tchs ?? []);

        // vínculo turma-professor
        const vt1 = await softProbeTable('turma_teachers');
        const vt2 = await softProbeTable('turma_professor');
        if (vt1.exists) {
          setTpTable('turma_teachers');
          if (vt1.row) {
            setTpKeys({
              turma:  pickKey(vt1.row, ['turma_id_uuid','turma_id'], 'turma_id_uuid'),
              teacher:pickKey(vt1.row, ['teacher_id_uuid','professor_id_uuid','teacher_id'], 'teacher_id_uuid'),
              role:   pickKey(vt1.row, ['role','tipo','funcao'], null),
            });
          }
        } else if (vt2.exists) {
          setTpTable('turma_professor');
          if (vt2.row) {
            setTpKeys({
              turma:  pickKey(vt2.row, ['turma_id_uuid','turma_id'], 'turma_id_uuid'),
              teacher:pickKey(vt2.row, ['teacher_id_uuid','professor_id_uuid','teacher_id'], 'teacher_id_uuid'),
              role:   pickKey(vt2.row, ['role','tipo','funcao'], null),
            });
          }
        } else {
          setTpTable(null);
        }

        // tabela de AULAS (aulas | lessons | turma_aulas)
        for (const name of ['aulas', 'lessons', 'turma_aulas']) {
          const probe = await softProbeTable(name);
          if (probe.exists) {
            setLessonTbl(name);
            if (probe.row) {
              const r = probe.row;
              setLessonKeys({
                id:     pickKey(r, ['id_uuid','id'], 'id_uuid'),
                turma:  pickKey(r, ['turma_id_uuid','turma_id'], 'turma_id_uuid'),
                teacher:pickKey(r, ['teacher_id_uuid','professor_id_uuid','teacher_id'], 'teacher_id_uuid'),
                date:   pickKey(r, ['date','data','dia','lesson_date'], 'date'),
              });
            }
            break;
          }
        }
      } catch (e) {
        console.error(e);
        alert(e.message || 'Falha ao carregar dados.');
      }
    })();
  }, []);

  /* ============== adicionar aluno em turma ============== */
  async function handleAdicionar() {
    try {
      if (!isUuid(turmaId)) return alert('Selecione uma turma válida (UUID).');
      if (!isUuid(alunoId)) return alert('Selecione um aluno válido (UUID).');

      setLoading(true);

      // tenta RPC
      let { error } = await supabase.rpc('turma_add_aluno', {
        p_turma_id: turmaId,
        p_aluno_id: alunoId,
      });

      // fallback: upsert em turma_students
      if (error && /not found|does not exist|function.*not exist/i.test(error.message || '')) {
        const up = await supabase
          .from('turma_students')
          .upsert(
            { turma_id_uuid: turmaId, student_id_uuid: alunoId, active: true },
            { onConflict: 'turma_id_uuid,student_id_uuid' }
          );
        error = up.error || null;
      }
      if (error) throw error;

      setAlunoId('');
      alert('Aluno adicionado à turma com sucesso!');
    } catch (err) {
      console.error(err);
      alert(err.message || 'Erro ao adicionar aluno.');
    } finally {
      setLoading(false);
    }
  }

  const turmaSelecionadaNome = useMemo(() => {
    const t = turmas.find((x) => x.id === turmaId);
    return t?.nome || '(sem nome)';
  }, [turmas, turmaId]);

  /* ============== criar nova turma ============== */
  async function handleCreateTurma() {
    if (!nNome.trim()) return alert('Informe o nome da turma.');
    if (nTitular && !isUuid(nTitular)) return alert('Professor titular inválido.');

    setBusy(true);
    try {
      // monta payload conforme chaves existentes
      const payload = {};
      payload[turmaKeys.name] = nNome.trim();
      if (turmaKeys.status) payload[turmaKeys.status] = nStatus || null;
      if (turmaKeys.inicio) payload[turmaKeys.inicio] = nInicio || null;
      if (turmaKeys.fim)    payload[turmaKeys.fim]    = nFim || null;
      if (turmaKeys.titular && nTitular) payload[turmaKeys.titular] = nTitular;

      const { data, error } = await supabase
        .from('turmas')
        .insert(payload)
        .select(`id:${turmaKeys.id}, nome:${turmaKeys.name}`)
        .single();
      if (error) throw error;

      const novoId = data?.id;

      // vínculo do titular e substitutos
      if (!turmaKeys.titular && tpTable && nTitular) {
        const row = { [tpKeys.turma]: novoId, [tpKeys.teacher]: nTitular };
        if (tpKeys.role) row[tpKeys.role] = 'TITULAR';
        const r = await supabase.from(tpTable).insert(row);
        if (r.error) throw r.error;
      }
      if (tpTable && nSubs.length) {
        const rows = nSubs
          .filter((id) => id && id !== nTitular)
          .map((tid) => {
            const r = { [tpKeys.turma]: novoId, [tpKeys.teacher]: tid };
            if (tpKeys.role) r[tpKeys.role] = 'SUBSTITUTO';
            return r;
          });
        if (rows.length) {
          const ins = await supabase.from(tpTable).insert(rows);
          if (ins.error) throw ins.error;
        }
      }

      // recarrega turmas
      let selTurmas = `id:${turmaKeys.id}, nome:${turmaKeys.name}`;
      if (turmaKeys.status) selTurmas += `, ${turmaKeys.status}`;
      if (turmaKeys.inicio) selTurmas += `, ${turmaKeys.inicio}`;
      if (turmaKeys.fim)    selTurmas += `, ${turmaKeys.fim}`;

      const turmasData = await safeSelect('turmasReload', supabase.from('turmas').select(selTurmas).order(turmaKeys.name));
      setTurmas(turmasData ?? []);

      // limpa modal
      setNNome(''); setNStatus('ativa'); setNInicio(''); setNFim(''); setNTitular(''); setNSubs([]);
      setNewOpen(false);
      alert('Turma criada com sucesso!');
    } catch (e) {
      console.error(e);
      alert(e.message || 'Erro ao criar turma.');
    } finally {
      setBusy(false);
    }
  }
  function toggleSub(id) {
    setNSubs((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  /* ============== registrar aula ============== */
  // pega os professores vinculados à turma (titular + substitutos) se houver tabela de vínculo; senão, todos
  const turmaTeachers = useMemo(() => {
    if (!tpTable || !lTurma) return teachers; // fallback: todos
    // não sabemos quais são os vínculos sem consultar a tabela; aqui faremos consulta simples no open
    return teachers;
  }, [tpTable, lTurma, teachers]);

  async function loadTurmaTeachers(turmaUUID) {
    if (!tpTable || !turmaUUID) return teachers;
    const { data, error } = await supabase.from(tpTable).select('*').eq(tpKeys.turma, turmaUUID);
    if (error) {
      console.error(error);
      return teachers;
    }
    const setIds = new Set(data.map((d) => d[tpKeys.teacher]).filter(Boolean));
    return teachers.filter((t) => setIds.has(t.id));
  }

  useEffect(() => {
    (async () => {
      if (!lessonOpen) return;
      if (tpTable && lTurma) {
        const list = await loadTurmaTeachers(lTurma);
        // se o executante atual não estiver na lista, limpa
        if (lTeacher && !list.some((t) => t.id === lTeacher)) setLTeacher('');
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lessonOpen, lTurma]);

  async function handleSaveLesson() {
    if (!lessonTbl) {
      alert('Para registrar aulas, crie a tabela "aulas" (ou "lessons"). Posso te enviar o SQL depois.');
      return;
    }
    if (!lDate) return alert('Informe a data.');
    if (!isUuid(lTurma)) return alert('Selecione a turma.');
    if (!isUuid(lTeacher)) return alert('Selecione o professor executante.');

    setLessonBusy(true);
    try {
      const payload = {
        [lessonKeys.turma]: lTurma,
        [lessonKeys.teacher]: lTeacher,
        [lessonKeys.date]: lDate,
      };
      const { error } = await supabase.from(lessonTbl).insert(payload);
      if (error) throw error;

      setLessonOpen(false);
      setLDate(''); setLTurma(''); setLTeacher('');
      alert('Aula registrada!');
    } catch (e) {
      console.error(e);
      alert(e.message || 'Não foi possível registrar a aula.');
    } finally {
      setLessonBusy(false);
    }
  }

  /* ============== Drawer filtrado ============== */
  const drawerFiltered = useMemo(() => {
    const v = drawerQ.trim().toLowerCase();
    return (turmas ?? []).filter((t) => {
      const byQ = !v || (t.nome || '').toLowerCase().includes(v);
      const byStatus =
        drawerStatus === 'todas' ||
        !turmaKeys.status ||
        ((t[turmaKeys.status] || '').toLowerCase() === (drawerStatus === 'ativas' ? 'ativa' : 'inativa'));
      return byQ && byStatus;
    });
  }, [turmas, drawerQ, drawerStatus, turmaKeys.status]);

  return (
    <main className="min-h-screen bg-neutral-50">
      {/* Topo */}
      <div className="border-b bg-white">
        <div className="mx-auto max-w-7xl px-6 py-5">
          <Header />
          <div className="mt-5">
            <Tabs
              tabs={[
                { label: 'Visão Geral', href: '/' },
                { label: 'Alunos Ativos', href: '/alunos-ativos' },
                { label: 'Alunos Inativos', href: '/alunos-inativos' },
                { label: 'Professores', href: '/professores' },
                { label: 'Pagadores', href: '/pagadores' },
                { label: 'Pagamentos', href: '/pagamentos' },
                { label: 'Evolução Pedagógica', href: '/evolucao' },
                { label: 'Turmas', href: '/turmas', current: true },
              ]}
            />
          </div>
        </div>
      </div>

      {/* Conteúdo */}
      <div className="mx-auto max-w-7xl px-6 py-8 space-y-6">
        <header className="space-y-1">
          <div className="flex items-end justify-between gap-3 flex-wrap">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">Turmas</h1>
              <p className="text-sm text-slate-600">
                Selecione uma <strong>turma</strong> e um <strong>aluno</strong> (por <code>UUID</code>) e clique em <em>Adicionar</em>.
              </p>
            </div>
            <div className="flex gap-2">
              <button
                className="rounded border px-4 py-2 text-sm hover:bg-slate-50"
                onClick={() => setDrawerOpen(true)}
              >
                Todas as turmas
              </button>
              <button
                className="rounded bg-emerald-700 px-4 py-2 text-sm text-white hover:bg-emerald-800"
                onClick={() => setNewOpen(true)}
              >
                + Nova turma
              </button>
              <button
                className="rounded bg-indigo-700 px-4 py-2 text-sm text-white hover:bg-indigo-800"
                onClick={() => { setLessonOpen(true); setLTurma(turmaId || ''); }}
                disabled={!lessonTbl && true}
                title={lessonTbl ? '' : 'Crie a tabela "aulas" para habilitar'}
              >
                Registrar aula
              </button>
            </div>
          </div>
        </header>

        {/* Adicionar aluno em turma */}
        <section className="flex flex-col gap-3 max-w-3xl bg-white rounded-lg border p-4">
          <label className="text-sm">
            Turma (UUID)
            <select
              className="mt-1 border p-2 rounded w-full bg-white"
              value={turmaId}
              onChange={(e) => setTurmaId(e.target.value)}
            >
              <option value="">Selecione uma turma</option>
              {turmas.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.nome || t.id}
                </option>
              ))}
            </select>
          </label>

          <label className="text-sm">
            Aluno (UUID)
            <select
              className="mt-1 border p-2 rounded w-full bg-white"
              value={alunoId}
              onChange={(e) => setAlunoId(e.target.value)}
            >
              <option value="">Selecione um aluno</option>
              {alunos.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name || a.id}
                </option>
              ))}
            </select>
          </label>

          <div className="flex items-center gap-2">
            <button
              className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded disabled:opacity-50"
              onClick={handleAdicionar}
              disabled={loading || !turmaId || !alunoId}
            >
              {loading ? 'Adicionando…' : 'Adicionar aluno'}
            </button>

            {turmaId ? (
              <span className="text-sm text-slate-700">
                Turma selecionada: <strong>{turmaSelecionadaNome}</strong>
              </span>
            ) : null}
          </div>
        </section>

        {/* Listas simples */}
        <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white rounded-lg border p-4">
            <h2 className="font-medium mb-2">Turmas (recentes)</h2>
            <ul className="space-y-2 text-sm">
              {turmas.slice(0, 8).map((t) => (
                <li key={t.id} className="border rounded p-2">
                  <div className="font-medium">{t.nome || '(sem nome)'}</div>
                  <div className="text-[11px] text-slate-500 break-all">{t.id}</div>
                </li>
              ))}
            </ul>
          </div>

          <div className="bg-white rounded-lg border p-4">
            <h2 className="font-medium mb-2">Alunos (recentes)</h2>
            <ul className="space-y-2 text-sm">
              {alunos.slice(0, 8).map((a) => (
                <li key={a.id} className="border rounded p-2">
                  <div className="font-medium">{a.name || '(sem nome)'}</div>
                  <div className="text-[11px] text-slate-500 break-all">{a.id}</div>
                </li>
              ))}
            </ul>
          </div>
        </section>
      </div>

      {/* Drawer: todas as turmas */}
      {drawerOpen && (
        <Drawer title="Todas as turmas" onClose={() => setDrawerOpen(false)}>
          <div className="p-4 space-y-4">
            <div className="flex gap-3 items-end">
              <label className="text-sm">
                Buscar
                <input
                  className="mt-1 border rounded px-3 py-2 bg-white w-64"
                  placeholder="Nome da turma…"
                  value={drawerQ}
                  onChange={(e) => setDrawerQ(e.target.value)}
                />
              </label>
              {turmaKeys.status && (
                <label className="text-sm">
                  Status
                  <select
                    className="mt-1 border rounded px-3 py-2 bg-white"
                    value={drawerStatus}
                    onChange={(e) => setDrawerStatus(e.target.value)}
                  >
                    <option value="todas">Todas</option>
                    <option value="ativas">Ativas</option>
                    <option value="inativas">Inativas</option>
                  </select>
                </label>
              )}
            </div>

            <div className="border rounded overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-slate-600">
                  <tr>
                    <th className="text-left font-medium px-3 py-2">Nome</th>
                    {turmaKeys.status && <th className="text-left font-medium px-3 py-2">Status</th>}
                    {turmaKeys.inicio && <th className="text-left font-medium px-3 py-2">Início</th>}
                    {turmaKeys.fim && <th className="text-left font-medium px-3 py-2">Fim</th>}
                    <th className="text-left font-medium px-3 py-2">UUID</th>
                  </tr>
                </thead>
                <tbody>
                  {drawerFiltered.length === 0 ? (
                    <tr><td className="px-3 py-4 text-slate-500" colSpan={5}>Nenhuma turma encontrada.</td></tr>
                  ) : drawerFiltered.map((t) => (
                    <tr key={t.id} className="border-t hover:bg-slate-50">
                      <td className="px-3 py-2">{t.nome || '(sem nome)'}</td>
                      {turmaKeys.status && <td className="px-3 py-2">{t[turmaKeys.status] ?? '-'}</td>}
                      {turmaKeys.inicio && <td className="px-3 py-2">{t[turmaKeys.inicio] ?? '-'}</td>}
                      {turmaKeys.fim && <td className="px-3 py-2">{t[turmaKeys.fim] ?? '-'}</td>}
                      <td className="px-3 py-2 break-all">{t.id}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </Drawer>
      )}

      {/* Modal: Nova turma */}
      {newOpen && (
        <Modal title="Nova turma" onClose={() => setNewOpen(false)}>
          <div className="p-5 space-y-4">
            <label className="block text-sm">
              Nome da turma
              <input
                className="mt-1 border rounded px-3 py-2 bg-white w-full"
                value={nNome}
                onChange={(e) => setNNome(e.target.value)}
                placeholder="Ex.: Inglês A1 - Seg/Qua 19h"
              />
            </label>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <label className="block text-sm">
                Status
                <select className="mt-1 border rounded px-3 py-2 bg-white w-full" value={nStatus} onChange={(e)=>setNStatus(e.target.value)}>
                  <option value="ativa">Ativa</option>
                  <option value="inativa">Inativa</option>
                </select>
              </label>
              <label className="block text-sm">
                Início
                <input type="date" className="mt-1 border rounded px-3 py-2 bg-white w-full" value={nInicio} onChange={(e)=>setNInicio(e.target.value)} />
              </label>
              <label className="block text-sm">
                Fim
                <input type="date" className="mt-1 border rounded px-3 py-2 bg-white w-full" value={nFim} onChange={(e)=>setNFim(e.target.value)} />
              </label>
            </div>

            <label className="block text-sm">
              Professor titular
              <select className="mt-1 border rounded px-3 py-2 bg-white w-full" value={nTitular} onChange={(e)=>setNTitular(e.target.value)}>
                <option value="">Selecione</option>
                {teachers.map((t)=> <option key={t.id} value={t.id}>{t.name || t.id}</option>)}
              </select>
            </label>

            <div className="text-sm">
              <div className="font-medium mb-1">Substitutos autorizados (opcional)</div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-48 overflow-auto border rounded p-2">
                {teachers.map((t)=> (
                  <label key={t.id} className="flex items-center gap-2">
                    <input type="checkbox" checked={nSubs.includes(t.id)} onChange={()=>toggleSub(t.id)} disabled={nTitular===t.id}/>
                    <span className={nTitular===t.id ? 'text-slate-400' : ''}>
                      {t.name || t.id} {nTitular===t.id ? '(titular)' : ''}
                    </span>
                  </label>
                ))}
              </div>
              {!tpTable && (
                <p className="mt-2 text-xs text-amber-700">
                  Observação: não encontrei uma tabela de vínculo <code>turma_teachers</code> ou <code>turma_professor</code>.
                  Os substitutos só serão salvos quando essa tabela existir.
                </p>
              )}
            </div>
          </div>

          <div className="px-5 py-4 border-t flex items-center justify-end gap-3">
            <button className="rounded border px-4 py-2 text-sm hover:bg-slate-50" onClick={()=>setNewOpen(false)} disabled={busy}>Cancelar</button>
            <button className="rounded bg-emerald-700 px-4 py-2 text-sm text-white hover:bg-emerald-800 disabled:opacity-50"
              onClick={handleCreateTurma} disabled={busy || !nNome.trim()}>
              {busy ? 'Salvando…' : 'Criar turma'}
            </button>
          </div>
        </Modal>
      )}

      {/* Modal: Registrar aula */}
      {lessonOpen && (
        <Modal title="Registrar aula" onClose={()=>{ setLessonOpen(false); setLDate(''); setLTurma(''); setLTeacher(''); }}>
          <div className="p-5 space-y-4">
            {!lessonTbl && (
              <div className="rounded border border-amber-300 bg-amber-50 text-amber-900 p-3 text-sm">
                Para habilitar este recurso, crie uma tabela <code>aulas</code> (ou <code>lessons</code>) com colunas:
                <code> id_uuid (uuid, pk)</code>, <code>turma_id_uuid (uuid)</code>, <code>teacher_id_uuid (uuid)</code>, <code>date (date)</code>.
              </div>
            )}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <label className="block text-sm">
                Data
                <input type="date" className="mt-1 border rounded px-3 py-2 bg-white w-full" value={lDate} onChange={(e)=>setLDate(e.target.value)} />
              </label>
              <label className="block text-sm md:col-span-2">
                Turma
                <select className="mt-1 border rounded px-3 py-2 bg-white w-full" value={lTurma} onChange={(e)=>setLTurma(e.target.value)}>
                  <option value="">Selecione</option>
                  {turmas.map((t)=> <option key={t.id} value={t.id}>{t.nome || t.id}</option>)}
                </select>
              </label>
            </div>

            <label className="block text-sm">
              Professor executante
              <select className="mt-1 border rounded px-3 py-2 bg-white w-full" value={lTeacher} onChange={(e)=>setLTeacher(e.target.value)}>
                <option value="">Selecione</option>
                {turmaTeachers.map((t)=> <option key={t.id} value={t.id}>{t.name || t.id}</option>)}
              </select>
            </label>
          </div>

          <div className="px-5 py-4 border-t flex items-center justify-end gap-3">
            <button className="rounded border px-4 py-2 text-sm hover:bg-slate-50" onClick={()=>setLessonOpen(false)} disabled={lessonBusy}>Cancelar</button>
            <button className="rounded bg-indigo-700 px-4 py-2 text-sm text-white hover:bg-indigo-800 disabled:opacity-50"
              onClick={handleSaveLesson}
              disabled={lessonBusy || !lessonTbl || !lDate || !lTurma || !lTeacher}>
              {lessonBusy ? 'Salvando…' : 'Salvar'}
            </button>
          </div>
        </Modal>
      )}
    </main>
  );
}

/* ================= UI bits ================= */
function Modal({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
      <div className="w-full max-w-2xl rounded-xl bg-white border shadow-lg">
        <div className="px-5 py-4 border-b flex items-center justify-between">
          <h2 className="text-base font-semibold">{title}</h2>
          <button className="text-slate-500 hover:text-slate-700" onClick={onClose}>✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

function Drawer({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="absolute right-0 top-0 h-full w-full max-w-xl bg-white shadow-xl border-l flex flex-col">
        <div className="px-5 py-4 border-b flex items-center justify-between">
          <h2 className="text-base font-semibold">{title}</h2>
          <button className="text-slate-500 hover:text-slate-700" onClick={onClose}>✕</button>
        </div>
        <div className="flex-1 overflow-auto">{children}</div>
      </div>
    </div>
  );
}
