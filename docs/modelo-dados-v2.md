# Modelo de dados v2 — proposta implementável

Este modelo organiza contexto por organização, equipe e projeto. O nome `CheckIn` permanece. A migration inicial não será alterada.

| Tabela | Papel e campos principais |
| --- | --- |
| `Organization` | Empresa do Nexo: nome, domínio opcional, datas de criação/edição. |
| `OrganizationMember` | Associação pessoa–empresa com papel `ADMIN` ou `MEMBER` e data de entrada. O papel não é global do usuário. |
| `User` | Pessoa: nome, e-mail, identificador Google opcional, avatar opcional e datas. Não há senha local. |
| `Team` | Equipe vinculada a uma organização, com descrição opcional. |
| `TeamMember` | Associação pessoa–equipe com papel `LEADER` ou `MEMBER`. A mesma pessoa pode liderar uma equipe e integrar outra. |
| `Project` | Projeto de uma equipe, com descrição e estado `PLANNING`, `ACTIVE`, `PAUSED` ou `COMPLETED`. |
| `ProjectMember` | Associação pessoa–projeto com papel `OWNER` (responsável principal) ou `MEMBER`. |
| `CheckIn` | Registro estruturado de avanço/resumo, dificuldade e próximos passos, vinculado a projeto e autor. A conversa que poderá produzi-lo ainda não é persistida. |
| `KnowledgeEntry` | Problema e solução técnica, autor, projeto e `CheckIn` de origem opcional. Várias soluções podem nascer de um mesmo check-in. |
| `HelpRequest` | Pedido ligado a projeto, solicitante, ajudante opcional, estado e data opcional de resolução. |

## Decisões e limites

- `Organization` separa os dados de empresas; equipe pertence a uma organização. A API futura terá de aplicar isolamento por organização após autenticação.
- Tabelas de associação registram papéis no contexto certo e evitam um campo “líder” global.
- `sharingAuthorizedAt = null` significa solução **não compartilhada**. A busca pública do protótipo de API deve consultar apenas entradas autorizadas.
- `sourceCheckInId` é opcional para permitir registro manual. Não recebe unicidade.
- Índices seguem consultas previstas: equipe por organização, projeto por equipe, check-ins por projeto/autor e data, conhecimento por projeto/autor/autorização, ajuda por projeto/solicitante e status.
- Como não há autenticação, IDs enviados pelo cliente identificam apenas dados de desenvolvimento. Essas rotas não oferecem segurança contra falsificação de identidade.
- Fora deste modelo: mensagens de chat, OAuth, embeddings, rankings, indicadores pessoais e MCP.
