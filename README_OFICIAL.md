Painel Fix — Evolução & Financeiro (README rápido)
✅ Pré-requisitos

Auth ↔ Teachers: teachers.user_id deve apontar para auth.users.id.

RLS habilitado nas tabelas (já passamos as policies).

DEV no SQL Editor (sem JWT): defina o professor de teste

set app.dev_prof_email = 'prof@fix.local';
select public.current_professor_id(); -- deve retornar UUID

🧭 Convenções

Datas: YYYY-MM-DD (ex.: 2025-08-01).

UUIDs sempre como uuid.

Em produção, as funções *_auth usam auth.uid() (via JWT do usuário logado).

1) Evolução pedagógica — listar registros (gerais)
SQL Editor
select *
from public.evolucao_registro_listar_por_professor_auth(
  '2025-08-01',  -- p_data_ini
  '2025-08-31'   -- p_data_fim (ou null)
);

Front (JS)
const { data, error } = await supabase.rpc(
  'evolucao_registro_listar_por_professor_auth',
  { p_data_ini: '2025-08-01', p_data_fim: '2025-08-31' }
);


Retorno (colunas):
registro_id, turma_id, turma, data_registro, observacao_geral, qtd_itens, created_at

2) Evolução pedagógica — listar itens individuais
SQL Editor
select *
from public.evolucao_itens_listar_por_professor_auth(
  '2025-08-01',
  '2025-08-31'
);

Front (JS)
const { data, error } = await supabase.rpc(
  'evolucao_itens_listar_por_professor_auth',
  { p_data_ini: '2025-08-01', p_data_fim: '2025-08-31' }
);


Retorno:
registro_id, turma_id, turma, data_registro, aluno_id, aluno, observacao_individual, created_at

3) Evolução pedagógica — criar registro + itens (upsert)
SQL Editor (exemplo simples)
select public.evolucao_registro_upsert(
  p_turma_id := (select turma_id from public.turma_professor where professor_id = public.current_professor_id() limit 1),
  p_data := null,
  p_observacao_geral := 'Aula sobre reported speech',
  p_individuais := '[{"student_id_uuid":"<uuid-aluno-1>","obs":"Avanço em listening"}, {"student_id_uuid":"<uuid-aluno-2>","obs":"Revisar modals"}]'::jsonb
);

Front (JS)
const payload = [
  { student_id_uuid: '<uuid-aluno-1>', obs: 'Avanço em listening' },
  { student_id_uuid: '<uuid-aluno-2>', obs: 'Revisar modals' },
];

const { data: registroId, error } = await supabase.rpc('evolucao_registro_upsert', {
  p_turma_id: turmaId,             // uuid
  p_data: null,                    // ou '2025-08-21'
  p_observacao_geral: 'Aula sobre reported speech',
  p_individuais: payload
});


Retorno: uuid do registro_id.

4) Financeiro — lista detalhada
SQL Editor
select * from public.v_payments order by due_date;

Front (JS)
const { data, error } = await supabase.from('v_payments').select('*').order('due_date', { ascending: true });


Colunas chaves:
id, aluno, aluno_email, turma, due_date, amount, paid_at, status_runtime, status_persistido, created_at

5) Financeiro — sumários prontos
5.1 Geral do dashboard

SQL Editor

select * from public.v_payments_summary_overall;


Front (JS)

const { data } = await supabase.from('v_payments_summary_overall').select('*').single();

5.2 Por turma

SQL Editor

select * from public.v_payments_summary_by_turma order by turma;


Front (JS)

const { data } = await supabase.from('v_payments_summary_by_turma').select('*').order('turma');

5.3 Por aluno

SQL Editor

select * from public.v_payments_summary_by_student order by aluno;


Front (JS)

const { data } = await supabase.from('v_payments_summary_by_student').select('*').order('aluno');

5.4 Por professor (todas as turmas dele)

SQL Editor (informando professor)

select *
from public.payments_summary_by_professor(
  (select public.current_professor_id())
);


Front (JS)

const { data, error } = await supabase.rpc('payments_summary_by_professor_auth');

5.5 Série mensal (por professor)

SQL Editor

select *
from public.payments_monthly_by_professor(
  (select public.current_professor_id())
);


Front (JS)

const { data, error } = await supabase.rpc('payments_monthly_by_professor', {
  p_professor_id: '<uuid-professor>'
});
// (Se preferir, crio uma versão _auth que não precisa do parâmetro.)

6) Dicas de erro comuns

syntax error at or near "const" → você colou JS no SQL Editor. Use os blocos SQL acima.

current_professor_id() retorna NULL no SQL Editor → configure:

set app.dev_prof_email = 'prof@fix.local';


RLS bloqueando SELECT/INSERT → verifique se:

o teacher está vinculado à turma em turma_professor;

as policies da tabela correspondente estão criadas (ver seção RLS).

Status de pagamento:

status_runtime (view) é o “agora”.

status (tabela) é persistido via gatilho; rode o job diário para virar “overdue” automático quando necessário.

7) Campos que o front deve enviar/esperar

Criar evolução (evolucao_registro_upsert):

p_turma_id: uuid

p_data: date | null

p_observacao_geral: text | null

p_individuais: Array<{ student_id_uuid: uuid, obs?: string }>

Pagamentos (leitura via views):

amount: number, due_date: date, paid_at?: timestamptz

status_runtime: 'paid' | 'overdue' | 'open'

SEGUNDA PARTE
Painel Fix — Guia para o Front
0) Contexto rápido

