# Auditoria final do MVP — 04/10/2026

## Resultado deste bloco

Retomada limitada a 30 minutos na branch `codex/integracao-main-fases-1-3`.
Escopo: preservar a auditoria anterior, corrigir a classificação de dificuldades,
revalidar acesso, perfil/logout e histórico, executar builds e criar commits locais.
Sem push, merge, nova arquitetura, alteração de schema, migrations, threshold ou modelo de embedding.

## Correções preservadas e revalidadas

| Prioridade | Problema | Correção / evidência |
| --- | --- | --- |
| P0 | Escrita em projeto de equipe externa | Identidade autenticada e acesso de equipe verificados; status, membros e criação externos retornam 403. |
| P0 | CheckIn criado em nome de colega | `userId` do body não substitui o usuário autenticado; tentativa retorna 403. |
| P0 | Message privada vinculada a CheckIn alheio | Valida USER, sender e proprietário da Conversation no banco; tentativa retorna 403. |
| P0 | Leitura/mutação de HelpRequest externo | Usa acesso existente ao projeto; listas também filtradas no banco. |
| P0 | Exposição de equipes/projetos externos | MEMBER/LEADER respeitam vínculo; ADMIN mantém regra global existente. |
| P0 | Conversation ou sugestão pendente de outro usuário | Histórico usa usuário autenticado; query/body alheios não trocam identidade. Aceite alheio não revela solução nem altera a pendência. |
| P0 | Segredo JWT padrão aceito em produção | Produção exige segredo configurado; HS256 e subject validado. Login de desenvolvimento continua proibido em production. |
| P1 | Dificuldade explícita ocasionalmente classificada NO_PROBLEM | Prompt compartilhado esclarece limites das três classes e inclui exemplos sem regra hardcoded por tecnologia. |
| P1 | Avatar encerrava sessão | Avatar abre menu; somente Sair limpa sessão e retorna ao login. Validado no navegador autenticado. |
| P1 | Histórico diário ausente após reload | GET `/api/v1/conversations/current` recupera até 50 mensagens da Conversation diária do próprio usuário, em ordem cronológica. Validado no navegador e HTTP/banco. |
| P1 | Envios simultâneos nesta instância | Fila por usuário; regressão comprova um CheckIn, vínculo das duas Messages e preservação de difficulties/nextSteps. |

Login Google: Ryan entrou pelo fluxo real durante a validação. Audience/assinatura
continuam na biblioteca oficial, email_verified é exigido, e erros não retornam
detalhes do provider. Nenhum login alternativo foi criado.

## Classificação DIFFICULTY

Mensagem: “Estou com dificuldade na autenticação do Protheus, mas ainda não sei a causa.”

- Reprodução antes do ajuste: DIFFICULTY nesta execução; a falha anterior era intermitente.
- Após ajuste: DIFFICULTY no Golden Path HTTP real, normalizedProblem null, sem busca/sugestão técnica e sem causa inventada.
- Mais três chamadas reais a extractProjectContexts: 3/3 DIFFICULTY e normalizedProblem null.
- Teste unitário cobre contrato e instruções; não prova sozinho o comportamento da LLM. A evidência semântica vem das chamadas reais.
- Não há garantia determinística para todas as futuras respostas da LLM; manter o caso no roteiro de regressão.

