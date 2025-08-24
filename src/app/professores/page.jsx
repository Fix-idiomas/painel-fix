'use client';

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

/* Helpers */
const fmtBRL = (n) =>
  (Number(n) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const pickKey = (row, candidates, fallback = null) =>
  candidates.find((k) => row && Object.prototype.hasOwnProperty.call(row, k)) || fallback;

async function safeSelect(label, q) {
  const { data, error } = await q;
  if (error) {
    console.error(`[${label}]`, error);
    throw new Error(`[${label}] ${error.message || JSON.stringify(error)}`);
  }
  return data;
}

/* Page */
export default function ProfessoresPage() {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState([]);
  const [q, setQ] = useState('');

  // autodetect schemas
  const [teacherSchema, setTeacherSchema] = useState({
    idKey: 'id_uuid',
    nameKey: 'name',
    emailKey: 'email',
    phoneKey: 'phone',
    pixKey: 'pix_key',
  });
  const [turmaSchema, setTurmaSchema] = useState({
    idKey: 'id_uuid',
    nameKey: 'nome',
    teacherFkKey: 'teacher_id_uuid',
  });
  const [tsSchema, setTsSchema] = useState({
    turmaKey: 'turma_id_uuid',
    studentKey: 'student_id_uuid',
    activeKey: 'active',
  });

  // modais
  const [editTeacher, setEditTeacher] = useState(null);
  const [viewTeacher, setViewTeacher] = useState(null);
  const [newTeacherOpen, setNewTeacherOpen] = useState(false);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        /* probes (autodetect) */
        const tProbe = await safeSelect('probe:teachers', supabase.from('teachers').select('*').limit(1));
        if (tProbe && tProbe[0]) {
          const r0 = tProbe[0];
          setTeacherSchema({
            idKey:   pickKey(r0, ['id_uuid','id'], 'id_uuid'),
            nameKey: pickKey(r0, ['name','nome'], 'name'),
            emailKey:pickKey(r0, ['email','mail'], 'email'),
            phoneKey:pickKey(r0, ['phone','telefone','phone_number'], 'phone'),
            pixKey:  pickKey(r0, ['pix_key','pix','chave_pix','pix_chave'], 'pix_key'),
          });
        }

        const uProbe = await safeSelect('probe:turmas', supabase.from('turmas').select('*').limit(1));
        if (uProbe && uProbe[0]) {
          const u0 = uProbe[0];
          setTurmaSchema({
            idKey: pickKey(u0, ['id_uuid','id'], 'id_uuid'),
            nameKey: pickKey(u0, ['nome','name'], 'nome'),
            teacherFkKey: pickKey(u0, ['teacher_id_uuid','teacher_id','professor_id_uuid','professor_id'], 'teacher_id_uuid'),
          });
        }

        const tsProbe = await safeSelect('probe:turma_students', supabase.from('turma_students').select('*').limit(1));
        if (tsProbe && tsProbe[0]) {
          const r0 = tsProbe[0];
          setTsSchema({
            turmaKey:   pickKey(r0, ['turma_id_uuid','turma_id','turma_uuid'], 'turma_id_uuid'),
            studentKey: pickKey(r0, ['student_id_uuid','student_id','aluno_id_uuid','aluno_id'], 'student_id_uuid'),
            activeKey:  pickKey(r0, ['active','is_active','ativo'], 'active'),
          });
        }

        /* dados base */
        const teachers = await safeSelect('teachers', supabase.from('teachers').select('*'));
        const turmas   = await safeSelect('turmas',   supabase.from('turmas').select('*'));
        // pegue TUDO de turma_students; mapeamos pelos nomes detectados
        const tsAll    = await safeSelect('turma_students', supabase.from('turma_students').select('*'));
  // Corrigido: não buscar student_id_uuid em payers, pois não existe
  const payers   = await safeSelect('payers', supabase.from('payers').select('monthly_value'));

        const TID   = teacherSchema.idKey;
        const TNAME = teacherSchema.nameKey;
        const TEM   = teacherSchema.emailKey;
        const TPH   = teacherSchema.phoneKey;
        const TPIX  = teacherSchema.pixKey;

        const UID   = turmaSchema.idKey;
        const UNAME = turmaSchema.nameKey; // usado no drawer
        const UFK   = turmaSchema.teacherFkKey;

        const TS_TURMA   = tsSchema.turmaKey;
        const TS_STUDENT = tsSchema.studentKey;
        const TS_ACTIVE  = tsSchema.activeKey;

        // mapa: turmaId -> teacherId
        const turmaToTeacher = new Map();
        for (const u of (turmas ?? [])) {
          const tid = u[UFK];
          const uid = u[UID];
          if (uid && tid) turmaToTeacher.set(uid, tid);
        }

        // agrega vínculos por professor
        const tsByTeacher = new Map(); // teacherId -> { active: Set(studentId), inactive: Set(studentId) }
        for (const row of (tsAll ?? [])) {
          const turmaId = row[TS_TURMA];
          const teacherId = turmaToTeacher.get(turmaId);
          const studId = row[TS_STUDENT];
          if (!teacherId || !studId) continue;

          if (!tsByTeacher.has(teacherId)) {
            tsByTeacher.set(teacherId, { active: new Set(), inactive: new Set() });
          }
          const slot = tsByTeacher.get(teacherId);
          const isActive = typeof row[TS_ACTIVE] === 'boolean' ? row[TS_ACTIVE] : !!row[TS_ACTIVE];
          if (isActive) slot.active.add(studId);
          else slot.inactive.add(studId);
        }

        // payers map: student -> monthly_value
        const payMap = new Map((payers ?? []).map(p => [p.student_id_uuid, Number(p.monthly_value || 0)]));

        // linhas
        const lines = (teachers ?? []).map((t) => {
          const id    = t[TID];
          const name  = t[TNAME] || '(sem nome)';
          const email = t[TEM] || '';
          const phone = t[TPH] || '';
          const pixKey= t[TPIX] || '';

          const slot = tsByTeacher.get(id);
          let activeCount = 0, inactiveCount = 0, activeMonthlySum = 0;

          if (slot) {
            const activeStudents = Array.from(slot.active);
            const inactiveOnly = Array.from(slot.inactive).filter(sid => !slot.active.has(sid));
            activeCount = activeStudents.length;
            inactiveCount = inactiveOnly.length;
            for (const sid of activeStudents) activeMonthlySum += Number(payMap.get(sid) || 0);
          }

          return { id, name, email, phone, pixKey, activeCount, inactiveCount, activeMonthlySum };
        }).sort((a,b) => a.name.localeCompare(b.name, 'pt-BR', { sensitivity: 'base' }));

        setRows(lines);
      } catch (e) {
        console.error(e);
        alert(e.message || 'Erro ao carregar professores.');
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(() => {
    if (!q.trim()) return rows;
    const v = q.toLowerCase().trim();
    return rows.filter((r) =>
      r.name.toLowerCase().includes(v) ||
      (r.email && r.email.toLowerCase().includes(v)) ||
      (r.phone && String(r.phone).toLowerCase().includes(v)) ||
      (r.pixKey && String(r.pixKey).toLowerCase().includes(v))
    );
  }, [rows, q]);

  async function saveTeacherEdit({ id, email, phone, pixKey }) {
    try {
      const patch = {};
      if (teacherSchema.emailKey) patch[teacherSchema.emailKey] = email ?? null;
      if (teacherSchema.phoneKey) patch[teacherSchema.phoneKey] = phone ?? null;
      if (teacherSchema.pixKey)   patch[teacherSchema.pixKey]   = pixKey ?? null;

      const { error } = await supabase.from('teachers').update(patch).eq(teacherSchema.idKey, id);
      if (error) throw error;

      setRows((prev) => prev.map((r) => (r.id === id ? { ...r, email, phone, pixKey } : r)));
    } catch (e) {
      console.error(e);
      alert(e.message || 'Não foi possível salvar.');
    }
  }

  async function createTeacher({ name, email, phone, pixKey }) {
    try {
      const row = {};
      if (teacherSchema.nameKey)  row[teacherSchema.nameKey]  = name ?? null;
      if (teacherSchema.emailKey) row[teacherSchema.emailKey] = email ?? null;
      if (teacherSchema.phoneKey) row[teacherSchema.phoneKey] = phone ?? null;
      if (teacherSchema.pixKey)   row[teacherSchema.pixKey]   = pixKey ?? null;

      const { data, error } = await supabase.from('teachers').insert(row).select('*').single();
      if (error) throw error;

      const idKey = pickKey(data, ['id_uuid','id'], teacherSchema.idKey);
      const id = data[idKey];

      setRows((prev) => [
        ...prev,
        {
          id,
          name: data[teacherSchema.nameKey] || '(sem nome)',
          email: data[teacherSchema.emailKey] || '',
          phone: data[teacherSchema.phoneKey] || '',
          pixKey: data[teacherSchema.pixKey] || '',
          activeCount: 0,
          inactiveCount: 0,
          activeMonthlySum: 0,
        },
      ].sort((a,b) => a.name.localeCompare(b.name, 'pt-BR', { sensitivity: 'base' })));
    } catch (e) {
      console.error(e);
      alert(e.message || 'Não foi possível criar o professor.');
    }
  }

  return (
    <main className="min-h-screen bg-neutral-50">
      <div className="mx-auto max-w-7xl px-6 py-8 space-y-6">
        <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold tracking-tight">Professores</h1>
            <p className="text-sm text-slate-600">Contagem de alunos por professor e previsão mensal dos ativos.</p>
          </div>
          <div className="flex items-end gap-3">
            <div className="w-80">
              <label className="text-sm block">
                Buscar
                <input
                  className="mt-1 w-full border rounded px-3 py-2 bg-white"
                  placeholder="Nome, email, telefone, PIX…"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                />
              </label>
            </div>
            <button
              className="rounded bg-emerald-700 px-3 py-2 text-sm text-white hover:bg-emerald-800"
              onClick={() => setNewTeacherOpen(true)}
            >
              + Novo professor
            </button>
          </div>
        </header>

        <section className="bg-white rounded-lg border">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="bg-slate-50 text-slate-600">
                  <th className="text-left font-medium px-4 py-3">Professor</th>
                  <th className="text-left font-medium px-4 py-3">Contato / PIX</th>
                  <th className="text-center font-medium px-4 py-3">Ativos</th>
                  <th className="text-center font-medium px-4 py-3">Inativos</th>
                  <th className="text-right font-medium px-4 py-3">Mensalidade (ativos)</th>
                  <th className="text-left font-medium px-4 py-3">Ações</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={6} className="px-4 py-6 text-center text-slate-500">Carregando…</td></tr>
                ) : filtered.length === 0 ? (
                  <tr><td colSpan={6} className="px-4 py-6 text-center text-slate-500">Nenhum professor encontrado.</td></tr>
                ) : (
                  filtered.map((r) => (
                    <tr key={r.id} className="border-t">
                      <td className="px-4 py-3 font-medium">{r.name}</td>
                      <td className="px-4 py-3">
                        <div className="space-y-0.5">
                          {r.email && <div className="text-slate-700">{r.email}</div>}
                          {r.phone && <div className="text-slate-500 text-xs">{r.phone}</div>}
                          {r.pixKey && <div className="text-slate-500 text-xs">PIX: {r.pixKey}</div>}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center">{r.activeCount}</td>
                      <td className="px-4 py-3 text-center">{r.inactiveCount}</td>
                      <td className="px-4 py-3 text-right">{fmtBRL(r.activeMonthlySum)}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <button
                            className="rounded border px-3 py-1.5 text-xs hover:bg-slate-50"
                            onClick={() => setViewTeacher({ id: r.id, name: r.name })}
                          >
                            Ver turmas & alunos
                          </button>
                          <button
                            className="rounded border px-3 py-1.5 text-xs hover:bg-slate-50"
                            onClick={() => setEditTeacher({ id: r.id, name: r.name, email: r.email || '', phone: r.phone || '', pixKey: r.pixKey || '' })}
                          >
                            Editar
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      {/* Drawer */}
      {viewTeacher && (
        <TeacherDrawer
          teacher={viewTeacher}
          onClose={() => setViewTeacher(null)}
          resolveData={async () => buildTeacherDetail(viewTeacher.id, turmaSchema, tsSchema)}
        />
      )}

      {/* Novo professor */}
      {newTeacherOpen && (
        <NewTeacherDialog
          onClose={() => setNewTeacherOpen(false)}
          onSave={async (payload) => {
            await createTeacher(payload);
            setNewTeacherOpen(false);
          }}
        />
      )}

      {/* Editar professor */}
      {editTeacher && (
        <EditTeacherDialog
          data={editTeacher}
          onClose={() => setEditTeacher(null)}
          onSave={async (payload) => {
            await saveTeacherEdit(payload);
            setEditTeacher(null);
          }}
        />
      )}
    </main>
  );
}

/* ===== Drawer: Detalhes ===== */
async function buildTeacherDetail(teacherId, turmaSchema, tsSchema) {
  const UID = turmaSchema.idKey;
  const UNAME = turmaSchema.nameKey;
  const UFK = turmaSchema.teacherFkKey;

  const TS_TURMA   = tsSchema.turmaKey;
  const TS_STUDENT = tsSchema.studentKey;
  const TS_ACTIVE  = tsSchema.activeKey;

  const turmas = await safeSelect(
    'drawer:turmas',
    supabase.from('turmas').select('*').eq(UFK, teacherId)
  );

  const turmaIds = (turmas ?? []).map((t) => t[UID]).filter(Boolean);

  let vincs = [];
  if (turmaIds.length) {
    vincs = await safeSelect(
      'drawer:turma_students',
      supabase.from('turma_students').select('*').in(TS_TURMA, turmaIds)
    );
  }

  const studentIds = Array.from(new Set(vincs.map(v => v[TS_STUDENT]).filter(Boolean)));

  let students = [];
  if (studentIds.length) {
    students = await safeSelect(
      'drawer:students',
      supabase.from('students').select('id_uuid, name').in('id_uuid', studentIds)
    );
  }
  const sMap = new Map(students.map(s => [s.id_uuid, s.name]));

  let payers = [];
  if (studentIds.length) {
    payers = await safeSelect(
      'drawer:payers',
      supabase.from('payers').select('student_id_uuid, monthly_value').in('student_id_uuid', studentIds)
    );
  }
  const payMap = new Map(payers.map(p => [p.student_id_uuid, Number(p.monthly_value || 0)]));

  const byTurma = new Map(); // turmaId -> { nome, alunos: [...] }
  for (const t of turmas ?? []) {
    byTurma.set(t[UID], { nome: t[UNAME] || '(sem nome)', alunos: [] });
  }
  for (const v of vincs) {
    const tid = v[TS_TURMA];
    if (!byTurma.has(tid)) continue;
    const nome = sMap.get(v[TS_STUDENT]) || '(sem nome)';
    const mv = Number(payMap.get(v[TS_STUDENT]) || 0);
    const isActive = typeof v[TS_ACTIVE] === 'boolean' ? v[TS_ACTIVE] : !!v[TS_ACTIVE];
    byTurma.get(tid).alunos.push({ name: nome, active: isActive, monthly_value: mv });
  }

  return Array.from(byTurma.values()).map(t => ({
    turma: t.nome,
    ativos: t.alunos.filter(a => a.active),
    inativos: t.alunos.filter(a => !a.active),
  }));
}

/* ===== Modais ===== */
function EditTeacherDialog({ data, onClose, onSave }) {
  const [email, setEmail] = useState(data.email || '');
  const [phone, setPhone] = useState(data.phone || '');
  const [pixKey, setPixKey] = useState(data.pixKey || '');
  const [busy, setBusy] = useState(false);

  async function handleSave() {
    setBusy(true);
    try {
      await onSave({ id: data.id, email, phone, pixKey });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title={`Editar — ${data.name}`} onClose={onClose}>
      <div className="p-5 space-y-4">
        <label className="block text-sm">Email
          <input className="mt-1 w-full border rounded px-3 py-2 bg-white"
                 value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <label className="block text-sm">Telefone
          <input className="mt-1 w-full border rounded px-3 py-2 bg-white"
                 value={phone} onChange={(e) => setPhone(e.target.value)} />
        </label>
        <label className="block text-sm">Chave PIX
          <input className="mt-1 w-full border rounded px-3 py-2 bg-white"
                 value={pixKey} onChange={(e) => setPixKey(e.target.value)} />
        </label>
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

function NewTeacherDialog({ onClose, onSave }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [pixKey, setPixKey] = useState('');
  const [busy, setBusy] = useState(false);

  async function handleSave() {
    if (!name.trim()) {
      alert('Informe o nome do professor.');
      return;
    }
    setBusy(true);
    try {
      await onSave({ name: name.trim(), email: email.trim() || null, phone: phone.trim() || null, pixKey: pixKey.trim() || null });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title="Novo professor" onClose={onClose}>
      <div className="p-5 space-y-4">
        <label className="block text-sm">Nome
          <input className="mt-1 w-full border rounded px-3 py-2 bg-white"
                 value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <label className="block text-sm">Email
          <input className="mt-1 w-full border rounded px-3 py-2 bg-white"
                 value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <label className="block text-sm">Telefone
          <input className="mt-1 w-full border rounded px-3 py-2 bg-white"
                 value={phone} onChange={(e) => setPhone(e.target.value)} />
        </label>
        <label className="block text-sm">Chave PIX
          <input className="mt-1 w-full border rounded px-3 py-2 bg-white"
                 value={pixKey} onChange={(e) => setPixKey(e.target.value)} />
        </label>
      </div>
      <div className="px-5 py-4 border-t flex items-center justify-end gap-3">
        <button className="rounded border px-4 py-2 text-sm hover:bg-slate-50" onClick={onClose} disabled={busy}>Cancelar</button>
        <button className="rounded bg-emerald-700 px-4 py-2 text-sm text-white hover:bg-emerald-800 disabled:opacity-50"
                onClick={handleSave} disabled={busy}>
          {busy ? 'Criando…' : 'Criar'}
        </button>
      </div>
    </Modal>
  );
}

/* Modal base */
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
