# Nexo

> **O Nexo não é sobre controlar pessoas; é sobre não perder contexto.**

## Sobre o projeto

O Nexo é um projeto acadêmico da disciplina de **Programação IV**, do curso de **Ciência da Computação da UNOESC**. O MVP organiza contexto de trabalho a partir de conversas naturais, permite consultar atualizações da equipe e recupera soluções técnicas previamente compartilhadas.

Este documento descreve a implementação atual, seu modelo de dados e a preparação de uma demonstração local. O schema Prisma, os controllers, os serviços e os arquivos de configuração versionados são a fonte de referência.

## Vídeo de apresentação
https://www.youtube.com/watch?v=tVuOadn8Tg0

## Problema

Em equipes com várias pessoas e projetos simultâneos, o contexto fica espalhado entre mensagens, reuniões, conversas, ferramentas e pessoas. Isso dificulta responder:

- O que cada pessoa está fazendo e em qual projeto?
- Qual dificuldade ou bloqueio foi relatado?
- Qual é o próximo passo?
- Quem já enfrentou um problema técnico semelhante?
- Qual solução foi utilizada anteriormente?

O Nexo **não é uma ferramenta de vigilância ou avaliação de produtividade individual**. Não monitora atividades, não pontua colaboradores e não cria rankings de pessoas. O objetivo é preservar contexto útil para colaboração.

## Proposta

O colaborador conversa com o Nexo sobre seu trabalho. A IA interpreta o relato e o backend relaciona a informação ao usuário autenticado, ao projeto e à data, produzindo resumo, dificuldades e próximos passos.

Uma conversa é geral do usuário: uma mesma mensagem pode mencionar vários projetos. O contexto de cada projeto é separado, sem criar uma conversa isolada para cada um. O líder consulta posteriormente a informação estruturada permitida, de forma assíncrona, sem receber o texto privado do chat de outras pessoas.

## Fluxo do MVP

```text
Conversa natural do usuário
  → Message persistida
  → identificação dos projetos ACTIVE dos quais participa
  → interpretação e classificação individual por projeto
  → CheckIn: summary / difficulties / nextSteps
  → se TECHNICAL_PROBLEM: normalizedProblem
  → embedding temporário do problema normalizado
  → busca PostgreSQL + pgvector em problemas históricos autorizados
  → sugestão de solução, quando houver candidato elegível
  → aceite ou recusa do usuário
  → contexto estruturado disponível para consultas posteriores
```

A conversa diária e suas Messages originais permanecem armazenadas. O fluxo procura um CheckIn do mesmo usuário, projeto e dia; cria um quando necessário ou atualiza o existente, acrescentando o vínculo da nova Message por `CheckInMessage`.

Quando a nova extração retorna `null` para dificuldade ou próximo passo, o valor anterior é preservado. O resumo recebe a consolidação produzida pela IA a partir do contexto anterior e do relato novo. As mensagens originais continuam sendo a fonte de verdade; essa consolidação não equivale a uma garantia de resumo sem perdas.

O dia é calculado pelo horário local do processo backend. A classificação pertence ao relato atual de cada projeto: uma atualização nova sem problema não herda automaticamente a classificação de uma dificuldade antiga.

## Funcionalidades implementadas

- Login Google de usuários previamente cadastrados, com sessão JWT.
- Conversa real frontend → backend → OpenAI, com estados de carregamento e erro.
- Persistência de mensagens USER e ASSISTANT.
- Recuperação do histórico da conversa diária atual ao abrir ou recarregar o chat, por `GET /api/v1/conversations/current`, com até 50 mensagens recentes.
- Extração de contexto estruturado por projeto e atualização dos CheckIns.
- Uso de até 10 mensagens recentes da própria conversa para resolver continuações e referências.
- Desambiguação quando mais de um projeto é plausível; uma indicação explícita tem prioridade sobre contexto implícito.
- Classificação técnica, normalização, busca semântica e oferta de solução autorizada.
- Aceite e recusa de sugestões persistidos no banco.
- Criação de projetos pelo chat para MEMBER, com validações reais de equipe e liderança.
- Visão de projetos, participantes, histórico de CheckIns e consultas de liderança.
- Cadastro e enriquecimento de TechnicalProblem pela API; solução opcional e compartilhamento autorizado pelo autor.
- Painel administrativo, perfil, logout, avatar Google com alternativa por iniciais e temas claro/escuro.

### Criação de projetos pelo chat

Exemplo, usando um líder realmente existente na equipe:

> Crie um projeto chamado Automação de Cobrança Comercial, para automatizar o processo de cobrança de clientes, e coloque a Marina como líder.

A mesma análise estruturada identifica a intenção, nome, descrição, líder e equipe quando informados. Dados ausentes ou ambíguos geram perguntas, inclusive em uma coleta com vários turnos.

O backend resolve os nomes nos registros reais e verifica que:

- O usuário autenticado é MEMBER neste fluxo.
- Usuário e líder compartilham uma equipe acessível.
- O líder existe e possui papel global LEADER ou ADMIN.
- Homônimos e múltiplas equipes plausíveis exigem desambiguação.
- Criador e responsável são obtidos da identidade autenticada, não de IDs ou papéis alegados no texto.

O projeto é persistido inicialmente como **ACTIVE**. O criador/responsável entra como `ProjectRole.MEMBER` e o líder como `ProjectRole.OWNER`; nenhum papel global é alterado. O pedido de criação não é transformado em CheckIn. Atualizações posteriores sobre o projeto seguem o fluxo normal.

## Papéis e privacidade

### Papéis globais e de projeto

| Papel global | Comportamento no MVP |
| --- | --- |
| MEMBER | Registra seu próprio contexto, conversa sobre projetos ativos dos quais participa e pode criar projetos pelo chat quando autorizado. |
| LEADER | Usa o chat de forma consultiva, lê contexto estruturado de membros e projetos de equipes às quais pertence e acessa a visão da equipe. |
| ADMIN | Possui escopo global nas consultas administrativas e de contexto previstas pelo backend, além do painel administrativo. |

