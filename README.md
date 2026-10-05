# Nexo

Projeto acadêmico de Programação IV do curso de Ciência da Computação da UNOESC. O MVP integra conversa persistida, CheckIns estruturados, recuperação de soluções técnicas autorizadas e consulta do contexto da equipe.

## Problema e proposta

Em equipes remotas, poucos líderes podem acompanhar muitas pessoas que participam de vários projetos. Isso dificulta perceber bloqueios, oferecer apoio e encontrar quem já resolveu um problema parecido.

O Nexo propõe usar conversas sobre o dia de trabalho para organizar atualizações, registrar soluções técnicas autorizadas e conectar colegas que precisam de ajuda. A proposta é apoiar a colaboração, sem monitorar atividades ou avaliar produtividade individual.

O fluxo implementado é: conversa geral → separação por projeto ativo → CheckIn estruturado → classificação técnica → busca semântica → oferta de solução → aceite/recusa. O líder consulta as atualizações por membro e projeto. `HelpRequest` continua existindo, mas não é criado automaticamente por esse fluxo.

## Integrantes

- Ryan Lirio — Inteligência Artificial e backend.
- Gustavo Felicetti — Banco de dados e backend.
- Wesley de Lima — Frontend.

## Tecnologias

- **Next.js 16 + React 19 + TypeScript:** frontend, responsável pelas páginas que as pessoas acessam.
- **NestJS 11 + TypeScript:** API, regras de negócio e autorização por equipe/papel.
- **PostgreSQL 17 + pgvector:** persistência e busca por similaridade de problemas técnicos; embeddings opcionais de 1536 dimensões.
- **OpenAI + Zod:** extração estruturada com `gpt-5.4-mini` e embeddings de `problem` com `text-embedding-3-small`.
- **Prisma 7:** descreve o modelo do banco, gera um cliente TypeScript e gerencia migrations. O adaptador `@prisma/adapter-pg` usa o driver `pg` para conectar ao PostgreSQL.
- **Git e GitHub:** histórico do projeto, hospedagem do repositório e acompanhamento das issues.

As versões exatas das dependências ficam nos arquivos `package-lock.json`. O login usa Google Identity Services e JWT; não há biblioteca de componentes de UI.

## Estrutura

```text
nexo/
├── README.md
├── .gitignore
├── .env.example
├── docker-compose.yml
├── backend/
│   ├── .env.example
│   ├── package.json
│   ├── prisma.config.ts
│   ├── prisma/
│   │   ├── schema.prisma
│   │   └── migrations/
│   ├── scripts/seed.cjs
│   └── src/
│       ├── main.ts
│       ├── app.module.ts
│       ├── health.controller.ts
│       ├── prisma.service.ts
│       ├── projects/
│       ├── check-ins/
│       ├── technical-problems/
│       └── help-requests/
├── frontend/
│   ├── .env.example
│   ├── package.json
│   ├── data/mock-data.ts
│   └── app/
│       ├── layout.tsx
│       ├── page.tsx
│       ├── login/
│       ├── colaborador/
│       ├── lider/
│       └── projetos/
└── docs/
    ├── backlog.md
    ├── verificacao.md
    ├── modelo-dados-v2.md
    ├── ux-research.md
    ├── ux-audit.md
    └── estado-atual.md
```

## Pré-requisitos

- Node.js **24 LTS, versão 24.15 ou superior dentro da linha 24**, com npm.
- Git.
- Docker Desktop com containers Linux, ou PostgreSQL 17 com pgvector instalado localmente.

Os comandos abaixo partem da pasta `nexo` e usam PowerShell. No Windows, se a política de execução bloquear `npm.ps1`, use `npm.cmd` no lugar de `npm`.

## Variáveis de ambiente

```powershell
Copy-Item .env.example .env
Copy-Item backend/.env.example backend/.env
Copy-Item frontend/.env.example frontend/.env.local
```

Faça essas cópias apenas na primeira configuração para não sobrescrever ajustes existentes. Os exemplos têm valores fictícios para desenvolvimento local.

