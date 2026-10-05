# Fase 4 — núcleo de aceite de solução

Implementado no backend em 03/10/2026, na branch `codex/integracao-main-fases-1-3`,
com limite de 30 minutos. Sem frontend, MCP, push ou mudança de threshold.

## Fluxo pelo endpoint existente

`POST /api/v1/conversations/message`, autenticado, continua recebendo `{ "message": "..." }`.

1. Uma mensagem técnica passa pelas Fases 1–3 preservadas.
2. O melhor match cria/substitui a sugestão pendente daquele usuário + Conversation + projeto.
3. O backend salva uma Message `ASSISTANT` com:
   “Encontrei um problema parecido. Quer ver a solução?”
4. Em outra requisição, uma resposta simples aceita ou recusa, sem nova chamada LLM/embedding.
5. No aceite, o TechnicalProblem é consultado novamente com o usuário autenticado:
   acesso à equipe/ADMIN, compartilhamento e solução não vazia precisam continuar válidos.
6. Status e mensagem ASSISTANT são gravados juntos em transação. Uma atualização
   condicional impede aceitar a versão já substituída/encerrada da pendência.

Aceites: sim, sim mostra, sim, mostra, mostra, pode mostrar, quero ver,
quero a solução, manda, pode mandar. Recusas: não/nao, agora não/nao,
não/nao precisa e deixa pra lá/la. Acentos, caixa, espaços e pontuação são normalizados.
Somente a mensagem inteira reconhecida decide; respostas ambíguas não recebem aceite automático.
Mensagens não reconhecidas seguem o processamento normal, mantendo a pendência existente.

## Persistência

Nova entidade `PendingTechnicalSolutionSuggestion`: id, conversationId, userId,
projectId, technicalProblemId, similarity, status, createdAt e updatedAt.
Status: `PENDING`, `ACCEPTED`, `DECLINED`. Não possui solução nem embedding.

Existe um slot único por usuário + conversa + projeto. Uma nova sugestão substitui
a referência/status nesse slot; não foi implementado histórico de versões das sugestões.
Projetos distintos têm slots distintos. Messages originais e CheckInMessage permanecem intactos.
ASSISTANT tem senderId nulo; chamadas antigas de createMessage continuam usando USER por padrão.

Migration nova, aditiva e aplicada no banco local:
`20261003190000_add_pending_technical_solution_suggestions`.
Não alterou migrations anteriores, dados existentes, threshold 0.78 ou vetor de 1536 dimensões.

## Resposta pública

Toda resposta do endpoint possui `assistantMessage: { id, role, content }`.
A resposta inicial mantém os projetos estruturados e os metadados de `solutionSuggestion`,
sem `solution` ou `similarProblems` escondidos. Recusa retorna:
“Sem problema. Seguimos por aqui.”, sem solução.

Só um aceite válido adiciona:

```json
{
  "acceptedSolution": {
    "projectId": "projeto-do-contexto",
    "technicalProblemId": "problema-conhecido",
    "solution": "Texto da solução autorizada."
  },
  "assistantMessage": {
    "id": "mensagem-salva",
    "role": "ASSISTANT",
    "content": "Texto da solução autorizada."
  }
}
```

A solução aceita fica no histórico da Message ASSISTANT, não na entidade de pendência.
Se o conhecimento perdeu acesso/consentimento/solução, a pendência é encerrada como
DECLINED e a resposta é “Essa solução não está mais disponível para você.”, sem conteúdo técnico.
Falhas de banco inesperadas não são tratadas como aceite nem como sucesso fictício.

## Limites intencionais e próxima tarefa

Com mais de uma pendência, um aceite/recusa simples pede o projeto e mantém todas pendentes.
Não existe ainda seleção por nome/ID; próxima tarefa exata: definir e implementar um
alvo explícito de projeto no aceite/recusa, com testes de isolamento e autorização.

O endpoint usa a Conversation diária já existente. Pendências de dias anteriores não
são transportadas automaticamente; retomada entre dias/expiração ainda precisa de decisão.
Não foi criada UX, botão, NLP aberto, resposta elaborada ou TechnicalProblem automático.
A consolidação de currentSummary continua com a dívida técnica anterior.

## Validação

- `npm test`: 164/164, incluindo 34 testes novos de Fase 4 e repository.
- Build/Prisma generate: passou.
- `npm run test:integration:semantic`: cenário real ampliado com pendência, ASSISTANT,
  aceite, recusa, outro usuário, perda de TeamMember, retirada de consentimento,
  retirada de solution e múltiplos projetos. Todas as fixtures próprias limpas em finally.
- pgvector real preservado: paráfrase ~0.856 e Conversation ~0.845, threshold 0.78;
  caso diferente rejeitado, top 5 com seis candidatos e isolamento por equipe confirmados.
- O primeiro verificador tentou retirar só sharingAuthorizedAt e esbarrou na constraint
  histórica de sincronização com sharingAuthorizedBy. Corrigida somente a fixture,
  retirando/restaurando os dois juntos com SQL parametrizado; nenhuma constraint alterada.
- Oito migrations aplicadas; comparação banco ↔ schema sem diferenças.
- Nenhum frontend, .env, segredo, MCP ou arquivo externo foi incluído.
