# Autenticação e papéis de acesso

O Nexo usa papéis globais porque o MVP representa uma única empresa. O papel fica em `User.role` e aceita `ADMIN`, `LEADER` ou `MEMBER`.

## Regras atuais

- `ADMIN` é identificado diretamente por `User.role` e possui acesso administrativo global.
- `LEADER` também é um papel do usuário, mas uma ação sobre determinada equipe exige que a pessoa esteja vinculada àquela equipe em `TeamMember`.
- `MEMBER` representa o acesso padrão. `TeamMember` registra apenas o vínculo entre pessoa e equipe; não possui mais um campo próprio de papel.
- `ProjectMember.role` continua separado, com `OWNER` ou `MEMBER`, porque esse papel pertence ao contexto de um projeto.

## Controle de acesso

`PrismaAccessControlService.isAdmin` consulta `User.role`. `isTeamLeader` combina duas condições: existência de `TeamMember` para a equipe informada e `User.role = LEADER`. O `RolesGuard` verifica primeiro o acesso global de administrador, portanto um `ADMIN` não depende da verificação de liderança.

Essa implementação substitui as consultas antigas a `OrganizationMember.role` e `TeamMember.role`, removidas pela migration `20260925150000_remove_organization_add_user_role`.

Enquanto a autenticação Google não estiver configurada no ambiente, o login de desenvolvimento e o cabeçalho de identificação devem ser tratados apenas como recursos locais, não como segurança de produção.
