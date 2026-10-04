# Fechamento conversacional do MVP — 04/10/2026

## Branch e escopo

- Branch: `codex/integracao-main-fases-1-3`.
- HEAD inicial: `94bc32e65ddec8121f23067614f279404d87f33f`.
- `origin/main` após fetch: `9855a42ceb16e58d56592554933ca28b4b2eb49e`.
- O remoto não tinha commits novos fora da branch integrada: 14 commits locais à frente, zero atrás antes deste bloco. Nenhum merge foi feito.
- Commits de implementação e testes:
  - `4b9a7aec0d9441683b6b82c813bc51925c9d90e2` — `feat: torna conversa do nexo natural e orientada ao trabalho`.
  - `77d367cda66fc20085ca1f4758b8c24b427a9bae` — `test: valida comportamento conversacional do mvp`.
- O commit `docs: atualiza demonstração conversacional` inclui este relatório; seu hash é o HEAD final informado no encerramento. Não é gravado dentro do próprio commit para evitar autorreferência impossível.
- Sem push, troca de branch, merge, reset, instalação de dependências ou alteração de segredo.

## Arquivos alterados

1. `backend/src/ai/openai.service.ts` — campo assistantResponse, instruções conversacionais e proteção contra contexto vazio.
2. `backend/src/conversations/conversations.service.ts` — uso da resposta natural com prioridade do fluxo de solução.
3. `backend/src/ai/openai.service.spec.ts` — 8 testes novos da fronteira SDK/contrato/prompt.
4. `backend/src/conversations/conversations.service.spec.ts` — adaptação do harness e 12 testes novos de integração interna.
5. `backend/scripts/verify-semantic-integration.cjs` — verificações conversacionais reais junto ao Golden Path existente.
6. `docs/backend-fluxo-semantico.md` — contrato interno e prioridade atualizados.
7. `docs/demo-mvp.md` — roteiro de conversa natural e limites de escopo.
8. Este relatório.

Nenhum schema/migration/repository/frontend/TechnicalProblemService foi modificado.

## Como ficou o fluxo

Uma única operação `responses.parse` com `gpt-5.4-mini` retorna:

```text
message + projetos ACTIVE + campos do CheckIn diário
  → { assistantResponse, projects }
  → persistência dos campos estruturados de cada projeto
  → busca semântica já existente quando TECHNICAL_PROBLEM
  → seleção da resposta final
  → Message ASSISTANT persistida
  → frontend renderiza assistantMessage.content
```

Foi reaproveitado o structured output com Zod, sem segunda análise para classificar ou responder. A implementação segue o padrão de `responses.parse`/`zodTextFormat` da [documentação oficial de Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs). A skill OpenAI Docs orientou essa conferência, mantendo o modelo já usado no projeto.

Embeddings continuam sendo chamadas separadas no fluxo técnico preexistente, com `text-embedding-3-small`, 1536 dimensões. Não houve troca de modelo, alteração da consulta, threshold ou arquitetura. Respostas a aceite/recusa não chamam OpenAI.

Prioridade:

1. decisão sobre pendência, desambiguação e respostas de segurança/revalidação;
2. match único: “Encontrei um problema parecido. Quer ver a solução?”;
3. vários matches: pergunta para qual projeto;
4. nos outros casos, assistantResponse.

Casual: conversa brevemente e direciona ao trabalho. Capacidades: explica acompanhamento e recuperação de conhecimento. Atualização: reconhece o avanço e pode fazer uma pergunta. Dificuldade: reconhece sem inventar causa. Problema técnico: mantém normalização/embedding/pgvector e oferta controlada. Fora do escopo: não executa código, redação, viagem ou curiosidade; redireciona para trabalho.

CheckIn continua vindo exclusivamente de summary/difficulties/nextSteps extraídos do relato original. A resposta do assistente não é analisada novamente. Nulos novos preservam dificuldade/próximo passo anteriores. Vínculos Message ↔ CheckIn permanecem.

## Exemplos REAIS — última execução

Obtidos com OpenAI configurada e textos fictícios pela Conversation HTTP, não respostas mockadas:

