'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

export default function NewStudentDialog({ open, onClose, onCreated }) {
  // visibilidade
  const [saving, setSaving] = useState(false);

  // form – dados do aluno
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');            // opcional (ver nota abaixo)
  const [birthDate, setBirthDate] = useState('');    // opcional (ver nota abaixo)

  // financeiro
  const [dueDay, setDueDay] = useState(5);
  const [monthlyValue, setMonthlyValue] = useState('');

  // pagador (responsável financeiro)
  const [payers, setPayers] = useState([]);
  const [payerId, setPayerId] = useState('');
  const [createPayer, setCreatePayer] = useState(false);
  const [newPayerName, setNewPayerName] = useState('');

  // turmas
  const [turmas, setTurmas] = useState([]);
  const [turmaId, setTurmaId] = useState('');

  // carregar selects quando abrir
  useEffect(() => {
    if (!open) return;
    (async () => {
      try {
        const [{ data: payersData }, { data: turmasData }] = await Promise.all([
          supabase.from('payers').select('id_uuid, name').order('name', { ascending: true }),
          supabase.from('turmas').select('id_uuid, nome').order('nome', { ascending: true })
        ]);
        setPayers(payersData ?? []);
        setTurmas(turmasData ?? []);
      } catch (e) {
        console.error(e);
        alert('Erro ao carregar listas (pagadores/turmas).');
      }
    })();
  }, [open]);

  function resetForm() {
    setName('');
    setEmail('');
    setPhone('');
    setBirthDate('');
    setDueDay(5);
    setMonthlyValue('');
    setPayerId('');
    setCreatePayer(false);
    setNewPayerName('');
    setTurmaId('');
  }

  async function handleSave() {
    try {
      if (!name.trim()) {
        alert('Informe o nome do aluno.');
        return;
      }
      setSaving(true);

      // 1) cria pagador (se marcado)
      let finalPayerId = payerId || null;
      if (createPayer) {
        const nome = (newPayerName || '').trim();
        if (!nome) {
          alert('Informe o nome do novo pagador.');
          setSaving(false);
          return;
        }
        const { data: pIns, error: pErr } = await supabase
          .from('payers')
          .insert({ name: nome })
          .select('id_uuid')
          .single();
        if (pErr) throw pErr;
        finalPayerId = pIns?.id_uuid || null;
      }

      // 2) cria aluno
      // Montamos payload, mas com fallback: se o DB não tiver alguma coluna opcional,
      // a gente tenta sem ela na segunda tentativa.
      const payloadBase = {
        name: name.trim(),
      };
      if (email.trim()) payloadBase.email = email.trim();
      if (finalPayerId) payloadBase.payer_id_uuid = finalPayerId;

      // Esses 2 campos são opcionais (dependem do seu schema):
      // Se o insert falhar por "42703 column does not exist", vamos remover e tentar de novo.
      if (phone.trim()) payloadBase.phone = phone.trim();
      if (birthDate) payloadBase.birth_date = birthDate; // yyyy-mm-dd

      const studentId = await insertStudentWithFallback(payloadBase);

      // 3) se turma foi selecionada, vincula em turma_students
      //    tenta RPC 'turma_add_aluno' (se existir) com mensalidade e vencimento; se falhar, usa insert direto.
      if (turmaId) {
        const money =
          monthlyValue && !Number.isNaN(Number(String(monthlyValue).replace(',', '.')))
            ? Number(String(monthlyValue).replace(',', '.'))
            : null;

        // tenta RPC (se sua função aceitar p_due_day/p_monthly_value, beleza; se não, ignora)
        const tryRpc = await supabase.rpc('turma_add_aluno', {
          p_turma_id: turmaId,
          p_aluno_id: studentId,
          p_monthly_value: money,
          p_due_day: dueDay || null,
        });

        if (tryRpc.error) {
          // fallback direto na tabela
          const payloadLink = {
            turma_id: turmaId,
            student_id_uuid: studentId,
            active: true,
          };
          if (money !== null) payloadLink.monthly_value = money;
          if (dueDay) payloadLink.due_day = Number(dueDay);
          // se tiver 'data_entrada' no schema:
          payloadLink.data_entrada = new Date().toISOString().slice(0, 10);

          const { error: lErr } = await supabase.from('turma_students').insert(payloadLink);
          if (lErr) throw lErr;
        }
      }

      // sucesso
      resetForm();
      onCreated?.();     // peça para a página recarregar a lista
      onClose?.();
    } catch (e) {
      console.error(e);
      alert(e.message || 'Erro ao salvar novo aluno.');
    } finally {
      setSaving(false);
    }
  }

  // Tenta inserir o aluno; se der erro de coluna inexistente, faz fallback removendo campos opcionais
  async function insertStudentWithFallback(payload) {
    // primeira tentativa
    let { data, error } = await supabase
      .from('students')
      .insert(payload)
      .select('id_uuid')
      .single();

    if (!error) return data.id_uuid;

    // se erro for "column does not exist" (42703), remove campos opcionais e tenta de novo
    const msg = `${error.message || ''}`.toLowerCase();
    if (error.code === '42703' || msg.includes('column') && msg.includes('does not exist')) {
      const p2 = { name: payload.name };
      if (payload.email) p2.email = payload.email;
      if (payload.payer_id_uuid) p2.payer_id_uuid = payload.payer_id_uuid;

      const { data: d2, error: e2 } = await supabase
        .from('students')
        .insert(p2)
        .select('id_uuid')
        .single();

      if (e2) throw e2;
      return d2.id_uuid;
    }

    // outro erro
    throw error;
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
      <div className="w-full max-w-2xl rounded-lg bg-white shadow-lg">
        <div className="flex items-center justify-between border-b px-5 py-3">
          <h2 className="text-lg font-semibold">Novo aluno</h2>
          <button
            onClick={onClose}
            className="rounded px-2 py-1 text-slate-500 hover:bg-slate-100"
            disabled={saving}
            aria-label="Fechar"
          >
            ✕
          </button>
        </div>

        <div className="grid gap-4 p-5">
          {/* Nome / Email */}
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <label className="text-sm">
              Nome do aluno
              <input
                className="mt-1 w-full rounded border px-3 py-2"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Nome completo"
              />
            </label>
            <label className="text-sm">
              Email (opcional)
              <input
                className="mt-1 w-full rounded border px-3 py-2"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="email@exemplo.com"
              />
            </label>
          </div>

          {/* Telefone / Nascimento */}
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <label className="text-sm">
              Telefone (opcional)
              <input
                className="mt-1 w-full rounded border px-3 py-2"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="(xx) xxxxx-xxxx"
              />
            </label>
            <label className="text-sm">
              Data de nascimento (opcional)
              <input
                type="date"
                className="mt-1 w-full rounded border px-3 py-2"
                value={birthDate}
                onChange={(e) => setBirthDate(e.target.value)}
              />
            </label>
          </div>

          {/* Pagador */}
          <div className="rounded border p-3">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={createPayer}
                onChange={(e) => setCreatePayer(e.target.checked)}
              />
              Criar novo pagador
            </label>

            {createPayer ? (
              <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
                <label className="text-sm">
                  Nome do pagador
                  <input
                    className="mt-1 w-full rounded border px-3 py-2"
                    value={newPayerName}
                    onChange={(e) => setNewPayerName(e.target.value)}
                    placeholder="Nome do responsável financeiro"
                  />
                </label>
              </div>
            ) : (
              <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
                <label className="text-sm">
                  Pagador
                  <select
                    className="mt-1 w-full rounded border px-3 py-2"
                    value={payerId}
                    onChange={(e) => setPayerId(e.target.value)}
                  >
                    <option value="">Selecione</option>
                    {payers.map((p) => (
                      <option key={p.id_uuid} value={p.id_uuid}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            )}
          </div>

          {/* Turma / Mensalidade / Vencimento */}
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <label className="text-sm">
              Turma (opcional)
              <select
                className="mt-1 w-full rounded border px-3 py-2"
                value={turmaId}
                onChange={(e) => setTurmaId(e.target.value)}
              >
                <option value="">— sem vínculo —</option>
                {turmas.map((t) => (
                  <option key={t.id_uuid} value={t.id_uuid}>
                    {t.nome}
                  </option>
                ))}
              </select>
            </label>

            <label className="text-sm">
              Mensalidade (opcional)
              <input
                className="mt-1 w-full rounded border px-3 py-2"
                value={monthlyValue}
                onChange={(e) => setMonthlyValue(e.target.value)}
                placeholder="Ex.: 300"
                inputMode="decimal"
              />
            </label>

            <label className="text-sm">
              Dia de vencimento
              <input
                className="mt-1 w-full rounded border px-3 py-2"
                value={dueDay}
                onChange={(e) => {
                  const v = e.target.value.replace(/\D/g, '');
                  setDueDay(v ? Math.min(31, Math.max(1, Number(v))) : '');
                }}
                placeholder="1 a 31"
                inputMode="numeric"
              />
            </label>
          </div>

          <div className="flex items-center justify-end gap-2 pt-1">
            <button
              className="rounded border px-4 py-2 text-slate-700 hover:bg-slate-50"
              onClick={onClose}
              disabled={saving}
            >
              Cancelar
            </button>
            <button
              className="rounded bg-emerald-600 px-4 py-2 font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
              onClick={handleSave}
              disabled={saving}
            >
              {saving ? 'Salvando…' : 'Salvar'}
            </button>
          </div>

          <p className="mt-1 text-xs text-slate-500">
            Dica: se sua tabela <code>students</code> ainda não tiver as colunas{' '}
            <code>phone</code> e/ou <code>birth_date</code>, deixe esses campos em branco —
            o formulário tem fallback para salvar mesmo assim.
          </p>
        </div>
      </div>
    </div>
  );
}
