# Estado atual do Nexo — 19/09/2026

## O que funciona

- Frontend navegável em `/`, `/login`, `/colaborador`, `/lider` e `/projetos/[id]`.
- Conversa demonstrativa: enviar adiciona uma mensagem na tela, sem persistência.
- Backend NestJS compilado com rotas de leitura de projetos, criação e leitura de check-ins, consulta e registro de conhecimento e pedidos de ajuda.
- Schema Prisma v2 validado. A nova migration está versionada e preserva a migration inicial.
- Seed repetível para um banco de desenvolvimento, com organização, equipe, pessoas, projetos, contexto, conhecimento autorizado/privado e pedido de ajuda.

## Rotas de desenvolvimento

| Rota | Função |
| --- | --- |
| `GET /health` | Confere conexão com PostgreSQL. |
| `GET /projects/:id` | Projeto, equipe, participantes e último check-in. |
| `GET /users/:userId/projects` | Projetos dos quais uma pessoa participa. |
| `GET /teams/:teamId/projects` | Projetos de uma equipe. |
| `GET /projects/:projectId/check-ins` | Até 50 atualizações recentes. |
| `POST /projects/:projectId/check-ins` | Cria atualização após validar campos e vínculo do usuário. |
| `GET /knowledge?q=...` | Busca textual em título, problema, tecnologia e solução; retorna só entradas autorizadas. |
| `GET /knowledge/:id` | Detalhe de uma entrada autorizada. |
| `POST /knowledge` | Cria entrada privada; valida autor e projeto de origem. |
| `PATCH /knowledge/:id/authorize` | Registra autorização declarada pelo autor informado. |
| `GET /projects/:projectId/help-requests` | Até 50 pedidos recentes do projeto. |
| `POST /projects/:projectId/help-requests` | Cria pedido após validar solicitante e ajudante. |
| `PATCH /help-requests/:id/status` | Avança estado até `RESOLVED` e preenche `resolvedAt`. |

Corpos mínimos:

```text
POST /projects/:projectId/check-ins
{"userId":"demo-marina","summary":"Integração avançou.","difficulties":"Erro no retorno.","nextSteps":"Revisar validação."}
```

```text
POST /knowledge
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

Para autorizar uma entrada, envie `{"authorId":"demo-marina"}` em `PATCH /knowledge/:id/authorize`. Isso **não é autenticação**: qualquer cliente pode alegar esse ID. As rotas são para desenvolvimento local e não devem ser expostas publicamente até haver autenticação e autorização no servidor.

## O que ainda é simulado

- O botão “Continuar com Google” apenas navega para o colaborador.
- Pessoas, projetos, conversa, resumo e visão do líder no frontend vêm de dados fictícios em `frontend/data/mock-data.ts`.
- O frontend ainda não chama a API. A URL de API no exemplo de ambiente está reservada para uma conexão posterior.
- Não há IA, busca semântica ou MCP. A conversa não é salva. O banco relacional salvará apenas registros criados pelos endpoints quando estiver disponível.

## Banco e validação desta execução

O computador estava com Node 25.0.0, enquanto o projeto declara Node 24 LTS. O aviso de `engines` foi mantido; a faixa não foi alterada.

Nesta sessão não havia `backend/.env`, serviço PostgreSQL na porta 5432 ou daemon Docker ativo. Para validar schema, gerar cliente e compilar, foi usada uma `DATABASE_URL` fictícia apenas no processo do comando. `prisma:generate`, `prisma:validate` e `build` passaram; quatro testes de serviço passaram. `prisma:status` terminou com erro de schema engine por falta de conexão. Portanto, **a migration v2 não foi aplicada e o seed não foi executado**. `GET /health` e endpoints com banco não foram testados por HTTP.

A migration cria uma organização `Nexo Legacy` para equipes antigas. Se houver `KnowledgeEntry` antiga, ela interrompe a aplicação para que cada entrada seja associada manualmente ao projeto certo. Consulte [modelo-dados-v2.md](modelo-dados-v2.md) antes de aplicar a migration em um banco existente.

## Próximos passos

1. Revisar o schema e a migration com Gustavo.
2. Preparar PostgreSQL 17, configurar `backend/.env`, aplicar migration v2 e executar o seed.
3. Testar as rotas por HTTP com os dados fictícios.
4. Implementar autenticação Google e verificação de permissão no servidor.
5. Conectar uma primeira tela do frontend à API.
6. Planejar as tools MCP separadamente, após a base autenticada.