| Mensagem | Resposta real |
| --- | --- |
| opa, tudo certo? | Tudo certo! Se quiser, me conte sobre algum avanço, dificuldade ou próximo passo em um dos seus projetos. |
| você pode me ajudar de alguma forma? | Posso ajudar a acompanhar avanços, registrar dificuldades, organizar próximos passos e identificar problemas técnicos semelhantes com soluções compartilhadas. Se quiser, me conte sobre um projeto ou alguma dificuldade atual. |
| Hoje finalizei os testes da Automação Financeira. | Ótimo, os testes da Automação Financeira foram finalizados. Se quiser, posso acompanhar o próximo passo desse projeto. |
| Estou com dificuldade na autenticação do Protheus, mas ainda não sei a causa. | Entendi a dificuldade na autenticação do Protheus. Você consegue me dizer em qual projeto isso aconteceu? |
| Na Automação Financeira, estou com dificuldade na autenticação do Protheus, mas ainda não sei a causa. | Entendi a dificuldade na autenticação do Protheus na Automação Financeira. Se você já tiver mais algum detalhe sobre o erro ou comportamento, me diga para eu registrar melhor o contexto. |
| O token OAuth expira antes da chamada ao Protheus. | Encontrei um problema parecido. Quer ver a solução? |
| faz um código Python para automatizar uma planilha | Posso ajudar a acompanhar avanços, registrar dificuldades, organizar próximos passos e identificar problemas técnicos semelhantes já registrados. Se quiser, me conte sobre um projeto ou uma dificuldade específica. |
| qual a capital da França? | Não consigo responder perguntas gerais aqui. Se quiser, posso ajudar a registrar avanços, dificuldades ou próximos passos de algum projeto seu. |

Redação e viagem também foram redirecionadas, sem executar a tarefa. Respostas podem variar; o teste não exige frases exatas da LLM.

Na mensagem D sem projeto explícito, a rodada final pediu identificação e retornou projects vazio. O follow-up fictício com o nome completo foi DIFFICULTY, sem normalizedProblem/sugestão/causa inventada. Uma rodada anterior associou pela descrição inequívoca. Essa variabilidade é reportada, não escondida: não forçamos um projeto.

## Validação executada

| Comando / verificação | Resultado |
| --- | --- |
| Backend `npm test` | 207/207 passaram; zero falhas, skips, cancelamentos ou testes pendentes |
| Backend `npm run build` | Prisma generate + Nest build passaram; também executados por npm test e pelo Golden Path |
| Frontend `npm run typecheck` | Passou |
| Frontend `npm run build` | Passou; 7 páginas geradas, incluindo rota dinâmica `/projetos/[id]` |
| Backend `npm run prisma:status` | 8 migrations existentes; banco atualizado |
| `node scripts/verify-semantic-integration.cjs` | Rodada completa passou antes de ampliar isolamento real de dois projetos |
| `npm run test:integration:golden` | Rodada final ampliada passou, incluindo isolamento real de dois projetos |
| PostgreSQL / pgvector | PostgreSQL real; extensão vector 0.8.6; vetor persistido de 1536 dimensões |
| OpenAI | Responses e embeddings reais, usando apenas dados fictícios |

Node 24 foi usado com os arquivos de ambiente existentes fornecidos via `--env-file`, sem copiá-los ou editá-los. A validação externa e o backend final usam certificados do sistema (`--use-system-ca`/`NODE_USE_SYSTEM_CA=1`), sem desabilitar TLS.

`test:integration:semantic` e `test:integration:golden` apontam para o mesmo verificador; não são duas suítes independentes. Os 207 testes unitários não incluem as chamadas pagas. A evidência semântica da LLM vem das verificações reais, não dos stubs unitários.

20 testes unitários novos cobrem resposta sem projeto, casual/capacidades/fora do escopo, uso da resposta estruturada, persistência só de campos extraídos, dificuldade sem causa, técnico sem match, prioridade de múltiplas sugestões, resposta vazia/ausente e descarte de contextos vazios. A suíte anterior continua cobrindo próximos passos, nulos, vínculo com Message, isolamento, aceite/recusa/desambiguação, acesso revogado e ausência de solução antes do aceite.

### Banco e Golden Path

Última execução: `semantic-test-3df5f268-3eaa-4b90-a420-e3d11c931757`.