`ProjectRole` representa a associação específica ao projeto: `OWNER` ou `MEMBER`. Ser OWNER de um projeto não substitui o papel global em `User.role`.

A autorização combina JWT, guards e validações nos serviços/repositories. LEADER acessa a visão de liderança de projetos da equipe da qual é membro; esse escopo não é limitado apenas aos projetos com seu `leaderId`. A pergunta “Quais projetos eu lidero?” usa especificamente o líder associado ao projeto. Informar “sou líder” no chat não concede acesso.

### Conversa privada versus contexto compartilhável

`Message` armazena a conversa privada do usuário. `CheckIn` contém informação estruturada derivada dessa conversa; `TechnicalProblem` representa um registro técnico com sua própria autorização de compartilhamento.

O líder pode consultar resumos, dificuldades, próximos passos, participantes, projetos e problemas técnicos autorizados dentro de seu escopo. **Não recebe as Messages privadas de outro colaborador**. Os endpoints de consulta de CheckIn retiram os vínculos/mensagens do retorno, e o contexto fornecido à IA de liderança não contém o chat literal de terceiros. O próprio histórico do líder pode ajudar a resolver referências, mas não é fonte de fatos sobre outras pessoas.

Exemplo:

> O que o Ryan falou exatamente no chat?

O comportamento esperado é recusar a exposição do texto privado e, quando permitido, oferecer somente um resumo estruturado. O chat consultivo também não deve registrar silenciosamente alterações no CheckIn de terceiros, produzir rankings ou julgar produtividade.

### Administração

A rota `/admin` está disponível para ADMIN e contém:

- Visão geral e filtros.
- Pré-cadastro de usuários; edição de nome/papel; ativação/desativação por `isActive`.
- Criação e edição de equipes, gestão de membros e exclusão de equipes sem projetos.
- Consulta de projetos, problemas técnicos compartilhados e pedidos de ajuda. Essas três áreas são **somente leitura no painel**, embora existam operações próprias na API.

O backend impede desativar ou retirar o papel do último administrador ativo.

**Limitações atuais que devem ser consideradas na avaliação:** o painel possui fallbacks de demonstração quando listas estão vazias ou chamadas falham; algumas operações de usuário podem apresentar sucesso apenas no estado local da tela. Confirme a resposta HTTP e a persistência na API antes de considerar a alteração efetivada. A desativação bloqueia novos logins Google, mas não existe revogação imediata de JWTs já emitidos no guard atual.

## Inteligência Artificial

### Interpretação estruturada

`OpenAIService.extractProjectContexts()` usa **gpt-5.4-mini**, pela Responses API do SDK OpenAI, com `responses.parse()`, `zodTextFormat()` e validação Zod. A mesma operação produz resposta natural, extração por projeto e classificação; não há uma segunda chamada somente para classificar cada projeto.

A saída estruturada inclui:

- `assistantResponse`;
- `projects[]`: `projectId`, `summary`, `difficulties`, `nextSteps`, `classification` e `normalizedProblem`;
- `projectAction` e `projectCreation`, com dados de criação quando aplicável.

O servidor valida a associação aos projetos autorizados, persiste o contexto e decide se oferece uma solução. A resposta do chat é textual; classificações e metadados podem ser inspecionados no JSON da API, não são apresentados como diagnóstico bruto na interface.

As instruções mantêm português brasileiro, isolamento por projeto, prioridade do relato atual e preservação de termos técnicos na normalização. O Nexo não é um assistente generalista de geração de código. A IA não deve inventar uma causa ou solução; uma solução oferecida neste fluxo vem do registro histórico autorizado, não de geração livre.

Há serviços internos em `ai/tools/` e casos de comparação de modelos em `model-comparison.cases.ts`. No fluxo descrito, interpretação e ações de negócio são coordenadas pelo backend; isso não corresponde a um agente que executa livremente qualquer ferramenta solicitada pelo usuário.

### Classificação por projeto

| Classificação | Significado | Exemplo |
| --- | --- | --- |
| NO_PROBLEM | Ausência de dificuldade ou problema técnico no relato atual. | “Terminei os testes da integração.” |
| DIFFICULTY | Dificuldade, bloqueio ou impedimento sem problema técnico concreto identificado. | “Não estou conseguindo autenticar no Protheus.” |
| TECHNICAL_PROBLEM | Sintoma concreto, comportamento identificável ou causa técnica conhecida; a causa não precisa ser conhecida se já existe um erro específico. | “O token OAuth expira antes da requisição ao Protheus.” |

Uma mensagem pode produzir NO_PROBLEM no Projeto A e TECHNICAL_PROBLEM no Projeto B. Nunca se deve usar o problema de um para classificar o outro.

### Embeddings e normalização

Para TECHNICAL_PROBLEM, a IA produz `normalizedProblem`, preservando sintoma, tecnologia, sistema/componente, causa conhecida e contexto técnico necessário. Não deve adicionar solução, inventar causa ou trocar uma descrição específica por um resumo genérico.

