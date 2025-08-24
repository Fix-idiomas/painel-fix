
'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

export default function StudentEditDialog({ open, onClose, studentId }) {
  const [saving, setSaving] = useState(false);
  const [student, setStudent] = useState(null);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [dueDay, setDueDay] = useState('');
  const [payerId, setPayerId] = useState('');
  const [payers, setPayers] = useState([]);

  useEffect(() => {
    if (!open || !studentId) return;
    (async () => {
      // Carrega dados do aluno
      const { data, error } = await supabase
        .from('students')
        .select('id_uuid, name, email, payer_id_uuid, due_day')
        .eq('id_uuid', studentId)
        .single();
      if (error) return alert('Erro ao carregar aluno.');
      setStudent(data);
      setName(data.name || '');
      setEmail(data.email || '');
      setDueDay(data.due_day || '');
      setPayerId(data.payer_id_uuid || '');

      // Carrega pagadores
      const { data: payersData } = await supabase
        .from('payers')
        .select('id_uuid, name')
        .order('name', { ascending: true });
      setPayers(payersData ?? []);
    })();
  }, [open, studentId]);

  async function handleSave() {
    try {
      setSaving(true);
      await supabase
        .from('students')
        .update({
          name: name.trim(),
          email: email.trim(),
          payer_id_uuid: payerId || null,
          due_day: dueDay ? Number(dueDay) : null,
        })
        .eq('id_uuid', studentId);
      onClose?.(true);
    } catch (e) {
      alert('Erro ao salvar alterações.');
    } finally {
      setSaving(false);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
      <div className="w-full max-w-lg rounded-lg bg-white shadow-lg">
        <div className="flex items-center justify-between border-b px-5 py-3">
          <h2 className="text-lg font-semibold">Editar aluno</h2>
          <button
            onClick={() => onClose(false)}
            className="rounded px-2 py-1 text-slate-500 hover:bg-slate-100"
            disabled={saving}
            aria-label="Fechar"
          >
            ✕
          </button>
        </div>
        <div className="grid gap-4 p-5">
          <label className="text-sm">
            Nome do aluno
            <input
              className="mt-1 w-full rounded border px-3 py-2"
              value={name}
              onChange={e => setName(e.target.value)}
              disabled={saving}
            />
          </label>
          <label className="text-sm">
            Email
            <input
              className="mt-1 w-full rounded border px-3 py-2"
              value={email}
              onChange={e => setEmail(e.target.value)}
              disabled={saving}
            />
          </label>
          <label className="text-sm">
            Pagador
            <select
              className="mt-1 w-full rounded border px-3 py-2"
              value={payerId}
              onChange={e => setPayerId(e.target.value)}
              disabled={saving}
            >
              <option value="">Selecione</option>
              {payers.map((p) => (
                <option key={p.id_uuid} value={p.id_uuid}>{p.name}</option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            Dia de vencimento
            <input
              className="mt-1 w-full rounded border px-3 py-2"
              value={dueDay}
              onChange={e => setDueDay(e.target.value.replace(/\D/g, ''))}
              disabled={saving}
              placeholder="1 a 31"
              inputMode="numeric"
            />
          </label>
          <div className="flex items-center justify-end gap-2 pt-1">
            <button
              className="rounded border px-4 py-2 text-slate-700 hover:bg-slate-50"
              onClick={() => onClose(false)}
              disabled={saving}
            >
              Cancelar
            </button>
            <button
              className="rounded bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              onClick={handleSave}
              disabled={saving}
            >
              {saving ? 'Salvando…' : 'Salvar'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}