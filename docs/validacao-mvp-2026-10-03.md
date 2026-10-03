# Validação do bloco final do MVP — 03/10/2026

Branch: `codex/integracao-main-fases-1-3`. HEAD inicial: `595b31c5095919ac21d57aede5ff5ea0a4976964`. `origin/main` após fetch: `9855a42ceb16e58d56592554933ca28b4b2eb49e`, sem mudanças novas para integrar. Sem push/merge/troca para main.

## Implementação

- `/lider` e `/colaborador`: lista autenticada real de projetos acessíveis, status, prioridade, previsão, líder/responsável, equipe e quantidade de membros. Nenhum score, ranking ou métrica inventada.
- `/projetos/:id`: dados reais, último CheckIn por membro (consulta limitada ao projeto), três campos, horário, até 50 registros anteriores e filtro visual por membro. Ausência de atualização e campos nulos têm texto neutro.
- Problemas abertos usam metadados já disponíveis na consulta de projeto. Soluções resolvidas exigem compartilhamento autorizado; nenhuma autorização automática foi adicionada. A rota legada de problemas deixou de desabilitar o filtro de consentimento.
- `leader-view`: LEADER com vínculo na equipe ou ADMIN global, usando AccessControlService existente. MEMBER não recebe essa visão. Leituras de membros e CheckIns exigem acesso à equipe do projeto.
- CheckIns HTTP retornam contexto estruturado sem o grafo de Messages privadas. Nenhuma Message nem vínculo CheckInMessage foi removido do banco.
- Chat: resposta textual real, proteção imediata contra envio duplicado, rolagem para a mensagem recente, quebras de linha preservadas e erro de conexão amigável. Autenticação existente mantida.
- `frontend/data/mock-data.ts` permanece como arquivo antigo, sem importação nas rotas do MVP. A landing tem uma ilustração estática explicitamente identificada como exemplo; não é um painel de dados reais.
- `technical-problem.service.ts`, OpenAIService, threshold, embeddings, pgvector, schema e migrations não foram alterados.

## Evidências e comandos

| Validação | Resultado |
| --- | --- |
| Backend `npm test` (inclui build) | 187/187; zero falhas, skips ou cancelamentos |
| Backend `npm run build` | Prisma generate + Nest build passaram, também executados pela integração |
| Frontend `npm run typecheck` | Passou |
| Frontend `npm run build` | Passou; 7 páginas geradas e rota dinâmica `/projetos/[id]` |
| `npm run prisma:status` | 8 migrations; banco atualizado |
| Docker | `nexo-db-1`, PostgreSQL 17/pgvector, saudável; volume preservado |
| OpenAI/pgvector reais | Embedding persistido com 1536 dimensões; consulta vetorial real |

Foram adicionados 12 testes unitários de visão do líder, consulta por membro/projeto, escopo de equipe e privacidade das Messages. As fases anteriores continuam passando. Nenhum framework de teste frontend foi instalado.

`test:integration:golden` e `test:integration:semantic` apontam para o mesmo script ampliado, com fixtures identificadas por IDs exatos. A execução real cobre:

1. criação de candidato OAuth autorizado, solução e embedding;
2. paráfrase encontrada, assunto diferente rejeitado, top 5 com seis candidatos, threshold 0.78;
3. conversa comum `NO_PROBLEM` e dificuldade `DIFFICULTY`, sem normalização/solução inventadas;
4. mensagem técnica: `TECHNICAL_PROBLEM`, normalizedProblem, resumo, dificuldade e próximo passo;
5. candidato → PENDING → ASSISTANT pergunta → aceite → solução; recusa e desambiguação;
6. CheckIn/CheckInMessage reais, último CheckIn individual e histórico anterior visíveis ao líder;
7. equipe externa bloqueada, MEMBER bloqueado na leader-view, ADMIN global, consentimento sempre exigido;
8. usuário externo não lê mensagens nem aceita pendência alheia; parâmetro userId arbitrário não muda o dono da consulta;
9. perda de equipe/consentimento/solução entre sugestão e aceite revalidada;
10. limpeza somente das fixtures da execução.

