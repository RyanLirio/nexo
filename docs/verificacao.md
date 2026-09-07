# Verificação do kickoff

Verificações realizadas em 6 de setembro de 2026, no horário de Brasília (o nome da migration usa UTC, já em 7 de setembro).

## Ambiente usado

- Windows, Git 2.50.1.
- Node.js 24.20.0 LTS usado nas compilações finais e na execução dos servidores. Foi baixado em uma pasta de trabalho separada; o Node 25.0.0 instalado no computador não foi substituído.
- PostgreSQL 17.10 local, sem dados reais, escutando em `127.0.0.1:5432`.
- Binários de teste obtidos pelo pacote `@embedded-postgres/windows-x64@17.10.0-beta.17`, fora do repositório. O sufixo beta pertence ao empacotamento; o servidor informou PostgreSQL 17.10. Esse pacote não é dependência do Nexo.

## Resultados

| Verificação | Resultado |
| --- | --- |
| Instalação das dependências | Concluída nos dois projetos; lockfiles gerados |
| `npm run prisma:validate` | Schema válido |
| Geração do Prisma Client | Concluída com Prisma 7.10.0 |
| `npm run build` no backend | Compilação concluída com Node 24 |
| `npm run build` no frontend | Compilação e geração da página concluídas com Node 24 |
| `npm run typecheck` no frontend | Sem erros |
| Backend compilado | Iniciou e registrou `GET /health` |
| `GET http://127.0.0.1:3001/health` | HTTP 200, `{"status":"ok","database":"ok"}` |
| Frontend compilado | Iniciou em `127.0.0.1:3000` |
| `GET http://127.0.0.1:3000` | HTTP 200, com o texto de apresentação esperado |
| Variáveis de ambiente | Prisma carregou `backend/.env`; Next.js identificou `.env.local` |
| Migration inicial | Aplicada no PostgreSQL local |
| `npm run prisma:status` | `Database schema is up to date!` |
| Tabelas | Oito tabelas de domínio e `_prisma_migrations` confirmadas via SQL |
| Relações | Onze chaves estrangeiras confirmadas via SQL |
| Arquivos de ambiente | `.env`, `backend/.env` e `frontend/.env.local` ignorados pelo Git |

O comprovante extraído do banco está em [migrations-aplicadas.txt](migrations-aplicadas.txt). A migration `20260907021217_init` terminou em `2026-09-07T02:12:17.772Z`, com um passo aplicado e sem rollback.

## Limitações e pendências

- O Docker Desktop não conseguiu iniciar. Seu log indicou falha em `initializing Inference manager`, ao acessar `dockerInference`. Nenhuma restauração ou alteração de configuração do Docker foi feita. O banco foi validado pela alternativa local; a execução do Compose ainda precisa ser conferida em um Docker funcional.
- Nenhum repositório remoto ou issue foi criado. Não havia GitHub CLI disponível nem destino informado. Os rascunhos estão em `backlog.md`.
- Não houve testes de funcionalidades de produto, pois elas não existem nesta etapa. Não foi feita inspeção visual automatizada em navegador; a responsividade foi preparada em CSS.
- As instâncias usadas na verificação são locais e não representam publicação ou hospedagem.

## Repetir a conferência no computador do grupo

Siga a configuração do README. Com Docker funcional, execute na raiz:

```powershell
docker compose up -d --wait db
cd backend
npm ci
npm run prisma:generate
npm run prisma:deploy
npm run prisma:status
```

Para listar as tabelas e registrar uma nova evidência, volte à raiz:

```powershell
cd ..
docker compose exec db psql -U nexo -d nexo -c '\dt'
docker compose exec db psql -U nexo -d nexo -c 'SELECT migration_name, finished_at, rolled_back_at FROM _prisma_migrations;'
```

Se mudou usuário ou banco, ajuste os argumentos. Na instalação local, execute as mesmas consultas com `psql -h localhost -U nexo -d nexo`. Guarde a saída ou um print com as migrations aplicadas para a entrega.
