# Micro-backlog

Estes são rascunhos para cadastro manual. Nenhuma issue remota foi criada.

## 1. Implementar autenticação e perfis de usuários

Permitir que colaboradores e líderes acessem apenas os recursos autorizados. Usar os papéis definidos por equipe e escolher com o grupo a abordagem de autenticação.

Critérios de aceitação:
- Usuário consegue entrar e sair; credenciais inválidas são rejeitadas.
- Endpoints protegidos recusam acesso sem autenticação.
- Permissões são conferidas no backend, inclusive para acesso entre equipes.
- Senhas, se usadas, são armazenadas com hash apropriado.

## 2. Desenvolver fluxo de check-in conversacional

Criar a conversa sobre avanços, dificuldades e próximos passos e transformar seu conteúdo em um registro que o colaborador possa revisar antes de salvar.

Critérios de aceitação:
- Colaborador seleciona um projeto do qual participa.
- Pode revisar e corrigir o resumo estruturado antes de confirmar.
- Falhas no serviço de IA são informadas sem perder o conteúdo em edição.
- Dados pessoais ou emocionais não entram no registro técnico.

## 3. Implementar registro autorizado de soluções técnicas

Permitir registrar problema, tecnologia e solução, pedindo autorização explícita do autor para compartilhar.

Critérios de aceitação:
- Autor revisa o conteúdo antes de salvar.
- A autorização registra uma data e pode ser retirada.
- Registros sem autorização não aparecem em buscas ou sugestões para colegas.
- Backend verifica autoria e regras de acesso, sem depender apenas da interface.

## 4. Desenvolver busca de conhecimento e indicação de colaboradores

Começar com busca textual por problema ou tecnologia. Avaliar busca semântica somente depois que o fluxo básico estiver funcionando.

Critérios de aceitação:
- Busca apresenta somente soluções autorizadas e acessíveis à equipe.
- Resultado mostra solução e autor como possível contato, sem ranking de desempenho.
- Interface trata a ausência de resultados.
- Exemplos fictícios verificam os limites de acesso entre equipes.

## 5. Criar solicitação de ajuda e visão inicial do líder

Permitir pedir apoio sobre um projeto e acompanhar a situação da solicitação. Criar uma visão de bloqueios técnicos da equipe para o líder.

Critérios de aceitação:
- Solicitante registra o problema e pode indicar um colega.
- Participantes autorizados acompanham os estados aberto, em andamento e resolvido.
- Líder visualiza apenas informações das equipes que acompanha.
- Não há métricas de produtividade, rankings ou inferências sobre saúde mental.

Fora destas issues: agenda automática, integrações corporativas e IA multiagente.