Execução golden concluída com similaridade `0.868966` na Conversation e `0.856123` na paráfrase direta. A execução semantic final passou com `0.856123` também na Conversation, incluindo a privacidade das Messages no histórico. Valores podem variar entre chamadas. Houve duas falhas durante ampliação do verificador: uma execução gerou duas pendências quando era esperada uma (provável ambiguidade de nomes contendo o mesmo UUID longo, causa não estabelecida conclusivamente); depois, `findFirst` sem ordenação selecionou a fixture antiga. Os testes passaram usando nomes naturais distintos (IDs continuam únicos) e selecionando o CheckIn pelo vínculo da Message. A asserção explícita de isolamento continua no script; nenhuma mudança no prompt ou algoritmo de produção foi feita para forçar resultado. A variabilidade da extração pela LLM continua merecendo acompanhamento.

Smoke HTTP de usuários existentes do seed, usando apenas o dev-login já implementado:

- `demo-ryan` MEMBER: 2 projetos, histórico e problemas autorizados; leader-view 403.
- `demo-marina` LEADER: 2 projetos e leader-view 200, com membros/contexto.
- `demo-gustavo` ADMIN: 2 projetos e leader-view 200.

No navegador, login Google renderizou; clicar não abriu popup/sessão no browser automatizado. `/lider` sem sessão redirecionou para `/login`. **Não há comprovação de navegação autenticada pelo Google neste bloco.** As rotas autenticadas foram validadas por build/typecheck e contratos HTTP reais, não por uma sessão injetada ou nova autenticação. A skill de computer-use orientou a checagem pelo navegador e o uso do fallback HTTP autorizado diante da limitação.

## npm audit — diagnóstico, sem upgrade

Frontend: 1 crítico. Dependência direta `next@16.3.4`, advisory [GHSA-vcvr-r3jv-pc5j](https://github.com/advisories/GHSA-vcvr-r3jv-pc5j). O caminho afetado é ImageResponse Node de `next/og` com SVG contendo valores controlados por atacante. A busca no código do frontend não encontrou `next/og`, ImageResponse ou rotas de imagens Open Graph. Correção publicada em 16.3.6; audit oferece 16.3.8, sem salto major. O projeto fixa versão exata: nenhuma atualização automática foi aplicada. Isso não é certificação de ausência de vulnerabilidades; revisar upgrade antes de deploy.

Backend: 8 alertas (7 high, 1 moderate; zero críticos). Versões do lockfile:

| Pacote | Versão | Origem / exposição observada |
| --- | --- | --- |
| @nestjs/platform-express | 11.2.3 | Direta; alerta herdado de multer |
| multer | 2.2.0 | Transitiva; sem FileInterceptor/FilesInterceptor ou upload no código da aplicação |
| prisma | 7.10.0 | Direta de desenvolvimento; alertas em dependências da CLI |
| @prisma/config | 7.10.0 | Transitiva de configuração Prisma |
| deepmerge-ts | 7.1.5 | Transitiva de configuração; não importada pelo domínio |
| mysql2 | 3.15.3 | Transitiva da CLI; banco do Nexo é PostgreSQL via pg, não MySQL |
| brace-expansion | 1.1.18 e 5.0.9 | Transitiva de tooling/glob; não importada pelo domínio |
| fast-uri | 3.1.7 | Transitiva; não importada pelo domínio |

Audit indica correções disponíveis para multer/tooling. Para Prisma, sugere 6.19.3 com `isSemVerMajor: true`, downgrade incompatível com a base Prisma 7 atual: não aplicar cegamente. Nenhum `npm audit fix`, override, upgrade/downgrade ou alteração de lockfile foi executado. Alertas exigem revisão separada antes de exposição pública.

## Limites e pendências

- Dívida de consolidação do summary pela LLM preservada. Messages originais seguem fonte de verdade. A suíte confirma preservação de difficulty/nextSteps diante de novos nulos; não comprova retenção perfeita do summary em toda mensagem real.
- Histórico visual do chat após reload e recuperação de mensagens pela UI ainda não existem. A variabilidade da classificação/associação pela LLM não é eliminada por uma execução bem-sucedida do golden path.
- Google manual e conferência visual das telas autenticadas pendentes; o líder fictício do seed precisa de conta Google legítima cadastrada para apresentação via browser.
- Histórico/conhecimento limitado aos endpoints atuais, sem paginação completa, calendário ou ranking.
- Auditoria de todas as mutações de outros módulos, MCP, deploy e funcionalidades pós-MVP ficam fora deste bloco. A cobertura descrita não equivale a uma auditoria global de segurança.
- `.env`/segredos, `frontend/CLAUDE.md`, arquivos automáticos e trabalho do checkout original não entram nos commits. Serviços existentes em 3000/3001 não foram interrompidos; smoke isolado usou 3100/3101.

Roteiro de apresentação: [demo-mvp.md](demo-mvp.md).
