'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

export default function AddStudentDialog() {
  const [turmas, setTurmas] = useState([]);
  const [alunos, setAlunos] = useState([]);
  const [turmaId, setTurmaId] = useState('');
  const [alunoId, setAlunoId] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: t } = await supabase.from('turmas').select('id_uuid as id, nome').order('nome');
      const { data: a } = await supabase.from('students').select('id_uuid as id, name').order('name');
      setTurmas(t ?? []);
      setAlunos(a ?? []);
    })();
  }, []);

  async function addAluno() {
    setLoading(true);
    try {
      const { error } = await supabase.rpc('turma_add_aluno', {
        p_turma_id: turmaId,
        p_aluno_id: alunoId,
      });
      if (error) throw error;
      setAlunoId('');
      alert('Aluno adicionado!');
    } catch (e) {
      alert(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex gap-2 items-end">
      <select className="border p-2 rounded" value={turmaId} onChange={(e) => setTurmaId(e.target.value)}>
        <option value="">Turma</option>
        {turmas.map((t) => <option key={t.id} value={t.id}>{t.nome}</option>)}
      </select>

      <select className="border p-2 rounded" value={alunoId} onChange={(e) => setAlunoId(e.target.value)}>
        <option value="">Aluno</option>
        {alunos.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
      </select>

      <button
        className="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-2 rounded disabled:opacity-50"
        onClick={addAluno}
        disabled={!alunoId || !turmaId || loading}
      >
        {loading ? 'Adicionando…' : 'Adicionar'}
      </button>
    </div>
  );
}
