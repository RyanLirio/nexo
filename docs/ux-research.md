# Pesquisa de UX para o Nexo

Consulta realizada em 19/09/2026. Meta de projeto: WCAG 2.2 AA, sujeita a verificação manual com tecnologias assistivas antes de qualquer declaração formal de conformidade.

| Fonte | Princípio encontrado | Relevância e aplicação no Nexo | O que fica para depois |
| --- | --- | --- | --- |
| [W3C — WCAG 2.2](https://www.w3.org/TR/WCAG22/) e [Understanding WCAG](https://www.w3.org/WAI/WCAG22/Understanding/) | Texto normal exige contraste de pelo menos 4,5:1; texto grande, 3:1 (1.4.3). Reflow (1.4.10), teclado (2.1.1), foco visível (2.4.7), alvos de 24×24 CSS px com exceções (2.5.8), rótulos (3.3.2) e mensagens de estado (4.1.3) também importam. | Escurecer textos auxiliares, manter foco forte, testar telas estreitas e ampliar controles. A conversa precisa de rótulo e de aviso acessível quando uma mensagem entra. | Auditoria formal com leitores de tela e usuários reais. |
| [Nielsen Norman Group — 10 heurísticas](https://www.nngroup.com/articles/ten-usability-heuristics/) | Estado visível, linguagem próxima da pessoa, controle, consistência, prevenção de erros, reconhecimento em vez de memória e minimalismo reduzem esforço. | Mostrar quando dados são simulados; usar os mesmos termos e padrões nas telas; preservar caminho de volta; manter avanço, dificuldade e próximo passo juntos; impedir envio vazio. | Ajuda contextual completa e recuperação de erros de rede, pois ainda não há integração. |
| [Nielsen Norman Group — progressive disclosure](https://www.nngroup.com/articles/progressive-disclosure/) | Mostrar primeiro as ações e informações principais; oferecer acesso claro a detalhes secundários. | Projetos aparecem antes de indicadores; na visão do líder, dificuldades vêm antes da lista completa; detalhes ficam na página do projeto. | Filtros avançados e painéis configuráveis. |
| [GOV.UK Design System — acessibilidade](https://design-system.service.gov.uk/accessibility/), [spacing](https://design-system.service.gov.uk/styles/spacing/), [cor](https://design-system.service.gov.uk/styles/colour/), [escala tipográfica](https://design-system.service.gov.uk/styles/type-scale/) e [foco](https://design-system.service.gov.uk/get-started/focus-states/) | Componentes acessíveis exigem teste no serviço; escalas de espaço e tipografia mantêm consistência; estados de foco precisam ser claros. | Adotar uma pequena escala de espaçamento em CSS e um foco de alto contraste. A paleta do GOV.UK não será copiada. | Biblioteca completa de componentes. |
| [Material Design — acessibilidade](https://m1.material.io/usability/accessibility.html) | Hierarquia clara e áreas de toque confortáveis. A recomendação de toque é 48×48 dp, maior que o mínimo WCAG em CSS pixels. | Ações principais terão pelo menos 44 px de altura e links curtos receberão padding quando forem controles isolados. Cor virá acompanhada de texto nos estados. | Reproduzir componentes ou identidade Material. |
| [web.dev — foco por teclado](https://web.dev/learn/accessibility/focus) | Remover o indicador padrão sem substituí-lo prejudica a navegação; foco customizado deve ser perceptível. | Manter `:focus-visible` com contorno espesso e contraste adequado inclusive em superfícies escuras. | Atalhos de teclado próprios, sem necessidade nesta fase. |

## Avaliação das dez heurísticas no protótipo

1. **Estado do sistema:** a interface identifica conteúdo de demonstração, mas o envio local precisa indicar claramente o resultado.
2. **Linguagem do mundo real:** “avanço”, “dificuldade” e “próximo passo” funcionam; termos promocionais repetidos podem ceder espaço a informação útil.
3. **Controle e liberdade:** há links de volta; a conversa ainda não salva nem permite desfazer, e isso deve estar explícito.
4. **Consistência:** navegação e cartões usam padrões comuns; o texto de status deve ser consistente.
5. **Prevenção de erros:** o envio vazio já é bloqueado; entradas futuras da API exigirão validação.
6. **Reconhecimento:** o resumo ao lado da conversa evita depender da memória; a lista precisa expor atualizações e dificuldades sem abrir cada projeto.
7. **Eficiência:** acesso direto ao projeto e aos pontos de atenção é útil; busca e filtros aguardam dados reais.
8. **Minimalismo:** métricas devem apoiar decisões, não dominar a tela.
9. **Recuperação de erros:** o protótipo carece de estados de erro de rede; documentar até haver integração.
10. **Ajuda:** rótulos e microtextos explicam o protótipo; ajuda contextual poderá ser adicionada quando os fluxos reais existirem.

## Decisões de design

Manter CSS puro e fontes do sistema. Usar poucas cores semânticas, espaçamento em escala curta e texto de corpo confortável. A conversa é o centro da página de projeto; o resumo é apoio. Reduzir tamanho e quantidade de texto decorativo que não ajuda a completar uma tarefa.