O ajuste seguiu a orientação de instruções explícitas e exemplos da
[documentação oficial de prompting](https://developers.openai.com/api/docs/guides/prompt-engineering),
preservando o [structured output existente](https://developers.openai.com/api/docs/guides/structured-outputs).

## Validações executadas

| Validação | Resultado |
| --- | --- |
| Backend `npm test` | 226/226 passando, sem skipped. Inclui build. |
| Backend `npm run build` | Passou. |
| Frontend `npm test` | 9/9 passando. |
| Frontend `npm run typecheck` | Passou. |
| Frontend build (`next build`, comando do script npm) | Passou; todas as rotas geradas. |
| `node scripts/verify-mvp-access.cjs` | 19 verificações HTTP/PostgreSQL passaram; consultas diretas também confirmam isolamento de Conversation/pending suggestion. IA stubada apenas neste verificador P0. |
| `node scripts/verify-semantic-integration.cjs` | Golden Path completo passou com OpenAI, Nest HTTP, PostgreSQL e pgvector reais. |
| `prisma migrate status` | Oito migrations existentes aplicadas; schema atualizado. Nenhuma migration criada/modificada. |
| Frontend `npm audit` | Zero vulnerabilidades após atualização anterior Next 16.3.4 → 16.3.8. |
| Backend `npm audit` | Oito alertas: sete high e um moderate; zero critical. Diagnóstico somente, sem atualização forçada. |
| Git diff / staging | Revisados; sem .env, credenciais, CLAUDE.md, artefatos temporários ou trabalho do checkout original. |

### Golden Path real

Execução: `semantic-test-b7996c1b-e062-4e69-8726-87d5aecb95a9`.

- Casual/capacidades: resposta natural e nenhum CheckIn fictício.
- Avanço → NO_PROBLEM; dificuldade → DIFFICULTY; próximos passos e dois projetos isolados.
- Problema concreto → TECHNICAL_PROBLEM e normalizedProblem fiel.
- Embedding `text-embedding-3-small`: 1536 dimensões persistidas no candidato fictício.
- PostgreSQL/pgvector 0.8.6; cosine similarity `1 - (embedding <=> query_embedding)`.
- Paráfrase direta: 0,856123. Extrações reais: 0,922161 e 0,918055.
- Threshold 0,78 e top 5 preservados; LIMIT 5 verificado com seis candidatos elegíveis.
- Caso diferente rejeitado, equipe externa excluída, ADMIN global, consentimento/solution exigidos.
- Sugestão não revela solução antes do aceite; aceite revela solução correta; recusa, seleção entre projetos e revogação de acesso/consentimento/solution funcionaram.
- CheckIn/CheckInMessage persistidos e consulta de líder/histórico passaram no script existente.
- Fixtures deste teste e do verificador P0 foram removidas por IDs próprios; dados reais preservados.

### Interface

- Avatar abriu menu com nome, email, papel e Sair, mantendo a sessão.
- Histórico de Ryan reapareceu após reload. Mensagens antigas mantiveram a ordem; novas mensagens enviadas pelo próprio usuário durante o teste foram acrescentadas.
- Sair retornou ao login. Acesso posterior à rota protegida também retornou ao login.
- Navbar MEMBER mostra projetos/conversa, sem visão de líder. Outras roles cobertas pelos testes; validação visual de LEADER/ADMIN fica no teste manual final.
- Chat exibe mensagens naturais, não o JSON interno. Mensagens antigas já persistidas não são reescritas por ajustes de prompt.

## Ambiente e limites conhecidos

- Node 24.19.0. Configurações locais existentes carregadas apenas nos processos; .env não foi editado.
- O primeiro frontend build falhou por `--use-system-ca` propagado aos workers do Next, não por código do projeto. Repetido sem a flag, usando `NODE_USE_SYSTEM_CA=1` no processo: passou.
- Backend atualizado e frontend dev permanecem em loopback, com PostgreSQL saudável.
- Múltiplas instâncias ainda podem exigir constraint/lock adicional. A fila atual protege apenas os envios de Conversation nesta instância; não é uma solução distribuída.
- A consolidação de summary continua com a estratégia existente; Messages são a fonte de verdade. Não houve redesenho nem promessa de consolidação sem perda pela LLM.
- Alertas npm do backend ficam para triagem pós-MVP: @nestjs/platform-express, @prisma/config, brace-expansion, deepmerge-ts, fast-uri, multer, mysql2 e prisma. Isso não substitui avaliação de exposição antes de deploy.
- `frontend/CLAUDE.md` e alterações não relacionadas no checkout original permanecem intocados. O next-env.d.ts foi gerado pelos comandos Next; não foi incluído deliberadamente.

## Próximo passo

MVP tecnicamente pronto para teste manual final, dentro do escopo validado.
Entrar novamente por Google em `http://localhost:3000/login` e conferir o roteiro
de apresentação com Ryan e uma conta LEADER/ADMIN, incluindo projeto e CheckIn visível.
Só então revisar os commits para decidir o merge; este bloco não faz push nem merge.

## Commits locais desta retomada

- `b17620e` — `fix: protege autorização e conversas privadas do Nexo` (backend e regressões de acesso/histórico/concorrência).
- `7a9cac2` — `feat: melhora sessão perfil e histórico do chat` (frontend, testes e atualização Next).
- `1010e6d` — `fix: corrige classificação de dificuldades` (prompt e regressão).
- Este relatório fica em um commit documental separado: `docs: registra validação final do MVP`.

Todos os checks obrigatórios foram concluídos antes do limite de 30 minutos.
Não há bloqueador de apresentação identificado nos fluxos revalidados; ainda é
necessário o teste manual final dos perfis de líder/admin antes da decisão de merge.
