# Demonstração do MVP do Nexo

Execute na branch `codex/integracao-main-fases-1-3`, com Node 24.15+ da linha 24. No Windows, use `npm.cmd` se `npm.ps1` for bloqueado. Não sobrescreva `.env` já configurados.

## Preparar e iniciar

Na raiz, com Docker Desktop ativo e o `.env` local configurado:

```powershell
docker compose up -d --wait db
docker compose ps
```

O banco usa PostgreSQL 17 + pgvector e volume persistente. Nunca use `down -v` para preparar a apresentação.

Terminal do backend:

```powershell
cd backend
npm ci
npm run prisma:deploy
npm run prisma:status
npm run start:dev
```

Terminal do frontend:

```powershell
cd frontend
npm ci
npm run dev
```

Verifique `http://localhost:3001/health` e abra `http://localhost:3000/login`. `DATABASE_URL`, `JWT_SECRET`, `GOOGLE_CLIENT_ID`, `OPENAI_API_KEY` são configurações locais do backend; `NEXT_PUBLIC_GOOGLE_CLIENT_ID` e `NEXT_PUBLIC_API_BASE_URL` são públicos. `FRONTEND_URL` deve corresponder à origem do navegador. Não compartilhe os arquivos reais de ambiente.

Em outro worktree, forneça os ambientes locais pelo terminal, sem copiar segredos para o Git. Caso 3000/3001 estejam ocupadas, portas alternativas exigem URL da API/CORS coerentes e origem Google previamente autorizada. Não encerre processos de outra sessão por conveniência.

## Seed e embeddings

Somente em banco de desenvolvimento que ainda precise dos exemplos:

```powershell
cd backend
npm run seed
npm run backfill:technical-problem-embeddings -- --dry-run
npm run backfill:technical-problem-embeddings
```

O seed faz upsert em IDs `demo-*`: pode sobrescrever e-mails, status e dados de exemplos já editados. Não o rode novamente sem necessidade. O backfill usa OpenAI (com custo) e preenche apenas embeddings ausentes, sem substituir vetores já existentes.

O seed cria Automação Financeira (`ACTIVE`) e Portal de Notas (`PLANNING`); só projetos ACTIVE com participação do usuário entram na extração da Conversation. Ver ambos no painel não significa que ambos participem da análise. Não altere status/vínculos apenas para forçar uma demonstração.

## Contas e papéis

| ID do exemplo | Conta do seed | Papel |
| --- | --- | --- |
| demo-ryan | `SEED_MEMBER_EMAIL`, ou `ryan@example.invalid` | MEMBER |
| demo-marina | `marina@example.invalid` | LEADER |
| demo-gustavo | `gustavo@example.invalid` | ADMIN |
| demo-joao | `joao@example.invalid` | MEMBER |

As contas `example.invalid` não são contas Google reais. A interface permite Google apenas para e-mail já cadastrado; use um líder com e-mail Google legítimo já autorizado para demonstrar `/lider`. Não foi adicionado login alternativo à UI. Para testes HTTP locais, o endpoint `POST /api/v1/auth/dev-login` já existente aceita e-mail cadastrado e fica bloqueado em `NODE_ENV=production`; nunca publique esse modo de desenvolvimento.

## Rotas e roteiro

1. Entre como colaborador. `/colaborador` lista projetos reais e oferece **Conversar com o Nexo**.
2. Em `/colaborador/conversa`, envie uma atualização comum:
   > Na Automação Financeira finalizei os testes dos boletos.
   Esperado: `NO_PROBLEM`, Message e CheckIn persistidos; a UI mostra resposta textual.
3. Dificuldade sem causa identificada:
   > Na Automação Financeira estou com dificuldade para avançar e ainda não identifiquei o problema. Meu próximo passo é investigar o bloqueio.
   Esperado: `DIFFICULTY`, sem causa inventada; difficulty/nextSteps registrados.
4. Problema técnico concreto:
   > Na Automação Financeira a chamada HTTPS ao gateway financeiro falha com erro SSL porque o certificado expirou. Meu próximo passo é revisar a renovação do certificado.
   O seed inclui um caso SSL autorizado; faça backfill se seu embedding estiver ausente. A busca exige solução preenchida, consentimento, equipe acessível e similaridade ≥ 0.78. A sugestão depende da similaridade real, não é garantida para qualquer texto.
5. Se houver candidato, Nexo pergunta se quer a solução. Responda **sim** para revelá-la, ou **não** para encerrar a sugestão sem mostrar solução. Para demonstrar ambos, envie novamente o problema entre as decisões. Com pendências de vários projetos, responda o nome de um projeto quando Nexo pedir qual deles.
6. Entre como LEADER/ADMIN, abra `/lider`, escolha o projeto e consulte `/projetos/:id`: membros, último CheckIn individual, três campos, horário, histórico recente e problemas em aberto/soluções compartilhadas. Use **Atualizar contexto** após a conversa.

Ausência de atualização é neutra: “Sem atualização registrada hoje.” Difficulty/nextSteps nulos não viram avaliação de produtividade. Soluções privadas não são expostas; ser líder não concede consentimento automático. As leituras de CheckIns mostram contexto estruturado, não as mensagens brutas da Conversation privada; os vínculos originais permanecem no banco.

## Golden path reproduzível

```powershell
cd backend
npm run test:integration:golden
```

Requer PostgreSQL preparado e acesso real à OpenAI. `test:integration:semantic` executa o mesmo verificador ampliado. Não faz parte do `npm test` porque tem dependências externas e custo.

O script cria fixtures com IDs `semantic-test-<UUID>`, dois projetos acessíveis e uma equipe externa. Salva problema OAuth com solução/consentimento, gera vetor de 1536 dimensões, testa paráfrase e caso diferente, recebe classificação/normalização da Conversation, verifica CheckIn e Message, aceite/recusa/desambiguação, consulta do líder e histórico. Exercita isolamento de Conversation, acesso por equipe, MEMBER/LEADER/ADMIN e revogação de acesso/consentimento/solução. Confirma top 5 com seis candidatos elegíveis e threshold 0.78 intacto.

Somente IDs da própria execução são removidos em `finally`; dados reais não são alterados. Interrupção abrupta do processo pode impedir o `finally`: não remova fixtures por prefixo amplo, identifique os IDs exatos daquela execução.

## Validações e limites conhecidos

```powershell
cd backend
npm test
npm run build
npm run prisma:status
cd ../frontend
npm run typecheck
npm run build
```

- A consolidação de `currentSummary` pela LLM pode perder informação anterior. Não foi redesenhada: Messages originais continuam sendo a fonte de verdade e nulos novos preservam difficulty/nextSteps anteriores.
- Histórico visual do chat após reload não está implementado, embora as mensagens sejam persistidas no banco.
- Sem criação automática de TechnicalProblem, indicação de colega ou HelpRequest a partir desta Conversation.
- Listagens de histórico/conhecimento são limitadas pelos endpoints atuais; não são um calendário nem um catálogo completo.
- Google precisa de origem autorizada e e-mail cadastrado. O browser automatizado sem sessão não substitui conferência manual do Google e das telas autenticadas.
- Next 16.3.4 tem alerta crítico de `next/og/ImageResponse`; o caminho não é usado no código do Nexo. Correção disponível desde 16.3.6 (patch, não major); nenhuma dependência foi atualizada neste bloco. Diagnóstico: [advisory](https://github.com/advisories/GHSA-vcvr-r3jv-pc5j). Antes de deploy, revisar e validar a atualização separadamente.
