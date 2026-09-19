# Nexo

Projeto acadêmico de Programação IV do curso de Ciência da Computação da UNOESC. Depois do kickoff estrutural, o repositório passou a conter um protótipo navegável, um modelo de dados v2 e uma primeira API de domínio.

## Problema e proposta

Em equipes remotas, poucos líderes podem acompanhar muitas pessoas que participam de vários projetos. Isso dificulta perceber bloqueios, oferecer apoio e encontrar quem já resolveu um problema parecido.

O Nexo propõe usar conversas sobre o dia de trabalho para organizar atualizações, registrar soluções técnicas autorizadas e conectar colegas que precisam de ajuda. A proposta é apoiar a colaboração, sem monitorar atividades ou avaliar produtividade individual.

O fluxo planejado para o MVP é: check-in conversacional → registro estruturado → identificação de dificuldade → busca de conhecimento → sugestão de solução ou colega → solicitação de ajuda.

## Integrantes

- Ryan Lirio — Inteligência Artificial e backend.
- Gustavo Felicetti — Banco de dados e backend.
- Wesley de Lima — Frontend.

## Tecnologias

- **Next.js 16 + React 19 + TypeScript:** frontend, responsável pelas páginas que as pessoas acessam.
- **NestJS 11 + TypeScript:** backend, responsável pela API e, futuramente, pelas regras de negócio e permissões.
- **PostgreSQL 17:** banco relacional.
- **Prisma 7:** descreve o modelo do banco, gera um cliente TypeScript e gerencia migrations. O adaptador `@prisma/adapter-pg` usa o driver `pg` para conectar ao PostgreSQL.
- **Git e GitHub:** histórico do projeto, hospedagem do repositório e acompanhamento das issues.

As versões exatas das dependências ficam nos arquivos `package-lock.json`. Não usamos biblioteca de componentes, autenticação ou IA nesta etapa.

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
│       ├── knowledge/
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
- Docker Desktop com containers Linux, ou PostgreSQL 17 instalado localmente.

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

`NEXT_PUBLIC_API_BASE_URL` fica reservado para a integração futura. Variáveis com `NEXT_PUBLIC_` podem aparecer no navegador: nunca coloque segredos nelas. Reinicie os servidores após mudar configurações; valores públicos do Next.js também exigem nova compilação para produção.

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

Instale o PostgreSQL 17 com as ferramentas de linha de comando e mantenha o serviço ativo. Entre no `psql` com um usuário administrador e crie um usuário e banco locais:

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

Depois de aplicar as migrations em um banco de desenvolvimento, execute `npm run seed` dentro de `backend`. O comando compila o projeto e cria/atualiza uma organização, equipe, três pessoas, três projetos, check-ins, duas soluções (uma autorizada e outra privada) e um pedido de ajuda. Os identificadores são fixos para que a execução seja repetível. Não execute o seed em um banco com dados de produção.

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

Abra [http://localhost:3000](http://localhost:3000). O frontend funciona de forma independente e ainda não consome a API.

Para conferir a compilação:

```powershell
npm run build
npm run typecheck
npm start
```

Pare o servidor de desenvolvimento antes de executar `npm start`, pois ambos usam a porta 3000.

## Modelo e estado atual

O modelo v2 adiciona `Organization` e `OrganizationMember`, liga equipes à organização e relaciona soluções técnicas ao projeto e, opcionalmente, ao check-in de origem. Veja [o modelo explicado](docs/modelo-dados-v2.md) e [o estado atual](docs/estado-atual.md). A migration v2 deve ser revisada e aplicada em um banco de desenvolvimento antes do seed.

A API oferece rotas iniciais para projetos, check-ins, conhecimento e pedidos de ajuda; seus contratos estão em [docs/estado-atual.md](docs/estado-atual.md). Ela **não tem autenticação**: IDs enviados pelo cliente não provam identidade e não devem ser tratados como permissão de produção.

O frontend continua usando dados fictícios, sem chamadas à API. Não há IA nem MCP implementados. As decisões de interface estão documentadas em [pesquisa de UX](docs/ux-research.md) e [auditoria](docs/ux-audit.md).

## Onde continuar

- Novas páginas e componentes: `frontend/app`, criando pastas apenas quando forem usadas.
- Novos endpoints e regras: módulos em `backend/src`, registrados em `app.module.ts` conforme surgirem as funcionalidades.
- Modelo de dados: `backend/prisma/schema.prisma`, acompanhado por novas migrations.
- Acesso ao banco: reutilizar `PrismaService`; exportá-lo por um módulo próprio quando houver outros módulos que precisem dele.
- Integração entre as aplicações: usar a URL pública do frontend e configurar CORS no backend para a origem autorizada quando essa integração for implementada.

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
