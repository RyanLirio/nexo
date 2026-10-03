# Relatório do pacote técnico — 03/10/2026

## Estado e segurança

- Branch: `codex/integracao-main-fases-1-3`.
- HEAD inicial: `d9f407c972d3eba0c1e1270c32dd43e4f7d4c26f`.
- `origin/main` observado após fetch: `9855a42ceb16e58d56592554933ca28b4b2eb49e`, sem avanço relevante.
- Trabalho isolado no worktree de integração; checkout original da main não foi trocado ou editado.
- Commits somente locais; nenhum push, merge remoto, rebase, force push ou reset.
- Sem alteração em frontend, .env, segredo, schema, migrations, seed, mcp-server ou arquivos externos ao pacote.

## Implementação entregue

1. **Lifecycle:** create gera embedding de `problem` e grava `vector(1536)` com SQL parametrizado. Solution continua opcional. Resolve usa o problema armazenado e não recria vetor existente.
2. **Falha da OpenAI:** problema/solução são salvos; vetor pode permanecer null; warning com ID sem payload/segredo. Cliente OpenAI é inicializado sob demanda, evitando impedir o início do backend por ausência de chave.
3. **Backfill:** script sequencial, idempotente, dry-run, contagem de sucessos/falhas, continua após falhas individuais. Nenhuma alteração em solution, consentimento, autor ou projeto.
4. **Acesso:** MEMBER/LEADER via TeamMember; ADMIN global. Base compartilhada mantém consentimento. Filtro textual está no Prisma; filtro semântico permanece no PostgreSQL.
5. **Auditoria:** list/getById de TechnicalProblem, rota gerencial por projeto, detalhe/lista de Project, leader view e tool de contexto protegidos. ID externo retorna 404 para conhecimento; projeto externo retorna 403. Query teamId/userId não remove a fronteira por equipe.
6. **Busca textual:** `search_knowledge_base` continua textual, com a mesma regra de solution existente e sem embedding. Agora recebe o usuário e limita a base às equipes acessíveis.
7. **Busca semântica:** `search_similar_technical_problems({problem})` adicionada ao catálogo e dispatcher; não exige projeto. Retorna solução autorizada somente internamente, não vetor.
8. **Manage tool:** create/resolve delegam ao TechnicalProblemService; não há geração de embedding duplicada na tool.
9. **Conversation:** usa `searchSimilarByText(normalizedProblem, userId)`. Uma extração/classificação por mensagem e um embedding por contexto técnico, sem segunda classificação.
10. **Sugestão:** candidato mais semelhante vira metadados públicos por projeto:

```json
{
  "solutionSuggestion": {
    "available": true,
    "technicalProblemId": "...",
    "similarity": 0.86,
    "technology": "OAuth / Protheus"
  }
}
```

Sem match, NO_PROBLEM ou DIFFICULTY: `solutionSuggestion: null`.
O JSON externo da Conversation não contém `solution` nem `similarProblems`.
A base compartilhada já existente continua permitindo leitura de soluções consentidas por usuários autorizados; não foi transformada em um novo fluxo de aceite.

## Evidência no banco

| Verificação | Resultado |
| --- | --- |
| TechnicalProblems reais | 2 antes / 2 depois |
| Com embedding | 0 antes / 2 depois |
| Sem embedding | 2 antes / 0 depois |
| Primeiro dry-run | 2 registros |
| Backfill real | 2 sucessos, 0 falhas |
| Segunda execução / dry-run final | 0 registros |
| Dimensões de demo-know-draft | 1536 |
| Dimensões de demo-know-ssl | 1536 |
| Fixtures ao finalizar | 0 usuários e 0 projetos semantic-test-* |

Os dois embeddings reais foram mantidos. O draft continua não autorizado e não passa
a aparecer na base compartilhada só por possuir vetor.

Foi aplicada somente a migration **já existente na main**:
`20260930180000_add_project_estimated_completion_and_priority`.
Seu SQL adiciona duas colunas opcionais; não apaga dados. Nenhuma migration foi criada ou editada.
As sete migrations estão aplicadas. `prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --exit-code` retornou **No difference detected**, código 0.

## Testes e build

- `npm test`: **130/130**, 0 falhas, 0 skips.
- `npm run build`: passou, incluindo Prisma generate e Nest build.
- 22 novos testes: 6 lifecycle, 1 SQL de persistência parametrizada, 8 autorização,
  6 tools e 1 isolamento/não vazamento entre dois contextos técnicos.
- Testes existentes de CheckIn/classificação/vínculos preservados e atualizados para o contrato seguro.
- Lint não configurado; nenhuma dependência instalada para lint.
- NestJS iniciou de verdade sem ciclo de módulos ou erro de injeção.

`npm run test:integration:semantic` passou com PostgreSQL real, pgvector **0.8.6**,
OpenAI **text-embedding-3-small**, 1536 dimensões, **threshold 0.78 inalterado**:

| Caso final | Resultado |
| --- | --- |
| Paráfrase pela tool semântica | similarity **0.856236** |
| Conversation HTTP real | TECHNICAL_PROBLEM e similarity **0.845472** |
| Normalização dessa Conversation | “a autenticação com o Protheus falha porque o token OAuth vence antes do envio da requisição” |
| Mensagem sobre API de boletos / erro 500 | Candidato OAuth rejeitado |
| Conhecimento de outro projeto da mesma equipe | Encontrado |
| Outra equipe sem vínculo | Excluída para MEMBER/LEADER |
| ADMIN | Candidato externo permitido, consentimento ainda obrigatório |
| Sem consentimento / solution null ou espaços | Excluído da busca semântica |
| Seis candidatos elegíveis | Exatamente 5 retornados |
| HTTP sem autenticação | 401 |
| ID externo / privado | 404 conforme acesso e consentimento |
| Project externo / leader view | 403; ADMIN 200 |
| CheckIn e CheckInMessage | Campos iguais ao retorno real e Message vinculada |
| JSON da Conversation | Sem solution, sem similarProblems, sem texto da solução |
| finally | Somente fixtures próprias removidas |