- Candidato fictício: `88be562a-0cef-4ff3-b05c-01e2298d0711`.
- Paráfrase direta: similarity **0.856113**.
- Relato técnico curto: normalizedProblem `token OAuth expira antes da chamada ao Protheus`; similarity **0.896091**.
- Mensagem completa: normalizedProblem `token OAuth expira antes do envio da requisição na autenticação com o Protheus`; similarity **0.926210**.
- Caso diferente rejeitado; cosine similarity e threshold **0.78** intactos; top 5 confirmado com seis candidatos elegíveis.
- MEMBER/LEADER limitados à equipe; ADMIN global; consentimento e solução exigidos; equipe externa não recebeu o candidato interno.
- Saudação/capacidades/pedidos genéricos não criaram CheckIn. Duas atualizações em uma mensagem mantiveram projetos e próximos passos isolados.
- CheckIn estruturado e CheckInMessage reais; Message ASSISTANT persistida; oferta → aceite → solução; recusa; desambiguação; revalidação após perder equipe, consentimento ou solução.
- Leader-view, histórico anterior e últimos campos por membro confirmados. MEMBER recebeu 403; líder sem equipe bloqueado; ADMIN global. As leituras não expuseram Messages privadas.
- Fixtures desta execução e das tentativas anteriores removidas em finally; limpeza confirmada. Nenhum registro real/seed/volume foi apagado ou sobrescrito.

## Bugs e decisões conservadoras

1. A primeira rodada real de saudação retornou entradas de projeto com summary vazio. Corrigidos prompt e descarte de contextos vazios antes de persistência; teste de regressão incluído.
2. Identificação sem nome de projeto foi variável. O prompt permite usar descrição inequívoca, mas pede identificação quando não houver segurança. O verificador aceita a solicitação de contexto e envia um relato explícito fictício; não assume associação nem enfraquece threshold.
3. Vários matches agora pedem projeto já na oferta inicial, preservando decisões por pendência e revalidação existentes.
4. `findRecentMessages`/`get_recent_messages` foram auditados: isolam o usuário. Não incluímos histórico USER/ASSISTANT no prompt, para não reintroduzir soluções aceitas nem contexto de outro projeto; isso não é necessário para resolver o recibo genérico atual.
5. Não foi adicionada intenção/classificação nova, lista de palavras proibidas ou chamada extra à OpenAI. Escopo é definido no prompt; validações regex existem apenas no teste opt-in.

## Frontend, navegador e estado final

As quatro rotas foram inspecionadas: `/colaborador`, `/colaborador/conversa`, `/lider`, `/projetos/:id`. Usam dados reais e exibem texto, não JSON/IDs/classification/normalizedProblem/similarity. O JSON encontrado no chat é apenas o body do POST. Não há importação de mock-data nas rotas do MVP. Erros 500/conexão têm mensagem amigável; nenhuma stack é renderizada.

A auditoria de código não substitui inspeção visual autenticada. O navegador disponível foi o in-app browser, sem sessão; a tela de login Google renderizou sem erro de configuração. Não foi automatizado diálogo de autenticação nem criada alternativa na UI. A skill de computer use orientou essa conferência e a preservação do login existente.

Backend final recarregado na porta 3001; frontend mantido na 3000; mesmo banco/volume na 5432. Health retornou `{"status":"ok","database":"ok"}`. As rotas de frontend responderam 200, o que por si só não comprova login Google.

Fora dos commits: `frontend/CLAUDE.md` local. `next-env.d.ts` mudou automaticamente entre dev/build, sem edição manual ou staging; qualquer alteração automática final permanece excluída. O checkout original conserva `.gitignore`, README, TechnicalProblemService, next-env.d.ts, CLAUDE.md, mcp-server/, scripts/ e start-nexo.cmd sem intervenção deste bloco. Nenhum `.env`, chave, token ou arquivo temporário entrou no staging.

## Pendências e apresentação

- Confirmar manualmente Google e as telas autenticadas com uma conta real, incluindo líder autorizado. Esse é o único passo de apresentação não comprovado neste bloco; contas `example.invalid` não servem para Google.
- Variabilidade da LLM permanece. Relatos sem identificação segura podem precisar do nome do projeto; não há retenção perfeita garantida de currentSummary.
- Histórico visual após reload e redesenho da consolidação do summary continuam pós-MVP, conforme escopo. Messages originais permanecem a fonte de verdade.
- Alertas de dependências já documentados no relatório de 03/10 não foram corrigidos neste bloco; revisão antes de exposição pública/deploy permanece pendente.
- Não há falha restante conhecida nos testes/builds/Golden Path executados. Para apresentação local, o fluxo backend está validado; não é honesto declarar a sessão Google real e a navegação autenticada visual como comprovadas.

Roteiro: [demo-mvp.md](demo-mvp.md). Escopo técnico: [backend-fluxo-semantico.md](backend-fluxo-semantico.md).