O Compose lê o `.env` da raiz. O backend e o Prisma carregam `backend/.env` com `dotenv`, por isso seus comandos devem ser executados dentro de `backend`. O Next.js lê `frontend/.env.local`.

`DATABASE_URL` informa usuário, senha, endereço, porta e nome do banco. Se alterar os valores da raiz, ajuste essa URL também. Caracteres especiais em usuário ou senha precisam ser codificados na URL. `PORT` define a porta do backend, inicialmente 3001.

`NEXT_PUBLIC_API_BASE_URL` conecta o frontend à API real. Variáveis com `NEXT_PUBLIC_` podem aparecer no navegador: nunca coloque segredos nelas. Configure `OPENAI_API_KEY` apenas no backend. Reinicie os servidores após mudar configurações; valores públicos do Next.js também exigem nova compilação para produção.

Para o login Google, crie uma credencial OAuth 2.0 do tipo **Aplicativo da Web** no Google Cloud, adicione `http://localhost:3000` às origens JavaScript autorizadas e use o mesmo identificador em `GOOGLE_CLIENT_ID` (backend) e `NEXT_PUBLIC_GOOGLE_CLIENT_ID` (frontend). O identificador do cliente é público; não coloque o segredo OAuth no frontend. Defina `SEED_MEMBER_EMAIL` com o e-mail Google que poderá entrar e execute o seed novamente. O Nexo mantém a política de permitir somente usuários previamente cadastrados.

Arquivos `.env` reais ficam fora do Git. Apenas os exemplos são versionados.

## Iniciar o banco com Docker

Com o Docker Desktop aberto, na raiz:

```powershell
docker compose up -d --wait db
docker compose ps
```

O banco é exposto somente no computador local, na porta 5432. Se ela estiver ocupada, altere `POSTGRES_PORT` e a porta em `backend/.env`.

Para parar sem apagar os dados:

```powershell
docker compose down
```

O volume mantém os dados entre execuções. As variáveis de criação de usuário e banco só são aplicadas quando o volume está vazio.

### Alternativa sem Docker

Instale o PostgreSQL 17, a extensão pgvector e as ferramentas de linha de comando, mantendo o serviço ativo. A migration executa `CREATE EXTENSION IF NOT EXISTS vector`, portanto o arquivo da extensão deve estar disponível no servidor e o usuário da migration precisa poder habilitá-la. Entre no `psql` com um usuário administrador e crie um usuário e banco locais:

```sql
CREATE USER nexo WITH PASSWORD 'nexo_local';
CREATE DATABASE nexo OWNER nexo;
```

Use a URL do exemplo, ajustando a porta se necessário. Para aplicar migrations existentes basta esse usuário. Para gerar novas migrations com `migrate dev`, ele também precisa criar o banco temporário de comparação (*shadow database*). Apenas no ambiente de desenvolvimento:

```sql
ALTER USER nexo CREATEDB;
```

## Preparar o backend e aplicar migrations

Em um terminal, partindo da raiz:

```powershell
cd backend
npm ci
npm run prisma:generate
npm run prisma:validate
npm run prisma:deploy
npm run prisma:status
```

Uma **migration** é um arquivo SQL versionado que registra uma alteração na estrutura do banco. `prisma:deploy` aplica os arquivos existentes, sem apagar os dados. O Prisma registra as aplicações na tabela `_prisma_migrations`.

Quando o grupo alterar `prisma/schema.prisma`, gere e aplique uma nova migration em desenvolvimento:

```powershell
npm run prisma:migrate -- --name descricao_da_alteracao
npm run prisma:generate
```

Revise o SQL gerado antes de compartilhar e versione a pasta da migration. Não edite uma migration que já foi aplicada por outras pessoas.

## Executar o backend

Dentro de `backend`, com o banco iniciado e preparado:

```powershell
npm run start:dev
```