Banco já pronto com UUID e RLS.

Acesso do front deve ser via RPCs (funções) e views — evita mexer direto nas tabelas e respeita as regras de segurança (RLS).

Usuário logado: o JWT do Supabase injeta auth.uid() para as funções *_auth.

1) Como chamar (padrão supabase-js)
// instância do supabase-js com sessão do usuário logado
import { createClient } from '@supabase/supabase-js'
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
  auth: { persistSession: true, autoRefreshToken: true }
})

// Views (select)
const { data, error } = await supabase.from('<view_name>').select('*')

// RPC (função no banco)
const { data, error } = await supabase.rpc('<function_name>', { /* params */ })


Importante: não rode os exemplos JS no SQL Editor. Eles são para o frontend.

2) Evolução Pedagógica
2.1 Listar registros (gerais) do professor logado

RPC: evolucao_registro_listar_por_professor_auth(p_data_ini date, p_data_fim date|null)

Retorno: registro_id, turma_id, turma, data_registro, observacao_geral, qtd_itens, created_at

const { data, error } = await supabase.rpc('evolucao_registro_listar_por_professor_auth', {
  p_data_ini: '2025-08-01',
  p_data_fim: '2025-08-31' // ou null
})

2.2 Listar observações individuais (por aluno) do professor logado

RPC: evolucao_itens_listar_por_professor_auth(p_data_ini date, p_data_fim date|null)

Retorno: registro_id, turma_id, turma, data_registro, aluno_id, aluno, observacao_individual, created_at

const { data, error } = await supabase.rpc('evolucao_itens_listar_por_professor_auth', {
  p_data_ini: '2025-08-01',
  p_data_fim: '2025-08-31'
})

2.3 Criar um registro de evolução (observação geral + individuais)

RPC: evolucao_registro_upsert(p_turma_id uuid, p_data date|null, p_observacao_geral text|null, p_individuais jsonb)

Formato de p_individuais: [{ student_id_uuid: uuid, obs?: string }, ...]

Retorno: uuid do registro_id

const payload = [
  { student_id_uuid: '<uuid-aluno-1>', obs: 'Avanço em listening' },
  { student_id_uuid: '<uuid-aluno-2>', obs: 'Revisar modal verbs' }
]

const { data: registroId, error } = await supabase.rpc('evolucao_registro_upsert', {
  p_turma_id: '<uuid-turma>',
  p_data: null, // usa a data de hoje
  p_observacao_geral: 'Aula sobre reported speech',
  p_individuais: payload
})


Para obter um turma_id válido do professor logado, liste turmas via turma_professor (ou crie um endpoint próprio no front que guarde a turma ativa).

3) Financeiro (Leitura)
3.1 Lista consolidada para tela de pagamentos

View: v_payments

Colunas úteis: id, aluno, aluno_email, turma, due_date, amount, paid_at, status_runtime, status_persistido, created_at

const { data, error } = await supabase
  .from('v_payments')
  .select('*')
  .order('due_date', { ascending: true })


status_runtime calcula paid/overdue/open em tempo real; status_persistido vem do gatilho.

3.2 Resumos prontos (dashboard)

Geral: v_payments_summary_overall (use .single())

Por turma: v_payments_summary_by_turma

Por aluno: v_payments_summary_by_student

const { data: overall } = await supabase.from('v_payments_summary_overall').select('*').single()
const { data: byTurma } = await supabase.from('v_payments_summary_by_turma').select('*').order('turma')
const { data: byStudent } = await supabase.from('v_payments_summary_by_student').select('*').order('aluno')

3.3 Resumo por professor (todas as turmas dele)

RPC: payments_summary_by_professor_auth()

const { data, error } = await supabase.rpc('payments_summary_by_professor_auth')

3.4 Série mensal por professor (gráficos)

RPC: payments_monthly_by_professor(p_professor_id uuid)
(Se quiser, criamos depois uma versão _auth sem parâmetro.)

const { data, error } = await supabase.rpc('payments_monthly_by_professor', {
  p_professor_id: '<uuid-professor>'
})

4) Boas práticas de UI e fluxo

Carregamento inicial:

buscar turmas do professor (ou manter “turma ativa” no estado do app),

puxar registros de evolução do período,

puxar pagamentos (views) e resumos.

Criação de evolução:

sempre envie student_id_uuid dos alunos da turma;

valide que há vínculo em turma_students (erros de RLS indicarão se não houver).

Pagamentos:

para listas, use v_payments;

para cards/totais, use v_payments_summary_* e/ou payments_summary_by_professor_auth().

Erros comuns:

401/permission denied → RLS: verifique se o user está vinculado em teachers.user_id e turma_professor.

null value in column "turma_id" ao criar evolução → o front enviou turma nula/errada.

No SQL Editor não existe sessão → não teste JS lá; use os blocos SQL puros.

5) Debug rápido no DEV (opcional)

No SQL Editor (sem JWT), o helper usa um fallback:

set app.dev_prof_email = 'prof@fix.local';
select public.current_professor_id(); -- deve retornar o professor de DEV

6) Checklist de integração

 Login Supabase funcionando (sessão persistida).

 teachers.user_id sincronizado com auth.users.id (gatilho handle_new_user()).

 Professor vinculado a pelo menos uma turma em turma_professor.

 Front consome apenas RPCs e Views listadas acima.

 Tratamento de erros do supabase.rpc/.from().select com feedback na UI.