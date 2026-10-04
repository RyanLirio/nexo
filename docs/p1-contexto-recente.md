# P1 — contexto recente da Conversation (2026-10-04)

Branch: `codex/integracao-main-fases-1-3`. Trabalho limitado ao P1; sem push/merge.

## Implementado

- Reutilizada `findConversationMessages`, com Conversation e usuário autenticado, para enviar até 10 mensagens anteriores em ordem cronológica. A mensagem atual não é duplicada.
- Mesma operação `responses.parse` com `gpt-5.4-mini`: dados de projetos, turnos USER/ASSISTANT e CURRENT MESSAGE como último turno.
- Prompt prioriza projeto explícito, resposta à pergunta anterior e contexto ativo inequívoco. USER permanece fonte de verdade; perguntas ASSISTANT não são fatos.
- Extração dos campos precede a resposta textual no structured output. Regras e exemplos genéricos cobrem referências, continuidade, classificação e isolamento.
- Trava local conservadora compara prefixos de palavras dos nomes elegíveis, normalizando acentos/case. Dois ou mais candidatos sem nome completo ou qualificador único retornam `projects: []` e uma pergunta com as opções antes de chamar a IA. Não usa distância de edição, score fuzzy, IDs como pistas ou correspondência por tecnologia.
- Sem mudanças de schema, migrations, threshold, embeddings, frontend ou lógica de aceite/recusa.

## Validação

- `npm test`: 240 testes aprovados (14 novos neste P1); inclui build e Prisma generate.
- Build aprovado.
- `node scripts/verify-conversation-context.cjs`: execução real opt-in com PostgreSQL/OpenAI e limpeza de fixtures por IDs exatos.
- Sequência HTTP solicitada manteve Automação Financeira: NO_PROBLEM → NO_PROBLEM → DIFFICULTY → TECHNICAL_PROBLEM.
- normalizedProblem na validação final: `Token OAuth expirando antes da chamada chegar ao Protheus durante a autenticação.`
- Similaridade: `0.900330313042483` (threshold inalterado: 0.78). Candidato encontrado, solução oferecida e aceite funcionou.
- Fluxo real de dois projetos, "nesse segundo", troca para financeiro e vínculos CheckInMessage passaram sem mistura.
- 13/13 casos de referência passaram na execução completa com PostgreSQL/OpenAI: próximo passo implícito, dificuldade implícita, follow-up técnico, ao financeiro, isso, acabei de falar acima, typo único, ambiguidade de atividade, nesse segundo, troca explícita, novo avanço sem herdar classificação antiga, pergunta do assistente não virar fato e typo com nomes ambíguos.
- Caso 13 repetido 10 vezes pela implementação real: 10/10 respostas pediram desambiguação, sem chamada à IA. Teste do fluxo de Conversation comprova ausência de escrita em CheckIns e de busca/embedding nesse caso.
- Todas as fixtures desta execução foram removidas; nenhum dado real foi apagado.

## Última pendência resolvida

Com projetos conhecidos `Automação Financeira A` e `Automação Financeira B`, `na automação financeir` agora retorna: `Em qual destes projetos isso aconteceu: Automação Financeira A ou Automação Financeira B?`, sem selecionar candidato. Com nome único, nome completo explícito ou qualificador único, a extração existente continua funcionando. Contexto implícito e respostas de solução não são interceptados por essa trava.

O primeiro bloco encerrou sem commit porque o caso 13 ainda falhava. O ajuste seguinte foi limitado a essa pendência, dentro do timebox de 10 minutos. Validação completa aprovada, sem bloqueador restante nos casos deste P1. Servidor existente não foi reiniciado nesta correção.

A trava complementa a validação de schema: Structured Outputs não garante ausência de erros de interpretação, conforme a [documentação oficial OpenAI](https://developers.openai.com/api/docs/guides/structured-outputs#handling-mistakes). Nenhum modelo, endpoint ou contrato público foi substituído.

Arquivos locais não relacionados, incluindo `frontend/CLAUDE.md`, preservados. Nenhum segredo, arquivo .env ou credencial incluído.
