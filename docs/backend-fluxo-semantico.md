# Backend Nexo — fluxo semântico atual

Estado verificado em 04/10/2026 na branch `codex/integracao-main-fases-1-3`.
Este documento descreve o backend atual; os documentos do kickoff são históricos.

O núcleo de aceite/recusa adicionado depois deste checkpoint está em [Fase 4 — aceite de solução](fase4-aceite-solucao.md).

## Conversation e CheckIn

`POST /api/v1/conversations/message`, autenticado, recebe `{ "message": "..." }`.

```text
Message original → projetos ACTIVE do usuário → extração estruturada (gpt-5.4-mini)
  assistantResponse: conversa curta orientada ao contexto de trabalho
  por projeto: summary / difficulties / nextSteps / classification / normalizedProblem
    → Conversation diária e CheckIn por usuário + projeto + dia
    → CheckInMessage vincula a Message original, sem apagar vínculos anteriores
    → se TECHNICAL_PROBLEM: busca semântica → solutionSuggestion
```

As Messages originais são a fonte de verdade. Dificuldade e próximo passo retornados
como `null` não apagam os valores anteriores do CheckIn. O resumo ainda usa a
consolidação já existente da LLM: este pacote **não resolve sua dívida de perda de contexto**.
O dia segue o fuso local do processo, conforme a implementação atual.

`NO_PROBLEM` não relata dificuldade; `DIFFICULTY` relata bloqueio sem problema concreto;
`TECHNICAL_PROBLEM` relata sintoma técnico identificável ou causa conhecida.
Cada contexto é classificado isoladamente. A classificação e a normalização saem da
mesma extração estruturada, sem uma segunda chamada de classificação.

`extractProjectContexts()` agora retorna `{ assistantResponse, projects }` na mesma
chamada Responses/structured output (Zod). A resposta reconhece avanços e dificuldades,
permite saudações e perguntas sobre capacidades, mas redireciona código, redação,
viagem e curiosidades gerais para o contexto de trabalho. Não inventa soluções.
Se não identificar projeto com segurança, pergunta qual projeto, sem criar CheckIn.
Contextos vazios retornados pela IA são descartados antes de persistir.

Prioridade da Message ASSISTANT:

1. aceite/recusa/desambiguação de pending solution e respostas de segurança;
2. match único: oferta determinística de solução, sem mostrar a solução;
3. múltiplos matches: pergunta de qual projeto;
4. demais casos: `assistantResponse` da análise.

Somente os campos estruturados do relato original alimentam CheckIn. Perguntas ou
texto gerados pelo assistente nunca são extraídos de novo para persistência.
Não há segunda chamada para resposta conversacional; embeddings continuam sendo
chamadas distintas apenas no fluxo técnico já existente. Aceite/recusa não chamam IA.
O contrato HTTP/frontend mantém `assistantMessage.content`; `assistantResponse` é
interno. O frontend não precisa renderizar JSON ou metadados da classificação.

O repository possui `findRecentMessages(userId, limit)` e a tool de leitura já isola
o usuário. O histórico USER/ASSISTANT não foi adicionado ao prompt neste bloco:
preserva o isolamento da mensagem atual e evita reintroduzir soluções já aceitas
na resposta genérica. Somente os campos diários já existentes são enviados.

Resposta por projeto, quando houver candidato:

```json
{
  "projectId": "projeto-atual",
  "summary": "Contexto do trabalho.",
  "difficulties": "Token expira antes da requisição.",
  "nextSteps": null,
  "classification": "TECHNICAL_PROBLEM",
  "normalizedProblem": "O token OAuth expira antes da requisição ao Protheus.",
  "solutionSuggestion": {
    "available": true,
    "technicalProblemId": "problema-conhecido",
    "similarity": 0.86,
    "technology": "OAuth / Protheus"
  }
}
```

Sem candidato, `solutionSuggestion` é `null`. A busca interna pode retornar `solution`,
mas antes do aceite o JSON da Conversation não retorna `solution` nem `similarProblems`.
O aceite e a pendência foram acrescentados pela Fase 4, no documento vinculado acima.
Uma solução só aparece na Conversation depois do aceite e da revalidação atual.
Os endpoints da base compartilhada continuam podendo mostrar soluções autorizadas a
usuários com acesso; a restrição acima é o contrato público da **Conversation**.

## Conhecimento técnico e embedding

`TechnicalProblemService.create()` valida o registro, gera o embedding exclusivamente
de `problem`, cria o problema privado e grava o vetor parametrizado no PostgreSQL.
`solution` continua opcional. O modelo é `text-embedding-3-small`, 1536 dimensões,
e a coluna existente é `Unsupported("vector(1536)")?` no Prisma.

Se a OpenAI falhar, o registro de negócio é salvo sem vetor e há warning somente com
ID, sem texto, credenciais ou payload do provedor. Se a gravação do vetor falhar, o
registro também permanece e pode ser recuperado pelo backfill.
`updateSolution()` salva a solução e só enriquece o `problem` armazenado se faltar vetor;
falhas de enriquecimento não desfazem a solução. Um vetor existente não é substituído.