Abra [http://localhost:3001/health](http://localhost:3001/health). A resposta esperada é `{"status":"ok","database":"ok"}`. O endpoint executa `SELECT 1`; isso verifica a conexão, mas não substitui a conferência das migrations e tabelas.

### Dados fictícios para desenvolvimento

Depois de aplicar as migrations em um banco de desenvolvimento, execute `npm run seed` dentro de `backend`. O comando cria/atualiza uma equipe, quatro pessoas (ADMIN, LEADER e dois MEMBER), dois projetos, conversa/mensagens, CheckIns, problemas técnicos compartilhados/privados e pedido de ajuda. Os IDs são fixos; reexecutar o seed pode sobrescrever alterações desses registros. Não execute em produção nem apenas para atualizar o banco já usado na demonstração.

Para compilar e executar a versão compilada:

```powershell
npm run build
npm run start:prod
```

## Executar o frontend

Em outro terminal, partindo da raiz:

```powershell
cd frontend
npm ci
npm run dev
```

Abra [http://localhost:3000](http://localhost:3000). Login, `/colaborador`, `/colaborador/conversa`, `/lider` e `/projetos/:id` usam a API real. A prévia da página inicial é apenas uma ilustração identificada como tal.

Para conferir a compilação:

```powershell
npm run build
npm run typecheck
npm start
```

Pare o servidor de desenvolvimento antes de executar `npm start`, pois ambos usam a porta 3000.

## Modelo e estado atual

O schema atual usa `User`, `Team`/`TeamMember`, `Project`/`ProjectMember`, `Conversation`/`Message`, `CheckIn`/`CheckInMessage`, `TechnicalProblem`, `PendingTechnicalSolutionSuggestion` e `HelpRequest`. Migrations antigas permanecem preservadas; o schema Prisma é a referência do modelo vigente. Os documentos iniciais de modelo/backlog são históricos.

A API oferece projetos, histórico filtrável de CheckIns, visão do líder, problemas técnicos autorizados e `POST /api/v1/conversations/message`. Veja [o roteiro atual do MVP](docs/demo-mvp.md) para preparação e validação ponta a ponta.

Conversations e Messages originais são persistidas. O chat mostra respostas textuais reais, sem JSON de diagnóstico, mas ainda não recupera o histórico visual após recarregar a página. A visão do projeto mostra o último CheckIn por membro e até 50 atualizações anteriores. Embeddings são gerados no ciclo de criação/enriquecimento do TechnicalProblem; o embedding da mensagem consultada é temporário. MCP está fora deste MVP. As decisões de interface estão documentadas em [pesquisa de UX](docs/ux-research.md) e [auditoria](docs/ux-audit.md).

## Onde continuar

- Novas páginas e componentes: `frontend/app`, criando pastas apenas quando forem usadas.
- Novos endpoints e regras: módulos em `backend/src`, registrados em `app.module.ts` conforme surgirem as funcionalidades.
- Modelo de dados: `backend/prisma/schema.prisma`, acompanhado por novas migrations.
- Acesso ao banco: reutilizar `PrismaService`; exportá-lo por um módulo próprio quando houver outros módulos que precisem dele.
- Integração entre as aplicações: manter `NEXT_PUBLIC_API_BASE_URL` e `FRONTEND_URL` coerentes com as portas/origens utilizadas.

## Próximos passos e entrega

As cinco issues do backlog estão cadastradas no GitHub. O documento [docs/backlog.md](docs/backlog.md) permanece como uma visão inicial do planejamento.

O repositório está disponível em [RyanLirio/nexo](https://github.com/RyanLirio/nexo). Para continuar o trabalho local e enviar novas alterações:

```powershell
git add .
git commit -m "descricao da alteracao"
git push
```

Revise a evidência das migrations e inclua o link do repositório e o comprovante das migrations na entrega acadêmica.

## Documentação consultada

- [Next.js: instalação](https://nextjs.org/docs/app/getting-started/installation)
- [NestJS: primeiros passos](https://docs.nestjs.com/first-steps)
- [Prisma com NestJS](https://www.prisma.io/docs/guides/frameworks/nestjs)