A primeira execução do novo verificador atingiu corretamente a busca e o HTTP, mas
falhou numa asserção excessiva que exigia difficulties não nulo. Esse campo é nullable.
O verificador passou a comparar os três campos persistidos com o retorno real, sem
alterar produção ou forçar resposta da IA. A limpeza foi executada também nessa falha.
As execuções seguintes, incluindo top 5 real, passaram.
Sem OPENAI_API_KEY, o script também foi verificado: saiu com código 1 e mensagem explícita, antes de criar fixtures ou chamar o banco.

## Documentação, limpeza e pendências

- [Fluxo atual do backend](backend-fluxo-semantico.md): Conversation, CheckIn, lifecycle, acesso, tools e comandos de manutenção.
- [Estado histórico](estado-atual.md): indicação de que o kickoff é histórico e link para o documento atual.
- Auditoria limitada aos arquivos do pacote: casts redundantes removidos, sem novo any nos fluxos técnicos, SQL parametrizado, warnings sem payload, exports/imports Nest corrigidos e inicialização real validada.
- Seed inspecionado: cenários SSL resolvido autorizado, timeout privado e problema PostgreSQL sem solução. Sem chamadas OpenAI; não foi alterado nem executado.

Pendências intencionais para Ryan:
- decidir UX/contrato do aceite e recusa da sugestão;
- decidir se e como persistir estado de solução pendente;
- implementar resposta conversacional/aceite somente após essas decisões;
- dívida de consolidação de currentSummary preservada, não redesenhada;
- composição legada da rota gerencial de TechnicalProblem documentada e protegida, não renomeada;
- MCP, agente completo, frontend e criação automática de TechnicalProblem não implementados neste pacote.

No checkout original, ficaram intactos e fora dos commits:
`.gitignore`, `README.md`, edição prévia de `backend/src/technical-problems/technical-problem.service.ts`,
`frontend/next-env.d.ts`, `frontend/CLAUDE.md`, `mcp-server/`, `scripts/` e `start-nexo.cmd`.

## Arquivos por checkpoint

### Commit A — `b8f7faf`

feat: persiste embeddings de problemas técnicos

- `backend/package.json`
- `backend/scripts/backfill-technical-problem-embeddings.cjs`
- `backend/src/ai/ai.module.ts`
- `backend/src/ai/tools/ai-tools.module.ts`
- `backend/src/app.module.ts`
- `backend/src/conversations/conversations.module.ts`
- `backend/src/domain.spec.ts`
- `backend/src/technical-problems/embedding-lifecycle.spec.ts`
- `backend/src/technical-problems/prisma-technical-problem.repository.spec.ts`
- `backend/src/technical-problems/prisma-technical-problem.repository.ts`
- `backend/src/technical-problems/technical-problem.repository.ts`
- `backend/src/technical-problems/technical-problem.service.ts`

### Commit B — `b2756e8`

feat: protege e reutiliza busca de conhecimento técnico

- `backend/scripts/backfill-technical-problem-embeddings.cjs`
- `backend/src/ai/openai.service.ts`
- `backend/src/ai/tools/ai-tools.definitions.ts`
- `backend/src/ai/tools/ai-tools.service.ts`
- `backend/src/ai/tools/semantic-tools.spec.ts`
- `backend/src/app.module.ts`
- `backend/src/common/auth/access-control.module.ts`
- `backend/src/conversations/conversations.service.spec.ts`
- `backend/src/conversations/conversations.service.ts`
- `backend/src/domain.spec.ts`
- `backend/src/projects/prisma-project.repository.ts`
- `backend/src/projects/project.repository.ts`
- `backend/src/projects/projects.controller.ts`
- `backend/src/projects/projects.module.ts`
- `backend/src/projects/projects.service.ts`
- `backend/src/technical-problems/embedding-lifecycle.spec.ts`
- `backend/src/technical-problems/knowledge-access.spec.ts`
- `backend/src/technical-problems/prisma-technical-problem.repository.ts`
- `backend/src/technical-problems/technical-problem.controller.ts`
- `backend/src/technical-problems/technical-problem.module.ts`
- `backend/src/technical-problems/technical-problem.repository.ts`
- `backend/src/technical-problems/technical-problem.service.ts`

### Commit C — `b79ffaa`

feat: prepara sugestão de solução no fluxo conversacional

- `backend/src/conversations/conversations.service.spec.ts`
- `backend/src/conversations/conversations.service.ts`

### Checkpoint final — validação e documentação

Mensagem: `test: valida e documenta integração semântica`.
O hash deste próprio checkpoint é apresentado na resposta final e em `git log -1`.

- `backend/package.json`
- `backend/scripts/verify-semantic-integration.cjs`
- `backend/src/projects/projects.service.ts`
- `backend/src/technical-problems/prisma-technical-problem.repository.ts`
- `docs/backend-fluxo-semantico.md`
- `docs/estado-atual.md`
- `docs/relatorio-backend-2026-10-03.md`
