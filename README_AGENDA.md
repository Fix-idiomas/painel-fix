📆 Agenda — Guia de Integração Frontend
Visão Geral

A Agenda exibe e gerencia aulas por turma e professor.
Tudo é feito via RPCs Supabase (já prontos no backend) e protegido por RLS (o professor só enxerga/edita o que é dele e das turmas vinculadas).

Entidades e Estados

Tabela núcleo: agenda_aula
Campos relevantes:
id, turma_id, professor_id, data (YYYY-MM-DD), hora_inicio (HH:MM:SS), hora_fim (HH:MM:SS), status ('prevista'|'concluida'|'cancelada'), local, observacao.

Máquina de estados (simples):

prevista → (padrão ao criar)

concluida → (quando a aula terminou)

cancelada → (via agenda_cancelar)

RPCs disponíveis
1) agenda_listar_do_dia(p_data?, p_turma_id?)

Entrada:

p_data: YYYY-MM-DD (opcional; default = hoje)

p_turma_id: uuid (opcional; filtra por turma)

Saída (array):
aula_id, turma_id, turma_name, professor_id, data, hora_inicio, hora_fim, status, local, observacao, alunos_ativos

2) agenda_criar(p_turma_id, p_data, p_hora_inicio, p_hora_fim, p_status?, p_local?, p_observacao?)

Valida: vínculo do professor, hora_fim > hora_inicio, conflito de horário.

Saída: registro criado em agenda_aula.

3) agenda_atualizar(p_aula_id, p_data?, p_hora_inicio?, p_hora_fim?, p_status?, p_local?, p_observacao?)

Valida: vínculo, conflito de horário, não troca turma_id/professor_id.

Saída: registro atualizado.

4) agenda_cancelar(p_aula_id, p_motivo?)

Efeito: status = 'cancelada' e anexa [Cancelada: motivo] à observação.

Layout sugerido (UI do Dia)

Header da Agenda

Date picker (default = hoje)

Filtro opcional de Turma

Lista de Aulas (ordenadas por hora_inicio)

Hora: 09:00–10:00

Turma: turma_name

Status: badge (prevista, concluida, cancelada)

Local (se houver)

Alunos ativos (alunos_ativos)

Ações: Editar | Concluir | Cancelar

Ações

Criar (modal → chama agenda_criar)

Editar (modal → chama agenda_atualizar)

Cancelar (confirmação → chama agenda_cancelar)

Tratamento de Erros (mensagens esperadas)

Sem permissão para operar/acessar esta turma

Conflito de horário

hora_fim deve ser maior que hora_inicio

Aula não encontrada

Fluxos de Teste (checklist rápido)

Listagem do dia retorna apenas aulas do professor logado.

Criar aula válida aparece na lista.

Criar aula com conflito bloqueia.

Editar horário sem conflito → OK.

Editar para gerar conflito bloqueia.

Cancelar muda status + observação.

Filtro por turma funciona.

Troca de data atualiza a lista.

Extensões Futuras

Presenças por aula (agenda_presenca) com status presente|falta|justificada.

Semana/Mês: agregações leves por dia.

Relatórios: horas lecionadas por período/status.