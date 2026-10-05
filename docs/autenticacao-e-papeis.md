# Autenticação e papéis de acesso

O Nexo usa papéis globais porque o MVP representa uma única empresa. O papel fica em `User.role` e aceita `ADMIN`, `LEADER` ou `MEMBER`.

## Regras atuais

- `ADMIN` é identificado diretamente por `User.role` e possui acesso administrativo global.
- `LEADER` também é um papel do usuário, mas uma ação sobre determinada equipe exige que a pessoa esteja vinculada àquela equipe em `TeamMember`.
- `MEMBER` representa o acesso padrão. `TeamMember` registra apenas o vínculo entre pessoa e equipe; não possui mais um campo próprio de papel.
- `ProjectMember.role` continua separado, com `OWNER` ou `MEMBER`, porque esse papel pertence ao contexto de um projeto.

## Controle de acesso

`PrismaAccessControlService.isAdmin` consulta `User.role`. `isTeamLeader` combina duas condições: existência de `TeamMember` para a equipe informada e `User.role = LEADER`. O `RolesGuard` verifica primeiro o acesso global de administrador, portanto um `ADMIN` não depende da verificação de liderança.

A autenticação do Nexo é operada exclusivamente através do fluxo oficial Google OAuth (`POST /api/v1/auth/google`). O endpoint de desenvolvimento (`dev-login`) e o cabeçalho de bypass (`x-user-id`) foram permanentemente removidos para garantir que nenhuma credencial JWT seja emitida sem verificação criptográfica válida do provedor de identidade. Todas as rotas protegidas exigem um token Bearer assinado com chave secreta do servidor.

