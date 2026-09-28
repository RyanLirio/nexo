# Estado atual do Nexo — 19/09/2026

## O que funciona

- Frontend navegável em `/`, `/login`, `/colaborador`, `/lider` e `/projetos/[id]`.
- Conversa demonstrativa: enviar adiciona uma mensagem na tela, sem persistência.
- Backend NestJS compilado com rotas de leitura de projetos, criação e leitura de check-ins, consulta e registro de problemas técnicos e pedidos de ajuda.
- Schema Prisma v2 validado. A nova migration está versionada e preserva a migration inicial.
- Seed repetível para um banco de desenvolvimento, com equipe, pessoas, projetos, contexto, problemas técnicos autorizados/privados e pedido de ajuda.

## Rotas de desenvolvimento

| Rota | Função |
| --- | --- |
| `GET /health` | Confere conexão com PostgreSQL. |
| `GET /projects/:id` | Projeto, equipe, participantes e último check-in. |
| `GET /users/:userId/projects` | Projetos dos quais uma pessoa participa. |
| `GET /teams/:teamId/projects` | Projetos de uma equipe. |
| `GET /projects/:projectId/check-ins` | Até 50 atualizações recentes. |
| `POST /projects/:projectId/check-ins` | Cria atualização após validar campos e vínculo do usuário. |
| `GET /technical-problems?query=...` | Busca textual em título, problema, tecnologia e solução; retorna só problemas autorizados. |
| `GET /technical-problems/:id` | Detalhe de um problema técnico autorizado. |
| `POST /technical-problems` | Cria problema técnico privado; valida autor e projeto de origem. |
| `PATCH /technical-problems/:id/authorize` | Registra autorização declarada pelo autor informado. |
| `GET /projects/:projectId/help-requests` | Até 50 pedidos recentes do projeto. |
| `POST /projects/:projectId/help-requests` | Cria pedido após validar solicitante e ajudante. |
| `PATCH /help-requests/:id/status` | Avança estado até `RESOLVED` e preenche `resolvedAt`. |

Corpos mínimos:

```text
POST /projects/:projectId/check-ins
{"userId":"demo-marina","summary":"Integração avançou.","difficulties":"Erro no retorno.","nextSteps":"Revisar validação."}
```

```text
POST /technical-problems
{"projectId":"demo-financeiro","authorId":"demo-marina","title":"Porta da integração","problem":"Falha de comunicação","solution":"Corrigir a porta"}
```

```text
POST /projects/:projectId/help-requests
{"requesterId":"demo-marina","problem":"Preciso revisar o retorno da API"}
```

```text
PATCH /help-requests/:id/status
{"status":"IN_PROGRESS"}
```

Para autorizar um problema técnico, envie `{"authorId":"demo-marina"}` em `PATCH /technical-problems/:id/authorize`.

## O que ainda é simulado

- O login Google está integrado, mas depende de `GOOGLE_CLIENT_ID` e `NEXT_PUBLIC_GOOGLE_CLIENT_ID` válidos no ambiente.
- Pessoas, projetos, conversa, resumo e visão do líder no frontend vêm de dados fictícios em `frontend/data/mock-data.ts`.
- O frontend chama a API para autenticação; as demais telas ainda usam dados fictícios.
- Não há geração de embedding, busca semântica ou MCP. A coluna opcional `problemEmbedding vector(1536)` apenas prepara o armazenamento futuro. A conversa não é salva.

## Banco e validação desta execução

O computador estava com Node 25.0.0, enquanto o projeto declara Node 24 LTS. O aviso de `engines` foi mantido; a faixa não foi alterada.

Nesta sessão não havia `backend/.env`, serviço PostgreSQL na porta 5432 ou daemon Docker ativo. Para validar schema, gerar cliente e compilar, foi usada uma `DATABASE_URL` fictícia apenas no processo do comando. `prisma:generate`, `prisma:validate` e `build` passaram; quatro testes de serviço passaram. `prisma:status` terminou com erro de schema engine por falta de conexão. Portanto, **a migration v2 não foi aplicada e o seed não foi executado**. `GET /health` e endpoints com banco não foram testados por HTTP.

A migration histórica v2 interrompe a aplicação se encontrar registros sem projeto na tabela então chamada `KnowledgeEntry`. A migration atual renomeia essa tabela para `TechnicalProblem` sem apagar registros. Consulte [modelo-dados-v2.md](modelo-dados-v2.md) antes de aplicar migrations em um banco existente.

## Próximos passos

1. Revisar o schema e a migration com Gustavo.
2. Preparar PostgreSQL 17, configurar `backend/.env`, aplicar migration v2 e executar o seed.
3. Testar as rotas por HTTP com os dados fictícios.
4. Implementar autenticação Google e verificação de permissão no servidor.
5. Conectar uma primeira tela do frontend à API.
6. Planejar as tools MCP separadamente, após a base autenticada.
