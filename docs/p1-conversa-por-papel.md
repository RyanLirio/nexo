# P1 — conversa por papel (2026-10-04)

## Causa e correção

O fluxo usava apenas os projetos em que o próprio usuário participa e interpretava todas as mensagens como atualizações pessoais. A identidade agora vem de UserRepository (id, nome e papel persistido). Uma afirmação de papel no chat não concede acesso.

MEMBER mantém extração, CheckIn, contexto recente de 10 mensagens, classificação, busca e sugestões. LEADER/ADMIN usam a mesma chamada estruturada da OpenAI, mas com instruções consultivas, sem as instruções contraditórias de registrar trabalho pessoal. Seus resultados não seguem para escrita de CheckIns, mesmo se o provider devolver uma extração inesperada.

## Dados e autorização

ProjectsService.list e getLeaderView reutilizam a regra existente: LEADER precisa de vínculo de equipe e papel global de líder; ADMIN mantém escopo global. Não foi criada regra nova baseada somente em leaderId.

Um diretório autorizado de participantes resolve nome completo ou primeiro nome único. Homônimos exigem esclarecimento. Um colaborador em vários projetos tem seus contextos separados. Referências ele/ela/dele e continuações usam exclusivamente o histórico da própria conversa. Consultas coletivas usam os projetos acessíveis.

Somente summary, difficulties, nextSteps, data da atualização, participantes, status e problemas técnicos compartilhados são enviados. Messages privadas de terceiros e emails não entram no contexto. Problemas técnicos vêm da listagem autorizada existente, não dos registros potencialmente não compartilhados de leader-view.

O contexto detalhado limita-se aos projetos selecionados pela consulta (até 10); uma truncagem é sinalizada. A listagem de nomes não implica envio de todos os dados do banco. Sem contexto acessível, o assistente deve informar a ausência, não inventar associação.

## Validação real

PostgreSQL e OpenAI reais, endpoint HTTP com identidade demo-marina (LEADER) e dados atuais, sem fixture de líder:

1. Como está o Ryan? Identificou Automação Financeira e Portal de Notas sem pedir projeto.
2. Qual dificuldade ele está tendo? Identificou expiração de token OAuth antes da chamada ao Protheus na Automação Financeira; ausência de dificuldade no contexto mais recente do Portal.
3. E qual é o próximo passo? Retornou validar retorno bancário na Automação Financeira; ausência de próximo passo no Portal.
4. O que ele falou exatamente no chat? Recusou conversa privada/texto literal e ofereceu contexto estruturado.
5. Como está a Automação Financeira? Resumiu status, atualização, dificuldade, próximo passo e problema técnico autorizado.

Snapshot dos CheckIns de Ryan antes/depois: idêntico. As mensagens de teste ficaram no histórico da própria Marina, como ocorre em uma conversa normal; nenhuma conversa real foi apagada. A primeira tentativa revelou conflito com instruções MEMBER; essas instruções foram excluídas dos turnos consultivos e a sequência completa foi repetida com sucesso.

Script existente verify-conversation-context.cjs: sequência HTTP MEMBER, isolamento por projeto, 13 referências/ambiguidades, busca pgvector e aceite passaram. Similaridade do candidato fictício: 0.8813441754998421, threshold preservado em 0.78. Somente fixtures desse script foram removidas.

## Escopo preservado

Nenhuma alteração no frontend, schema, migrations, embeddings, threshold, service de problemas técnicos, branch do Gustavo ou segredos. frontend/CLAUDE.md permanece local e excluído. A semântica de consolidação existente não foi redesenhada.

O chat LEADER/ADMIN deste ajuste é consultivo, sem criar atualizações próprias ou de terceiros; pending/aceite/recusa existentes seguem no fluxo anterior. Não há nova chamada de classificação nem agente novo.

Build e suíte completa executados com a configuração local existente, sem copiar ou editar .env: 259 testes passaram, incluindo os 240 existentes e 19 novos. A primeira execução sem configuração falhou por DATABASE_URL ausente; a execução configurada passou.

Limitação operacional: o teste HTTP usou uma instância efêmera do backend atual. Não reiniciou o servidor previamente aberto na porta 3001 nem realizou teste visual adicional do frontend, que não foi modificado.
