export interface FunctionToolDefinition {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: {
      type: 'object';
      properties: Record<string, unknown>;
      required?: string[];
      additionalProperties?: boolean;
    };
  };
}

export const AI_TOOL_DEFINITIONS: FunctionToolDefinition[] = [
  {
    type: 'function',
    function: {
      name: 'get_user_projects',
      description: 'Retorna a lista de projetos ativos em que o desenvolvedor participa como líder ou membro.',
      parameters: {
        type: 'object',
        properties: {},
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_project_context',
      description: 'Retorna o contexto consolidado de um projeto em uma única chamada (metadados, prioridade, prazo estimado, membros, último check-in diário e problemas técnicos abertos).',
      parameters: {
        type: 'object',
        properties: {
          projectId: {
            type: 'string',
            description: 'Identificador do projeto.',
          },
        },
        required: ['projectId'],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_recent_messages',
      description: 'Retorna o histórico recente de mensagens da conversa entre o desenvolvedor e o Nexo para sintetizar o check-in.',
      parameters: {
        type: 'object',
        properties: {
          limit: {
            type: 'integer',
            description: 'Quantidade máxima de mensagens a retornar (padrão 10).',
          },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'search_knowledge_base',
      description: 'Busca na base de conhecimento problemas técnicos e soluções já aprovadas e compartilhadas.',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'Termo de busca textual para encontrar problemas ou tecnologias semelhantes.',
          },
          projectId: {
            type: 'string',
            description: 'Filtrar opcionalmente por um projeto específico.',
          },
        },
        required: ['query'],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'save_checkin',
      description: 'Cria ou atualiza o check-in diário do desenvolvedor para um projeto específico.',
      parameters: {
        type: 'object',
        properties: {
          projectId: {
            type: 'string',
            description: 'Identificador do projeto.',
          },
          summary: {
            type: 'string',
            description: 'Resumo das atividades e avanços realizados no dia.',
          },
          difficulties: {
            type: 'string',
            description: 'Dificuldades, impedimentos ou gargalos encontrados.',
          },
          nextSteps: {
            type: 'string',
            description: 'Próximos passos planejados para o dia seguinte.',
          },
        },
        required: ['projectId', 'summary'],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'manage_technical_problem',
      description: 'Cria um novo problema técnico no projeto ou registra a solução de um problema técnico existente.',
      parameters: {
        type: 'object',
        properties: {
          action: {
            type: 'string',
            enum: ['create', 'resolve'],
            description: 'Ação a ser executada: criar novo problema ("create") ou registrar solução de existente ("resolve").',
          },
          projectId: {
            type: 'string',
            description: 'Identificador do projeto.',
          },
          problemId: {
            type: 'string',
            description: 'Identificador do problema técnico (obrigatório se action="resolve").',
          },
          title: {
            type: 'string',
            description: 'Título curto do problema técnico (necessário se action="create").',
          },
          problem: {
            type: 'string',
            description: 'Descrição técnica detalhada do problema (necessário se action="create").',
          },
          technology: {
            type: 'string',
            description: 'Tecnologia ou biblioteca relacionada ao problema.',
          },
          solution: {
            type: 'string',
            description: 'Solução identificada ou aplicada para contornar o problema.',
          },
        },
        required: ['action', 'projectId'],
        additionalProperties: false,
      },
    },
  },
];