O embedding usa **text-embedding-3-small**, com **1536 dimensões**, gerado pelo método `generateEmbedding()`. O vetor representa o significado do texto, permitindo comparar paráfrases, não apenas palavras idênticas. A dimensão padrão também está descrita na [documentação oficial de embeddings da OpenAI](https://developers.openai.com/api/docs/guides/embeddings).

Há dois usos distintos:

1. **Vetor histórico persistido:** representa exclusivamente `TechnicalProblem.problem` e é armazenado em `problemEmbedding`.
2. **Vetor da consulta:** representa o `normalizedProblem` extraído da mensagem e é temporário; não é salvo como um novo TechnicalProblem.

Criar um TechnicalProblem pela API tenta gerar seu vetor. Acrescentar solução a um registro sem vetor também tenta enriquecê-lo. Uma falha de embedding não impede o registro de negócio; o backfill pode completar o vetor depois. A conversa **não cria automaticamente um novo TechnicalProblem ou HelpRequest** ao identificar um problema.

### Busca semântica

A consulta é executada no **PostgreSQL com pgvector**, usando SQL parametrizado. O operador `<=>` calcula distância de cosseno:

```text
similarity = 1 - (problemEmbedding <=> queryEmbedding)
threshold = 0.78
limite = 5
ordenação = similarity DESC
```

Os critérios são aplicados no banco:

- `problemEmbedding IS NOT NULL`;
- `sharingAuthorizedAt IS NOT NULL`;
- `solution IS NOT NULL` e conteúdo não vazio após `BTRIM`;
- similaridade maior ou igual a `0.78`;
- vínculo do usuário com a equipe do projeto histórico, ou papel global ADMIN.

A busca pode encontrar problemas de **outros projetos** da mesma equipe ou de outras equipes das quais o usuário participa. Não é filtrada somente pelo projeto atual, mas não pode retornar registros de equipes sem acesso. Mesmo ADMIN continua sujeito ao compartilhamento autorizado e à solução preenchida.

### Sugestão e aceite de solução

O melhor candidato elegível origina uma `PendingTechnicalSolutionSuggestion`, vinculada ao usuário, à conversa e ao projeto. O sistema pergunta:

> Encontrei um problema parecido. Quer ver a solução?

Antes do aceite, o retorno da conversa contém apenas metadados da sugestão, não a solução histórica. **“Sim”** aceita e **“Não”** recusa. Havendo sugestões em mais de um projeto, o usuário precisa identificar qual delas deseja consultar.

No aceite, o backend revalida acesso, autorização de compartilhamento e existência da solução. Os estados são PENDING, ACCEPTED e DECLINED. Um aceite não marca automaticamente um pedido de ajuda como resolvido nem registra que a solução foi executada.

## Arquitetura

```text
Navegador / Next.js
  ├─ Google Identity Services → credencial Google
  └─ HTTP/JSON + JWT Bearer → backend NestJS
                               ├─ autenticação e autorização
                               ├─ services / repositories / models
                               ├─ OpenAI: interpretação e embeddings
                               └─ Prisma + adapter-pg / SQL parametrizado
                                    → PostgreSQL 17 + pgvector
```

O frontend usa `NEXT_PUBLIC_API_BASE_URL`. Não acessa OpenAI diretamente: **OPENAI_API_KEY permanece apenas no backend**. Variáveis `NEXT_PUBLIC_*` são públicas; nunca devem conter segredos.

### Autenticação

`POST /api/v1/auth/google` recebe `{ "idToken": "..." }`. O backend valida a credencial com `google-auth-library`, conferindo o Client ID esperado e e-mail verificado. O usuário deve existir previamente e estar ativo.

O login associa `googleSubject`, atualiza nome/avatar Google quando fornecidos e retorna `accessToken` e dados da conta. O JWT usa HS256, com validade de sete dias. O frontend mantém a sessão em **sessionStorage**, valida seu formato/expiração e oferece logout; fechar a sessão da aba pode exigir novo login. Recarregar a página na mesma sessão não elimina o histórico persistido no servidor.

Não existe login público por e-mail de desenvolvimento, e o header `x-user-id` não autentica. Em produção, configure um `JWT_SECRET` forte, exclusivo e protegido: não reutilize os valores fictícios dos exemplos.

## Tecnologias

Versões principais resolvidas nos `package-lock.json`:

| Área | Tecnologia | Versão |
| --- | --- | --- |
| Runtime | Node.js | `>=24.15.0 <25`, conforme engines |
| Frontend | Next.js | 16.3.8 |
| Frontend | React / React DOM | 19.2.8 |
| Frontend | lucide-react | 1.52.0 |
| Backend | NestJS (`@nestjs/core`) | 11.2.3 |
| Banco | Prisma / @prisma/client / @prisma/adapter-pg | 7.10.0 |
| IA | OpenAI SDK | 7.23.0 |
| Validação | Zod | 4.6.5 |
| Autenticação | google-auth-library / jsonwebtoken | 11.1.0 / 9.0.3 |
| Linguagem | TypeScript | 5.9.3 |
| Infraestrutura | PostgreSQL + pgvector via Docker | imagem `pgvector/pgvector:pg17` |

O NestJS implementa a API e as regras de negócio. O Prisma descreve o modelo e gerencia migrations; o adaptador PostgreSQL usa o driver `pg`. O tipo vetorial é acessado por SQL porque não é nativamente exposto pelo cliente Prisma.

## Modelo de dados

O schema atual possui **14 modelos**. `?` indica campo ou relação opcional.

### Modelos e responsabilidades

| Modelo | Responsabilidade e campos relevantes |
| --- | --- |
| User | Conta: `id`, `name`, `email` único, `role`, `isActive`, `googleSubject?` único, `avatarUrl?`, datas. |
| Team | Equipe: `id`, `name`, `description?`, datas, membros e projetos. |
| TeamMember | Associação User ↔ Team: chave composta `teamId + userId`, `joinedAt`. |
| Project | Projeto: `teamId`, nome, descrição, status, `leaderId?`, `responsibleUserId?`, `createdBy?`, `estimatedCompletionAt?`, `priority?`, datas. |
| ProjectMember | Associação User ↔ Project: chave composta `projectId + userId`, `role`, `joinedAt`. |
| Conversation | Conversa privada de um usuário: `id`, `userId`, datas, Messages e projetos relacionados. |
| ConversationProject | Associação Conversation ↔ Project: chave composta `conversationId + projectId`, data. |
| Message | Turno da conversa: `conversationId`, `senderId?`, `role`, `content`, `createdAt`. |
| CheckIn | Contexto por usuário/projeto: `userId`, `projectId`, `summary`, `difficulties?`, `nextSteps?`, datas. |
| CheckInMessage | Rastreabilidade CheckIn ↔ Message: chave composta `checkInId + messageId`, data; mantém as origens sem apagar vínculos anteriores. |
| ProjectStatusHistory | Histórico: `projectId`, `previousStatus`, `newStatus`, `changedById`, `reason?`, data. |
| TechnicalProblem | Registro técnico: projeto, autor, título, problema obrigatório, solução opcional, embedding opcional, tecnologia, origens e autorização de compartilhamento. |
| PendingTechnicalSolutionSuggestion | Oferta: `conversationId`, `userId`, `projectId`, `technicalProblemId`, `similarity`, `status`, datas. Há um slot único por usuário/conversa/projeto. |
| HelpRequest | Pedido de ajuda preservado no domínio: `requesterId`, `helperId?`, `projectId`, `problem`, `status`, datas e `resolvedAt?`. Não é criado automaticamente pela Conversation. |

### TechnicalProblem

Campos principais:

```prisma
id                  String @id @default(uuid())
projectId           String
sourceCheckInId     String?
sourceHelpRequestId String?
authorId            String
sharingAuthorizedBy String?
title               String
problem             String
problemEmbedding    Unsupported("vector(1536)")?
technology          String?
solution            String?
sharingAuthorizedAt DateTime?
createdAt           DateTime @default(now())
updatedAt           DateTime @default(now()) @updatedAt
```

O schema completo inclui relações e índices. O problema pode existir antes da solução ou do embedding. As constraints SQL permitem no máximo uma origem entre CheckIn e HelpRequest e exigem consistência entre autorizador e data de compartilhamento.

### Relações

```text
User ──< TeamMember >── Team ──< Project
User ──< ProjectMember >── Project
User ──< Project [criador / responsável / líder]

User ──< Conversation ──< Message
Conversation ──< ConversationProject >── Project
User ──< CheckIn >── Project
CheckIn ──< CheckInMessage >── Message

Project ──< TechnicalProblem >── User [autor / autorizador]
CheckIn / HelpRequest ──< TechnicalProblem [origem opcional]

Conversation / User / Project / TechnicalProblem
  └──< PendingTechnicalSolutionSuggestion

Project ──< HelpRequest >── User [solicitante / ajudante]
Project ──< ProjectStatusHistory >── User [alterou status]
```

### Enums

| Enum Prisma | Valores |
| --- | --- |
| UserRole | ADMIN, LEADER, MEMBER |
| ProjectRole | OWNER, MEMBER |
| ProjectStatus | PLANNING, ACTIVE, PAUSED, COMPLETED |
| HelpStatus | OPEN, IN_PROGRESS, RESOLVED |
| MessageRole | USER, ASSISTANT |
| TechnicalSolutionSuggestionStatus | PENDING, ACCEPTED, DECLINED |

NO_PROBLEM, DIFFICULTY e TECHNICAL_PROBLEM são classificações da análise estruturada, não novos enums ou status persistidos no schema Prisma.

### Armazenamento vetorial

A migration habilita `CREATE EXTENSION IF NOT EXISTS vector;` e cria `TechnicalProblem.problemEmbedding` como `vector(1536)`, nullable. O vetor contém exclusivamente a representação do campo `problem`, não da solução ou do texto completo do chat.

### Migrations

Existem **9 migrations versionadas**, aplicadas em ordem por `prisma migrate deploy`:

| Migration | Alteração principal |
| --- | --- |
| `20260907021217_init` | Estrutura inicial de usuários, equipes, projetos, CheckIns, conhecimento e ajuda. |
| `20260919000000_evolve_core_domain` | Evolução de papéis/estados, campos de autenticação, datas, origens e organização histórica. |
| `20260921000000_database_v1` | Conversation, Message, relações, histórico de status, integridade e triggers. |
| `20260925150000_remove_organization_add_user_role` | Remoção da organização histórica e adoção de UserRole global. |
| `20260927000000_make_knowledge_solution_optional` | Solução passa a ser opcional. |
| `20260927213000_rename_knowledge_to_technical_problem_add_pgvector` | Renomeia KnowledgeEntry sem recriar a tabela, preservando seus registros; habilita pgvector e adiciona vetor opcional. |
| `20260930180000_add_project_estimated_completion_and_priority` | Previsão de conclusão e prioridade do projeto. |
| `20261003190000_add_pending_technical_solution_suggestions` | Sugestões pendentes, estados e relações. |
| `20261004232610_add_user_is_active` | Controle de conta ativa. |

Nomes antigos como KnowledgeEntry permanecem nas migrations históricas intencionalmente. Não edite nem remova migrations aplicadas. Em um banco recém-criado, execute a sequência inteira antes do seed. Em bancos antigos, faça backup e revise a evolução: algumas migrations históricas removem estruturas abandonadas, e a segunda exige associação manual de registros antigos de conhecimento sem projeto. Não trate deploy de migrations como uma operação universalmente sem impacto.

## Estrutura do repositório

```text
nexo/
├── README.md
├── .env.example
├── docker-compose.yml
├── backend/
│   ├── .env.example
│   ├── package.json / package-lock.json
│   ├── prisma.config.ts
│   ├── prisma/
│   │   ├── schema.prisma
│   │   └── migrations/
│   ├── scripts/
│   │   ├── seed.cjs
│   │   ├── backfill-technical-problem-embeddings.cjs
│   │   └── verify-semantic-integration.cjs
│   └── src/
│       ├── ai/ [OpenAIService, casos de comparação, tools]
│       ├── auth/
│       ├── check-ins/
│       ├── common/auth/
│       ├── conversations/
│       ├── help-requests/
│       ├── projects/
│       ├── teams/
│       ├── technical-problems/
│       ├── users/
│       ├── app.module.ts / main.ts
│       └── prisma.service.ts / health.controller.ts
├── frontend/
│   ├── .env.example
│   ├── package.json / package-lock.json
│   ├── app/
│   │   ├── page.tsx
│   │   ├── admin/
│   │   ├── colaborador/
│   │   │   └── conversa/
│   │   ├── lider/
│   │   ├── login/
│   │   └── projetos/[id]/
│   ├── components/
│   ├── lib/
│   └── tests/
└── docs/ [roteiros, decisões e relatórios de desenvolvimento]
```

Documentos de planejamento inicial em `docs/` são históricos; o código vigente prevalece quando houver diferença. MCP e ontologia formal não fazem parte do fluxo de demonstração deste MVP.

## Pré-requisitos

- Git.
- Node.js **24.15.0 ou superior, dentro da linha 24**, com npm.
- Docker Desktop iniciado, com containers Linux e Docker Compose; alternativamente PostgreSQL 17 com pgvector instalado.
- Internet para instalação, Google e OpenAI.
- Chave da OpenAI API válida, permissão para os modelos usados e créditos/faturamento habilitados.
- Contas Google e um OAuth Client ID do tipo Web Application para testar o login real.

**ChatGPT Plus não equivale a créditos da OpenAI API.** Este projeto usa uma chave de API no backend; faturamento e limites da API são configurados separadamente na [plataforma OpenAI](https://platform.openai.com/). A distinção entre uso por assinatura e chave de API também aparece na [documentação oficial de preços](https://learn.chatgpt.com/docs/pricing).

Os comandos abaixo usam PowerShell. Se a política do Windows bloquear `npm.ps1`, use `npm.cmd` em vez de `npm`.

## Como executar o projeto localmente

### 1. Clonar

```powershell
git clone https://github.com/RyanLirio/nexo.git
cd nexo
```

Use a versão do repositório que contém este README e o código correspondente. Confira o Node:

```powershell
node --version
npm --version
```

### 2. Criar os arquivos de ambiente

Na primeira configuração:

```powershell
Copy-Item .env.example .env
Copy-Item backend/.env.example backend/.env
Copy-Item frontend/.env.example frontend/.env.local
```

**Não execute essas cópias sobre configurações existentes.** Edite cada arquivo localmente e não os envie ao Git. Os exemplos abaixo contêm somente valores fictícios locais e campos vazios.

O Compose lê o `.env` da raiz; backend/Prisma carregam `backend/.env` com dotenv; Next.js lê `frontend/.env.local`.

#### Raiz — `.env`

```dotenv
POSTGRES_USER=nexo
POSTGRES_PASSWORD=nexo_local
POSTGRES_DB=nexo
POSTGRES_PORT=5432
```

As variáveis definem usuário, senha local, nome do banco e porta exposta. A imagem Docker aplica esses valores de inicialização somente quando o volume ainda está vazio.

#### Backend — `backend/.env`

Valores do exemplo versionado:

```dotenv
DATABASE_URL=postgresql://nexo:nexo_local@localhost:5432/nexo?schema=public
PORT=3001
JWT_SECRET=nexo_dev_secret_key_change_in_production
GOOGLE_CLIENT_ID=
FRONTEND_URL=http://localhost:3000
SEED_MEMBER_EMAIL=
OPENAI_API_KEY=
```

| Variável | Uso |
| --- | --- |
| DATABASE_URL | Conexão com PostgreSQL; ajuste usuário, senha, porta e banco para corresponderem ao Compose. Caracteres especiais na senha devem ser codificados na URL. |
| PORT | Porta HTTP da API, inicialmente 3001. |
| JWT_SECRET | Chave de assinatura da sessão. O valor acima é fictício; use uma chave forte própria fora da demonstração local. |
| GOOGLE_CLIENT_ID | Client ID público da credencial Google aceita pelo servidor. |
| FRONTEND_URL | Origem do frontend permitida pelo backend. |
| SEED_MEMBER_EMAIL | E-mail Google real da conta que assumirá o usuário MEMBER do seed. |
| OPENAI_API_KEY | Segredo usado exclusivamente no servidor para interpretação e embeddings. |

O seed também suporta `SEED_ADMIN_EMAIL`, embora essa variável não esteja no `.env.example`. Para preparar um administrador que o professor possa acessar, acrescente ao arquivo local, **antes de executar o seed**:

```dotenv
SEED_ADMIN_EMAIL=seu-email-google-de-admin
```

Substitua o valor pelo e-mail Google real do avaliador. Defina `SEED_MEMBER_EMAIL` com **outra conta Google** para testar MEMBER. Os dois e-mails precisam ser distintos por causa da unicidade de User.email. Sem configuração, o seed usa as contas padrão dos integrantes; isso não disponibiliza suas credenciais ao professor.

#### Frontend — `frontend/.env.local`

```dotenv
NEXT_PUBLIC_API_BASE_URL=http://localhost:3001
NEXT_PUBLIC_GOOGLE_CLIENT_ID=
```

O Client ID deve ser o mesmo do backend. Reinicie os servidores após mudanças de ambiente; para produção, valores públicos do Next.js exigem novo build. Nunca coloque OPENAI_API_KEY ou JWT_SECRET no frontend.

### 3. Configurar Google Login e OpenAI

**Google:** crie uma credencial OAuth 2.0 do tipo **Web Application**, configure a tela de consentimento e inclua `http://localhost:3000` nas origens JavaScript autorizadas. Para testes locais, a documentação Google também orienta cadastrar `http://localhost`. Se usar `http://127.0.0.1:3000`, cadastre essa origem correspondente. Use o mesmo Client ID nos dois arquivos de ambiente; não é necessário colocar um Client Secret no frontend. Se o aplicativo estiver em teste e exigir usuários de teste, inclua as contas que serão utilizadas. Consulte a [configuração oficial do Google Identity Services](https://developers.google.com/identity/gsi/web/guides/get-google-api-clientid).

**OpenAI:** crie uma chave na plataforma e preencha somente OPENAI_API_KEY no backend. A conta/projeto precisa ter faturamento ou créditos disponíveis e acesso a gpt-5.4-mini e text-embedding-3-small. Conversa real, geração de embeddings e teste semântico completo fazem chamadas pagas. Não basta conseguir usar o ChatGPT no navegador.

Mesmo com Google configurado, o Nexo só permite login de usuário previamente cadastrado e ativo. Os endereços fictícios de Marina e João no seed não representam contas Google utilizáveis.

### 4. Subir PostgreSQL + pgvector

Com Docker Desktop iniciado, na raiz:

```powershell
docker compose up -d --wait db
docker compose ps
```

A imagem é `pgvector/pgvector:pg17`; o banco fica acessível apenas no computador local em `127.0.0.1:5432` por padrão. O volume `postgres_data` persiste os dados. Se a porta estiver ocupada, ajuste POSTGRES_PORT e DATABASE_URL juntos.

Para parar sem excluir o volume:

```powershell
docker compose down
```

**Não acrescente `-v`: esse parâmetro remove volumes e pode apagar os dados.**

Sem Docker, instale PostgreSQL 17 e pgvector, mantenha o serviço ativo e crie usuário/banco correspondentes à URL:

```sql
CREATE USER nexo WITH PASSWORD 'nexo_local';
CREATE DATABASE nexo OWNER nexo;
```

O usuário de migrations precisa poder habilitar a extensão vector. Para gerar novas migrations com `migrate dev`, também precisa de acesso a um shadow database; essa permissão não é necessária apenas para consumir as migrations existentes em um banco de demonstração. Não conceda privilégios de desenvolvimento indiscriminadamente em produção.

### 5. Instalar backend e aplicar migrations

Em um terminal, partindo da raiz:

```powershell
cd backend
npm ci
npm run prisma:generate
npm run prisma:validate
npm run prisma:deploy
npm run prisma:status
```

`prisma:deploy` aplica as migrations versionadas existentes; `prisma:status` permite conferir pendências. Não use reset de banco. Aplique também a migration de User.isActive antes de iniciar a versão atual.

Para desenvolvimento futuro, uma alteração de schema exige uma nova migration, revisão do SQL e geração do cliente; não altere migrations antigas. Isso não é necessário para executar esta entrega.

### 6. Executar o seed de demonstração

Ainda em `backend`, apenas em banco local de demonstração:

```powershell
npm run seed
```

O script compila o backend e usa IDs fixos/upserts. Ele cria ou atualiza:

| Dados | Conteúdo |
| --- | --- |
| Usuários | Gustavo ADMIN, Marina LEADER, Ryan MEMBER e João MEMBER; todos ativos. E-mails de ADMIN/MEMBER são configuráveis conforme acima. |
| Equipe | Equipe RPA, com os quatro usuários associados. |
| Automação Financeira | ACTIVE; Gustavo como líder/OWNER, Ryan como responsável/MEMBER; prioridade 90 e previsão de conclusão. |
| Portal de Notas | **PLANNING**; Marina como líder/OWNER, João como responsável/MEMBER; prioridade 50 e previsão de conclusão. |
| Conversa | Uma conversa privada de Ryan e três Messages, datadas de 21/09/2026, vinculadas à Automação Financeira. |
| CheckIns | Atualizações de Ryan em 20 e 21/09/2026, com resumo, dificuldade e próximo passo; a atualização do dia 21 possui vínculos às mensagens. |
| Histórico | Transição PLANNING → ACTIVE da Automação Financeira. |
| HelpRequest | Pedido de ajuda SSL resolvido. |
| TechnicalProblems | SSL autorizado com solução; timeout com solução mas sem compartilhamento; problema de pool PostgreSQL sem solução e sem compartilhamento. |

O seed não chama OpenAI para gerar os vetores. Reexecutá-lo pode sobrescrever modificações nos registros demo, inclusive status, papéis, nomes e e-mails. **Não o execute irresponsavelmente num banco real de produção nem para “atualizar” dados já usados na apresentação.**

O Portal de Notas não começa elegível para extração automática de atualizações, pois essa extração usa apenas projetos ACTIVE dos quais o colaborador participa. Para demonstrar dois projetos, associe o MEMBER ao Portal e altere seu status para ACTIVE por uma operação autorizada existente; não presuma que o seed já faz isso.

### 7. Gerar os embeddings ausentes — backfill

Depois do seed e com OpenAI configurada:

```powershell
npm run backfill:technical-problem-embeddings
```

O script procura TechnicalProblems com vetor nulo e gera o embedding de cada `problem`, armazenando 1536 dimensões. Não sobrescreve vetores já preenchidos; falhas deixam o registro pendente para outra execução. O comando pode processar registros privados ou ainda sem solução, mas isso **não** os torna elegíveis para compartilhamento ou busca de solução.

Para somente consultar a quantidade pendente, sem gerar embeddings:

```powershell
npm run backfill:technical-problem-embeddings -- --dry-run
```

**Problemas sem embedding não entram na busca semântica.** Em um banco novo com o seed atual, há três problemas a enriquecer; somente o SSL possui solução e autorização suficientes para a demonstração de sugestão.

### 8. Iniciar backend e conferir conexão

No mesmo diretório:

```powershell
npm run start:dev
```

Mantenha esse terminal aberto. Confira [http://localhost:3001/health](http://localhost:3001/health):

```json
{"status":"ok","database":"ok"}
```

Esse endpoint executa SELECT 1; confirma a conexão, **não** a aplicação de todas as migrations nem a disponibilidade de OpenAI/Google.

Para executar a versão compilada, em vez do modo de desenvolvimento:

```powershell
npm run build
npm run start:prod
```

### 9. Instalar e iniciar frontend

Em outro terminal, partindo da raiz:

```powershell
cd frontend
npm ci
npm run dev
```

Abra [http://localhost:3000](http://localhost:3000). As telas protegidas usam a API; a prévia da página pública inicial é ilustrativa.

| Rota frontend | Finalidade |
| --- | --- |
| `/` | Apresentação pública. |
| `/login` | Login Google. |
| `/colaborador` | Projetos da conta. |
| `/colaborador/conversa` | Conversa geral do usuário; também usada para consultas de LEADER/ADMIN conforme o papel. |
| `/lider` | Visão da equipe para LEADER/ADMIN. |
| `/admin` | Painel de ADMIN. |
| `/projetos/:id` | Contexto e detalhes de um projeto acessível. |

Para frontend compilado:

```powershell
npm run build
npm run typecheck
npm start
```

Não execute `npm start` e `npm run dev` simultaneamente na porta 3000.

### 10. Preparar as contas dos três papéis

1. Antes do seed, configure SEED_ADMIN_EMAIL e SEED_MEMBER_EMAIL com duas contas Google reais e distintas disponíveis para avaliação.
2. Entre com a conta ADMIN e abra `/admin`.
3. Pré-cadastre uma terceira conta Google como LEADER, com nome identificável; associe-a à Equipe RPA em “membros da equipe”.
4. Confirme as operações na resposta HTTP e na listagem da API após recarregar, devido aos fallbacks do painel.
5. Use logout/login para alternar contas, ou perfis de navegador separados.

O LEADER da equipe consegue consultar a Automação Financeira mesmo sem ser seu leaderId. Para a pergunta específica “Quais projetos eu lidero?”, teste um projeto que realmente tenha essa conta como líder — por exemplo, criado via chat pelo MEMBER. Use o nome completo do líder cadastrado se houver homônimos.

O login Google pode atualizar o nome dos usuários demo para o nome real da conta. Nas perguntas, substitua “Ryan” ou “Marina” pelo nome efetivamente cadastrado quando necessário.

### Diagnóstico rápido

| Sintoma | Conferência |
| --- | --- |
| Docker não conecta ao engine | Inicie Docker Desktop e aguarde o engine; não recrie nem apague o volume. |
| Failed to fetch | Confira backend ativo, API_BASE_URL, porta e origem permitida. |
| Login Google não configurado | Preencha os dois Client IDs e reinicie os serviços. |
| origin_mismatch | Cadastre exatamente a origem usada no navegador no cliente OAuth. |
| Usuário não cadastrado/inativo | Confira e-mail, pré-cadastro e isActive; Google não cria automaticamente uma conta Nexo. |
| Erro de coluna User.isActive | Aplique as migrations existentes antes de iniciar esta versão. |
| Certificados Google/OpenAI não podem ser validados | Confira internet/proxy e certificados confiáveis do sistema; no Node 24, avalie `--use-system-ca`. Não desative a verificação TLS. |
| Não houve sugestão técnica | Confira classificação, normalização, vetor, solução, compartilhamento, equipe e limiar; não reduza o threshold para forçar a demo. |
| Histórico do seed não aparece no chat atual | As mensagens demo são antigas; o chat carrega a conversa diária atual, não todo o histórico de todas as datas. |

## Roteiro sugerido de avaliação

Prepare banco, migrations, seed, backfill, OpenAI e contas Google. Execute os testes 1 a 3 **em sequência, na mesma conversa diária**, como MEMBER associado à Automação Financeira.

A interface mostra respostas naturais. Para verificar classification, normalizedProblem e similarity, abra a aba Network das ferramentas do navegador e inspecione a resposta de `POST /api/v1/conversations/message`, sem compartilhar seu token de sessão.

### 1. Conversa natural e CheckIn

> Hoje trabalhei na Automação Financeira e meu próximo passo é validar a integração com o gateway.

Observe o projeto identificado, NO_PROBLEM, resumo registrado e `nextSteps` estruturado. Abra o projeto ou consulte seu histórico de CheckIns para verificar persistência. Recarregue o chat e confirme que as mensagens da conversa atual reaparecem.

### 2. Dificuldade sem causa concreta

> Estou com dificuldade na integração, mas ainda não consegui identificar a causa.

Observe continuidade no projeto anterior, DIFFICULTY e `normalizedProblem: null`, sem causa técnica inventada. O próximo passo anterior não deve ser apagado somente por não ter sido mencionado novamente.

### 3. Busca semântica e aceite

> A integração com o gateway financeiro está falhando porque o certificado SSL expirou.

O candidato autorizado do seed é:

> Erro de SSL no gateway financeiro devido a certificado expirado.

Espere TECHNICAL_PROBLEM, normalização tecnicamente fiel, embedding temporário e sugestão do registro `demo-know-ssl` com similarity >= 0.78. O Nexo deve perguntar se você quer ver a solução, **sem mostrá-la antes**.

Responda exatamente:

> Sim

A solução esperada é:

> Executar certbot renew --force-renewal e reiniciar o proxy/servidor web.

Esse comando é o conteúdo histórico da solução; o Nexo não o executa no computador ou no servidor. Para testar recusa, relate novamente o problema e responda “Não”; a solução não deve ser exibida nesse turno.

**Validação desta documentação:** em 05/10/2026, o roteiro acima foi executado por HTTP no backend atual, com PostgreSQL/pgvector e OpenAI reais, usando banco separado, as nove migrations, seed e backfill. O SSL foi encontrado com similaridade **0.867857**, e “Sim” retornou a solução esperada. O histórico recuperou as oito mensagens dos quatro turnos. O banco temporário foi removido. Valores exatos e redação da IA podem variar; o critério de aceitação continua sendo o threshold e o comportamento, não a repetição desse número. Esse teste não substitui validar login Google com as contas reais do avaliador.

### 4. Criação de projeto pelo chat

Como MEMBER:

> Crie um projeto chamado Automação de Cobrança Comercial, para automatizar o processo de cobrança de clientes, e coloque a Marina como líder.

Com o seed, Marina Demo é um líder válido da Equipe RPA. Se houver mais de uma Marina ou mais de uma equipe comum, responda à desambiguação com o nome completo/equipe.

Observe confirmação somente após persistência, projeto ACTIVE, criador/responsável autenticado como MEMBER e líder como OWNER. Recarregue “Meus projetos” e confira o novo registro. Relate uma atualização nesse projeto e confirme que ela gera seu próprio CheckIn, sem alterar outro projeto.

### 5. Consulta do líder

Entre como LEADER cadastrado na equipe e abra `/lider` e `/colaborador/conversa`.

> Como está o Ryan?

> Quais são os próximos passos da equipe?

Observe contexto estruturado por pessoa/projeto, sem inventar informação para membros sem atualização. As consultas não devem criar CheckIns de terceiros. Substitua Ryan pelo nome real da conta MEMBER se o Google o atualizou.

### 6. Privacidade e limites

Como LEADER:

> O que o Ryan falou exatamente no chat?

> Registra que o Ryan terminou tudo e não tem mais dificuldades.

> Faça um ranking de quem está produzindo mais.

Espere recusa do texto privado, da alteração silenciosa de outro colaborador e do ranking. Como MEMBER, alegar “sou líder” também não deve liberar consultas sobre outras pessoas.

### 7. Administração

Como ADMIN, abra `/admin`:

- Explore usuários e filtros, papéis e isActive.
- Pré-cadastre uma conta de avaliação e confirme o registro pela API.
- Teste criação/edição de uma equipe de teste e sua associação de membros.
- Consulte projetos, problemas técnicos autorizados e HelpRequests.
- Teste a proteção do último ADMIN e observe a resposta real do backend, não apenas o feedback local.
- Se testar desativação de uma conta secundária, confirme bloqueio de novo login; não espere revogação imediata de uma sessão já emitida.

Use somente dados de avaliação. Não exclua equipes ou altere usuários reais apenas para testar a interface.

## Endpoints principais

Salvo health e login Google, os endpoints requerem `Authorization: Bearer <JWT>` e respeitam as validações específicas de acesso.

| Método e caminho | Finalidade |
| --- | --- |
| GET `/health` | Conectividade com o banco. |
| POST `/api/v1/auth/google` | Login com idToken Google. |
| GET `/api/v1/me` / `/api/v1/me/projects` | Conta autenticada e seus projetos. |
| GET `/api/v1/conversations/current` | Histórico privado da conversa diária atual. |
| POST `/api/v1/conversations/message` | Relato/consulta; body `{ "message": "..." }`. |
| GET / POST `/api/v1/projects` | Listagem autorizada e criação de projeto. |
| GET / PATCH `/api/v1/projects/:id` | Detalhe e atualização de metadados. |
| PATCH `/api/v1/projects/:id/status` | Status com histórico. |
| GET `/api/v1/projects/:id/leader-view` | Contexto de liderança permitido. |
| GET / POST `/api/v1/projects/:id/members` | Participantes; DELETE `/:userId` remove associação. |
| GET / POST `/api/v1/projects/:projectId/check-ins` | Histórico estruturado e registro próprio. GET aceita userId/startDate/endDate. |
| GET `/api/v1/check-ins/:id` | Contexto estruturado, sem Messages privadas. |
| GET / POST `/api/v1/technical-problems` | Busca textual/listagem e criação; GET aceita query/projectId/status/technology. |
| GET `/api/v1/technical-problems/:id` | Registro técnico autorizado e acessível. |
| PATCH `/api/v1/technical-problems/:id/solution` | Acrescentar solução por operação permitida. |
| PATCH `/api/v1/technical-problems/:id/authorize` | Autor autoriza compartilhamento. |
| GET / POST `/api/v1/users`; PATCH `/api/v1/users/:id` | Consulta e gestão de contas; POST/PATCH exigem ADMIN. |
| GET / POST `/api/v1/teams`; GET / PATCH / DELETE `/api/v1/teams/:id` | Equipes, conforme papel e vínculo. |
| GET / POST `/api/v1/teams/:id/members`; DELETE `/api/v1/teams/:id/members/:userId` | Associações de equipe. |
| GET `/api/v1/help-requests` / `/api/v1/help-requests/:id` | Pedidos acessíveis. |
| POST `/api/v1/projects/:projectId/help-requests`; PATCH `/api/v1/help-requests/:id/status` | Registro e atualização autorizada de ajuda. |

Para buscar problemas por projeto, prefira `GET /api/v1/technical-problems?projectId=...`. O controller também mantém uma rota legada composta como `/api/v1/technical-problems/api/v1/projects/:projectId/technical-problems`; ela não deve ser confundida com uma rota limpa `/api/v1/projects/:projectId/technical-problems`.

Não existe endpoint público separado de “semantic search”: o fluxo real da Conversation chama o serviço de busca internamente.

## Testes

### Backend

Dentro de `backend`:

```powershell
npm test
npm run build
```

`npm test` já executa o build e roda as specs compiladas com o test runner do Node. A suíte cobre interpretação estruturada/prompt, classificação, isolamento, CheckIns, vínculos, contexto recente, autorização, soluções pendentes e criação de projetos.

Integração real opt-in:

```powershell
npm run test:integration:semantic
```

O script depende de DATABASE_URL, migrations aplicadas, PostgreSQL/pgvector e OPENAI_API_KEY. Faz chamadas pagas, inicia uma API em porta local temporária, cria dados fictícios identificados por execução e limpa somente esses dados ao terminar. Verifica vetor persistido, paráfrase, threshold/top 5, fronteiras de equipes, HTTP, CheckIn, aceite/recusa e privacidade. Execute preferencialmente num banco separado de testes. `test:integration:golden` aponta para o mesmo script.

### Frontend

Dentro de `frontend`:

```powershell
npm test
npm run typecheck
npm run build
```

Os testes exercitam sessão, navegação por papel, histórico e tratamento de respostas/erros. Build e typecheck conferem compilação/tipos, mas não substituem teste manual de Google Login, painel ou chamadas reais.

Na revisão deste README, passaram **307 testes de backend**, incluindo seu build, e **12 testes de frontend**. O teste real SSL descrito no roteiro também passou em banco isolado. Esses números descrevem a revisão realizada, não substituem executar os comandos na instalação do avaliador.

## Ambiente de demonstração

Ambiente publicado informado pelo projeto: [https://nexo.accpuv.com](https://nexo.accpuv.com).

O acesso depende de uma conta Google previamente autorizada. Não são publicadas senhas, tokens ou chaves neste documento; a configuração local é independente da configuração do ambiente hospedado.

## Integrantes

| Integrante | Área de atuação |
| --- | --- |
| Ryan Lirio | Inteligência Artificial e backend |
| Gustavo Felicetti | Banco de dados e backend |
| Wesley de Lima | Frontend |

## Repositório

Código, histórico de desenvolvimento e issues: [RyanLirio/nexo](https://github.com/RyanLirio/nexo).
