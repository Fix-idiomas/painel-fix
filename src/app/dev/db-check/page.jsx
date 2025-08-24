'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

export default function DBCheck() {
  const [out, setOut] = useState([]);

  function log(title, payload) {
    setOut((prev) => [...prev, { title, payload }]);
  }

  useEffect(() => {
    (async () => {
      try {
        log('ENV', {
          url: process.env.NEXT_PUBLIC_SUPABASE_URL ? 'ok' : 'MISSING',
          anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? 'ok' : 'MISSING',
        });

        // 1) ping básico
        const { data: pong, error: e0 } = await supabase.from('_pg_meta').select('tablename').limit(1);
        log('Ping _pg_meta (só para checar conexão)', e0 ? e0.message : 'ok');

        // 2) select simples
        const { data: students, error: e1 } = await supabase
          .from('students')
          .select('id_uuid, name, payer_id_uuid')
          .limit(5);
        log('students SELECT', e1 || students);

        const { data: payers, error: e2 } = await supabase
          .from('payers')
          .select('id_uuid, name')
          .limit(5);
        log('payers SELECT', e2 || payers);

        const { data: links, error: e3 } = await supabase
          .from('turma_students')
          .select('student_id_uuid, turma_id_uuid, active, monthly_value')
          .limit(5);
        log('turma_students SELECT', e3 || links);

        // 3) views
        const { data: v1, error: e4 } = await supabase
          .from('v_active_student_monthly_value')
          .select('*')
          .limit(5);
        log('v_active_student_monthly_value', e4 || v1);

        const { data: v2, error: e5 } = await supabase
          .from('v_responsible_summary')
          .select('*')
          .limit(5);
        log('v_responsible_summary', e5 || v2);

        // 4) insert de teste (com rollback lógico: não salva)
        // comente as linhas de insert se não quiser criar nada.
        /*
        const { data: ins, error: e6 } = await supabase
          .from('students')
          .insert({ id_uuid: crypto.randomUUID(), name: 'Smoke Test', email: 'smoke@test.local' })
          .select();
        log('students INSERT (teste)', e6 || ins);
        */
      } catch (err) {
        log('FATAL', err?.message || String(err));
      }
    })();
  }, []);

  return (
    <main className="p-4 space-y-3">
      <h1 className="text-lg font-semibold">DB Check</h1>
      <div className="text-sm opacity-70">Abra o console também (F12 &gt; Console / Network)</div>
      <pre className="bg-neutral-100 p-3 rounded overflow-x-auto text-xs">
        {JSON.stringify(out, null, 2)}
      </pre>
    </main>
  );
}
