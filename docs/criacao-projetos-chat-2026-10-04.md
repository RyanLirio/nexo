# Criação de projeto pelo chat do colaborador

Branch: `codex/integracao-main-fases-1-3`. Bloco iniciado em 23:27:46 UTC, limite de 25 minutos. Sem push/merge.

## O que faltava e como funciona

A criação REST já existia, mas a análise do chat retornava somente contextos de projetos existentes e não havia uma ação de criação conectada ao ProjectsService. A criação não podia ser confirmada por uma resposta textual da IA sem persistência.

A mesma chamada a gpt-5.4-mini agora retorna `projectAction: NONE | CREATE_PROJECT` e `projectCreation` com `name`, `description`, `leaderName`, `teamName`, todos nullable durante a coleta. Intenção clara ou resposta à coleta pendente habilita criação; hipótese/cancelamento não habilita. LEADER/ADMIN permanecem consultivos. A coleta habilitada tem prioridade sobre aliases de projetos existentes; sua ação é exigida no structured output, sem segunda chamada.

Dados mínimos para salvar: nome, líder real e equipe comum resolvida. Descrição é opcional. Respostas curtas recuperam o mesmo pedido nos dez turnos recentes. As perguntas de coleta são persistidas como ASSISTANT normal; não foi criada tabela/estado pending novo. Após confirmar uma criação, uma atualização posterior não repete a ação antiga.

## Segurança e regras preservadas

- Backend resolve nomes por comparação normalizada e palavras completas, sem fuzzy matching. Não aceita userId/creator/responsável da IA.
- Consulta de candidatos ocorre apenas nas equipes do usuário autenticado. Só usuários LEADER/ADMIN pertencentes a essas equipes podem ser líderes, conforme Project.validateLeader existente. Nenhum diretório global é exposto.
- Dois líderes plausíveis: pede nome completo, sem escolher por ordem. Nenhum líder válido/equipe comum: não cria e informa necessidade de vínculo compartilhado; não enumera usuários externos.
- Uma equipe comum: usa automaticamente. Mais de uma: pede equipe e continua pela resposta curta. Equipe externa/nome de equipe não resolvido: não cria.
- Creator e responsibleUserId vêm exclusivamente do usuário autenticado. Papel global MEMBER continua MEMBER.
- Reutiliza ProjectsService.create, Project.buildInitialMembers e ProjectRepository.create: criador MEMBER; líder OWNER; leaderId e teamId reais. Nenhum membro duplicado.
- Status inicial **ACTIVE**, preservando o default explícito já existente em Prisma/REST. Não foi introduzido PLANNING nem alterado schema. Isso permite CheckIn posterior pelo fluxo ACTIVE atual.
- Requests do mesmo usuário continuam serializados pela Conversation. Criações no mesmo time/nome também são serializadas na instância do ProjectsService; nome existente (normalizado por caixa/acentos/espaços) não gera outro projeto. Essa proteção não é constraint distribuída entre múltiplas instâncias/REST concorrente; não foi criada migration/arquitetura nova.
- Confirmação de criação vem do resultado persistido no backend, não de assistantResponse. O pedido não cria CheckIn; a Message seguinte de trabalho pode criá-lo normalmente, com CheckInMessage.

## Validação

- `npm test` backend: **303 testes, 303 aprovados**, mantendo os 266 anteriores e acrescentando 37 regressões, incluindo intenção condicional e pedido genérico que não devem criar projeto.
- `npm run build` backend: aprovado.
- Frontend não alterado; 12 testes existentes aprovados. Build/typecheck do frontend não necessários neste bloco.
- `scripts/verify-chat-project-creation.cjs`: endpoint HTTP, PostgreSQL e OpenAI reais; fixtures isoladas de Ryan MEMBER/Marina LEADER, com UUIDs e emails example.invalid, sem alterar usuários demo/reais.
- Projeto Demo Chat salvo de verdade; creator/responsável autenticados; Ryan MEMBER e Marina OWNER; status ACTIVE; aparece na lista dos dois. Marina consultou `quais projetos eu lidero?` e recebeu o projeto; consulta seleciona leaderId real, não todos os projetos da equipe.
- Atualização posterior gerou CheckIn no projeto novo e vínculo com a Message. Pedido duplicado recusado; hipótese não criou projeto.
- Coleta intenção → nome → `a Marina`: aprovada. Duas equipes comuns → pergunta → `Engenharia de Teste`: aprovada. Dois líderes Marina → pergunta → `Marina Outra`: aprovada.
- As duas falhas encontradas na validação real foram corrigidas: seletor não reconhecia `quais projetos eu lidero?`; coleta de nome novo era interpretada como alias de projeto existente. Ambos têm regressões.
- `scripts/verify-semantic-integration.cjs`: aprovado com pgvector 0.8.6 real. Paráfrase similarity 0.856131; Conversation similarity 0.932499; threshold 0.78/top 5, consentimento, acesso MEMBER/ADMIN, caso negativo, isolamento, CheckIns, sugestão/aceite/recusa e histórico preservados.
- Limpeza confirmada pelos dois scripts: somente fixtures dessas execuções removidas. Nenhum banco/volume/seed real apagado.

## Arquivos e limites

Alterações somente em OpenAIService/schema e testes, ConversationsService/seletor/testes, ProjectsService/repository Prisma/contrato, helper de criação, script opt-in e este relatório. Frontend, CLAUDE.md, mcp-server, env, schema, migrations, embeddings e threshold intactos.

OpenAI Docs orientou a extensão do schema Zod na chamada existente e a validação semântica adicional no backend, além da forma JSON: [Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs).

Limites conhecidos: contexto de coleta depende das dez mensagens recentes; não é uma fila persistente de criação entre dias. Duplicidade está protegida no servidor local do MVP, não por constraint distribuída. Não há bloqueador conhecido nos casos solicitados após a validação. Commit local previsto: `feat: permite criar projetos pelo chat`. Não publicar nem iniciar outra fase neste bloco.
