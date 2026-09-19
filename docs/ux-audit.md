# Auditoria do protótipo antes dos ajustes

Inspeção do código e da interface em 19/09/2026. Severidade indica impacto provável na tarefa, não uma certificação WCAG.

| Tela | Problema observado | Princípio / WCAG | Severidade | Mudança proposta |
| --- | --- | --- | --- | --- |
| Todas | Textos auxiliares muito claros e frequentemente em 10–12 px. Exemplos medidos pela fórmula WCAG: `#78807e` sobre branco ≈ 4,05:1; `#a0aaa3` sobre branco ≈ 2,39:1. | WCAG 1.4.3; GOV.UK cor e escala tipográfica | Alta | Escurecer texto funcional e aumentar tamanho/altura de linha. |
| Todas | Links de texto curtos podem ter alvo menor que 24×24 CSS px. | WCAG 2.5.8; Material touch targets | Média | Dar área mínima aos controles isolados. |
| Todas | O foco verde claro pode se perder sobre fundo claro; faltam links para pular navegação. | WCAG 2.4.7, 2.4.1; web.dev foco | Média | Foco forte, link “Pular para conteúdo”, ordem de tab testada. |
| `/` | Mensagem de apresentação ocupa a primeira dobra, mas não leva diretamente à tarefa mais provável. | NN/g reconhecimento e minimalismo | Baixa | Oferecer caminho direto a projetos sem depender apenas de texto promocional. |
| `/login` | A navegação global e o avatar parecem indicar uma sessão ativa antes de entrar. | NN/g estado do sistema e consistência | Média | Tornar o estado demonstrativo mais claro; deixar o login simples. |
| `/colaborador` | Bloco de resumo e números antecedem projetos; informação principal fica mais abaixo. | NN/g progressive disclosure | Média | Priorizar projetos e deixar números como apoio discreto. |
| `/colaborador` | O estado “precisa de atenção” substitui o status do projeto e não mostra a dificuldade específica. | NN/g reconhecimento | Média | Mostrar status e dificuldade textual, com acesso direto ao contexto. |
| `/lider` | Indicadores ocupam a primeira seção; a dificuldade concreta aparece abaixo da lista em telas estreitas. | NN/g visibilidade e progressive disclosure | Média | Pôr pontos de atenção no início e métricas em papel secundário. |
| `/projetos/[id]` | Mensagens entram na tela, mas o bloco inteiro tem `aria-live`, anunciando potencialmente todo o histórico a cada envio; input possui rótulo apenas visualmente oculto. | WCAG 4.1.3, 3.3.2 | Média | Anunciar apenas a nova ação em região de status separada e exibir rótulo claro. |
| `/projetos/[id]` | Resumo é mock e não acompanha a conversa; aviso existe, mas pequeno e de baixo contraste. | NN/g estado do sistema; WCAG 1.4.3 | Média | Exibir limitação com texto legível próximo da interação. |

## Pontos que já funcionam

As rotas usam `main`, títulos principais, links para navegação e botão para envio. Os estados de dificuldade têm texto além da cor. Há reflow básico e respeito a `prefers-reduced-motion`. Nenhum problema desses foi inventado como falha funcional: a conversa local adiciona mensagens corretamente.

## Resultado da rodada de ajustes

- Texto auxiliar funcional passou a usar `#52645a`: contraste calculado de aproximadamente **6,31:1 no branco** e **5,92:1 no fundo `#f7f8f6`**. O estado textual de atenção usa `#8a4b15` em `#fff2e5`, aproximadamente **6,16:1**. Esses cálculos cobrem combinações principais, não todas as variações possíveis de navegador.
- Links isolados receberam alvo mínimo de 44 px de altura; há link para pular à região principal. O foco foi conferido visualmente no navegador por Tab.
- O colaborador vê os projetos antes do resumo e lê a dificuldade concreta no cartão. O líder vê os pontos de atenção antes da equipe e dos números.
- O login não exibe navegação de usuário ativo. A conversa usa rótulo visível e uma região de status separada, que anuncia apenas o envio novo.
- O envio local foi testado no navegador: a mensagem apareceu, o campo foi limpo e o aviso de estado entrou na árvore de acessibilidade.

### Ainda pendente

Não houve avaliação com leitor de tela, zoom de 200%/400% em vários navegadores nem teste formal com usuários. O resumo continua fictício e não acompanha as mensagens. Os textos, cartões e estados da futura integração de rede precisarão de uma nova auditoria quando forem implementados.