`searchSimilarByText(problem, userId)` centraliza validação, **um embedding por consulta**
e busca pgvector para Conversation e tools. O embedding da consulta não é persistido.
O banco calcula:

```sql
similarity = 1 - (problem."problemEmbedding" <=> query_embedding.value)
```

Exige embedding, `sharingAuthorizedAt IS NOT NULL`, solução não nula e `BTRIM(solution) <> ''`.
Aplica `similarity >= 0.78`, ordenação decrescente e `LIMIT 5` no PostgreSQL.
Não restringe ao projeto atual e não compara vetores em TypeScript.

## Acesso e consentimento

MEMBER e LEADER leem conhecimento de projetos pertencentes às equipes nas quais têm
`TeamMember`. ADMIN possui acesso global, **sem ignorar autorização de compartilhamento**.
A implementação reaproveita `AccessControlService`; não cria uma política paralela.

A busca textual, listagem e detalhe compartilhado de TechnicalProblem aplicam esse
escopo. A busca semântica aplica o filtro dentro do SQL. Detalhe por ID externo ou não
autorizado retorna 404. Detalhe de projeto, listagem de projetos, leader view e tool de
contexto também respeitam equipes, sem permitir contorno por `teamId`/`userId` na query.

O contexto de projeto e a listagem gerencial existente podem mostrar rascunhos da
própria equipe; isso não publica esses registros na base compartilhada. A autorização
continua sendo do autor, não automática para o líder. As regras anteriores de escrita
não recebem privilégio global novo neste pacote.

Existe uma composição legada de rota em TechnicalProblemController:
`/api/v1/technical-problems/api/v1/projects/:projectId/technical-problems`.
Foi protegida e testada, mas não renomeada para evitar uma mudança de contrato fora deste pacote.

## AI tools disponíveis

| Tool | Comportamento |
| --- | --- |
| `get_user_projects` | Projetos ACTIVE de participação do usuário, respeitando equipe. |
| `get_project_context` | Contexto de projeto acessível e problemas abertos gerenciais. |
| `get_recent_messages` | Mensagens recentes do próprio usuário. |
| `save_checkin` | Delegação ao fluxo já existente de CheckIn. |
| `manage_technical_problem` | `create`/`resolve` delegam ao service e usam o mesmo lifecycle de embedding. |
| `search_knowledge_base` | Busca **textual**, sem OpenAI, preservando filtros e regras de solução existentes. |
| `search_similar_technical_problems` | Busca **semântica** de problema concreto; recebe `{ "problem": "..." }`, sem exigir projeto. |

A tool semântica retorna ID, projeto, problema, tecnologia, solução autorizada, autor
(ID/nome) e similaridade; não retorna embedding. São ferramentas internas do backend,
não um MCP entregue nem um agente autônomo/tool-calling completo.

## Manutenção e validação

No `backend`, com Node 24 e variáveis do ambiente já configuradas:

```powershell
npm test
npm run build
npm run prisma:status
npm run backfill:technical-problem-embeddings -- --dry-run
npm run backfill:technical-problem-embeddings
npm run test:integration:semantic
```

O backfill processa sequencialmente somente vetores nulos, continua após falhas,
informa sucessos/falhas e é idempotente. Não modifica solução, consentimento, autoria,
projeto ou seed. Dry-run não chama a OpenAI. Embeddings adicionados a registros reais
**não são removidos**. O seed continua sem dependência de OpenAI: dados primeiro,
backfill depois.

A integração semântica é opt-in e exige PostgreSQL com pgvector, migrations existentes,
`DATABASE_URL`, `OPENAI_API_KEY` e acesso à internet. Faz chamadas pagas somente com
textos fictícios, inicia NestJS em porta local efêmera, cria fixtures únicas e testa
embedding persistido, paráfrase, caso diferente, equipes, ADMIN, consentimento, solução,
top 5 com seis candidatos, tools e Conversation HTTP sem vazamento de solução.
Também valida saudações, capacidades, atualização, dificuldade sem causa, tarefas
fora do escopo, isolamento entre dois projetos e persistência da resposta natural.
Quando a mensagem sem nome de projeto precisar de esclarecimento, o verificador
registra isso e envia um follow-up fictício com nome explícito; não força associação.
Limpa somente IDs/projetos/usuários próprios em `finally`, inclusive após falha.
Interrupção abrupta do processo pode impedir `finally`; o prefixo `semantic-test-<uuid>`
identifica a execução, mas não autoriza apagar outros registros em massa.
Nenhum teste de integração substitui erro/indisponibilidade por sucesso fictício.

Não há lint configurado neste backend; nenhuma ferramenta foi instalada para isso.
Seleção por projeto entre várias sugestões e frontend real já fazem parte do MVP.
Criação automática de TechnicalProblem, MCP e recuperação de histórico visual após
reload permanecem fora deste bloco. Retenção perfeita do summary não é garantida.
