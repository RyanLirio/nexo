import assert from 'node:assert/strict';
import test from 'node:test';
import { OpenAIService } from '../ai/openai.service';
import { TechnicalProblemService } from '../technical-problems/technical-problem.service';
import { AccessControlService } from '../common/auth/access-control.service';
import {
  CheckInRecord,
  CheckInRepository,
} from '../check-ins/check-in.repository';
import { ProjectRepository } from '../projects/project.repository';
import {
  SimilarTechnicalProblem,
  TechnicalProblemRepository,
} from '../technical-problems/technical-problem.repository';
import {
  ConversationRepository,
  MessageRecord,
} from './conversation.repository';
import { ConversationsService } from './conversations.service';

type CheckInCreateData = Parameters<CheckInRepository['create']>[0];
type CheckInUpdateData = Parameters<CheckInRepository['updateContext']>[1];
type ProjectContextInput = Parameters<
  OpenAIService['extractProjectContexts']
>[1];

interface ExtractedProjectContext {
  projectId: string;
  summary: string;
  difficulties: string | null;
  nextSteps: string | null;
  classification: 'NO_PROBLEM' | 'DIFFICULTY' | 'TECHNICAL_PROBLEM';
  normalizedProblem: string | null;
}

interface TestProject {
  id: string;
  name: string;
  description?: string | null;
}

interface UpdatedCheckIn {
  id: string;
  data: CheckInUpdateData;
}

function checkInRecord(
  projectId: string,
  values: Partial<CheckInRecord> = {},
): CheckInRecord {
  const timestamp = new Date('2026-10-01T12:00:00.000Z');
  return {
    id: `check-in-${projectId}`,
    projectId,
    userId: 'user-1',
    summary: 'Contexto anterior',
    difficulties: null,
    nextSteps: null,
    createdAt: timestamp,
    updatedAt: timestamp,
    ...values,
  };
}

function createHarness(options: {
  projects: TestProject[];
  extractions: ExtractedProjectContext[][];
  existingCheckIns?: CheckInRecord[];
  similarProblems?: SimilarTechnicalProblem[];
}) {
  const checkIns = new Map(
    (options.existingCheckIns ?? []).map((checkIn) => [
      checkIn.projectId,
      checkIn,
    ]),
  );
  const createdCheckIns: CheckInCreateData[] = [];
  const updatedCheckIns: UpdatedCheckIn[] = [];
  const linkedProjects: string[] = [];
  const projectContextsSentToAi: ProjectContextInput[] = [];
  const embeddingInputs: string[] = [];
  const semanticSearches: Array<{
    userId: string;
    embedding: number[];
    limit?: number;
    threshold?: number;
  }> = [];
  let extractionIndex = 0;
  let messageIndex = 0;
  let extractionCalls = 0;

  const projectRepo = {
    list: async () => options.projects,
  } as unknown as ProjectRepository;

  const openAIService = {
    extractProjectContexts: async (
      _message: string,
      projects: ProjectContextInput,
    ) => {
      extractionCalls += 1;
      projectContextsSentToAi.push(projects);
      const extraction = options.extractions[extractionIndex];
      extractionIndex += 1;
      return { projects: extraction };
    },
    generateEmbedding: async (text: string) => {
      embeddingInputs.push(text);
      return Array.from({ length: 1536 }, () => 0.01);
    },
  } as unknown as OpenAIService;

  const conversationRepo = {
    findDailyConversation: async () => ({
      id: 'conversation-1',
      userId: 'user-1',
      createdAt: new Date(),
      updatedAt: new Date(),
    }),
    createMessage: async (data: {
      conversationId: string;
      senderId: string;
      content: string;
    }): Promise<MessageRecord> => {
      messageIndex += 1;
      return {
        id: `message-${messageIndex}`,
        conversationId: data.conversationId,
        senderId: data.senderId,
        role: 'USER',
        content: data.content,
        createdAt: new Date(),
      };
    },
    linkProject: async (_conversationId: string, projectId: string) => {
      linkedProjects.push(projectId);
    },
  } as unknown as ConversationRepository;

  const checkInRepo = {
    findDailyByUserAndProject: async (
      _userId: string,
      projectId: string,
    ) => checkIns.get(projectId) ?? null,
    create: async (data: CheckInCreateData) => {
      createdCheckIns.push(data);
      const created = checkInRecord(data.projectId, {
        summary: data.summary,
        difficulties: data.difficulties ?? null,
        nextSteps: data.nextSteps ?? null,
      });
      checkIns.set(data.projectId, created);
      return created;
    },
    updateContext: async (id: string, data: CheckInUpdateData) => {
      updatedCheckIns.push({ id, data });
      const current = [...checkIns.values()].find(
        (checkIn) => checkIn.id === id,
      );
      assert.ok(current);
      const updated = {
        ...current,
        summary: data.summary,
        difficulties: data.difficulties,
        nextSteps: data.nextSteps,
      };
      checkIns.set(current.projectId, updated);
      return updated;
    },
  } as unknown as CheckInRepository;

  const technicalProblemRepo = {
    searchSimilar: async (
      userId: string,
      embedding: number[],
      limit?: number,
      threshold?: number,
    ) => {
      semanticSearches.push({ userId, embedding, limit, threshold });
      return options.similarProblems ?? [];
    },
  } as unknown as TechnicalProblemRepository;

  return {
    service: new ConversationsService(
      projectRepo,
      openAIService,
      conversationRepo,
      checkInRepo,
      new TechnicalProblemService(technicalProblemRepo, openAIService, {} as AccessControlService),
    ),
    createdCheckIns,
    updatedCheckIns,
    linkedProjects,
    projectContextsSentToAi,
    embeddingInputs,
    semanticSearches,
    extractionCallCount: () => extractionCalls,
  };
}

test('cria CheckIn com avanço, dificuldade e próximo passo', async () => {
  const harness = createHarness({
    projects: [{ id: 'project-1', name: 'Portal' }],
    extractions: [[{
      projectId: 'project-1',
      summary: 'A integração bancária foi concluída.',
      difficulties: 'O ambiente de homologação está instável.',
      nextSteps: 'Validar os retornos bancários amanhã.',
      classification: 'TECHNICAL_PROBLEM',
      normalizedProblem: 'O ambiente de homologação está instável durante a integração bancária.',
    }]],
  });

  const result = await harness.service.separateMessageByProject(
    'user-1',
    'Concluí a integração, mas a homologação está instável. Amanhã validarei os retornos.',
  );

  assert.deepEqual(harness.createdCheckIns[0], {
    projectId: 'project-1',
    userId: 'user-1',
    summary: 'A integração bancária foi concluída.',
    difficulties: 'O ambiente de homologação está instável.',
    nextSteps: 'Validar os retornos bancários amanhã.',
    messageIds: ['message-1'],
  });
  assert.deepEqual(result.projects[0], {
    projectId: 'project-1',
    summary: 'A integração bancária foi concluída.',
    difficulties: 'O ambiente de homologação está instável.',
    nextSteps: 'Validar os retornos bancários amanhã.',
    classification: 'TECHNICAL_PROBLEM',
    normalizedProblem: 'O ambiente de homologação está instável durante a integração bancária.',
    similarProblems: [],
  });
  assert.deepEqual(harness.embeddingInputs, [
    'O ambiente de homologação está instável durante a integração bancária.',
  ]);
});

test('cria CheckIn sem dificuldade quando a mensagem não relata uma', async () => {
  const harness = createHarness({
    projects: [{ id: 'project-1', name: 'Portal' }],
    extractions: [[{
      projectId: 'project-1',
      summary: 'A tela de login foi finalizada.',
      difficulties: null,
      nextSteps: 'Iniciar a tela de cadastro.',
      classification: 'NO_PROBLEM',
      normalizedProblem: null,
    }]],
  });

  const result = await harness.service.separateMessageByProject(
    'user-1',
    'Finalizei o login e agora vou iniciar o cadastro.',
  );

  assert.equal(harness.createdCheckIns[0].difficulties, null);
  assert.equal(
    harness.createdCheckIns[0].nextSteps,
    'Iniciar a tela de cadastro.',
  );
  assert.equal(result.projects[0].classification, 'NO_PROBLEM');
  assert.equal(result.projects[0].normalizedProblem, null);
  assert.equal(harness.semanticSearches.length, 0);
});

test('classifica dificuldade sem causa técnica concreta por projeto', async () => {
  const harness = createHarness({
    projects: [{ id: 'project-finance', name: 'Automação Financeira' }],
    extractions: [[{
      projectId: 'project-finance',
      summary: 'Há um bloqueio na autenticação com o Protheus.',
      difficulties: 'O usuário não está conseguindo autenticar no Protheus.',
      nextSteps: null,
      classification: 'DIFFICULTY',
      normalizedProblem: null,
    }]],
  });

  const result = await harness.service.separateMessageByProject(
    'user-1',
    'Na Automação Financeira não estou conseguindo autenticar no Protheus.',
  );

  assert.equal(result.projects[0].classification, 'DIFFICULTY');
  assert.equal(result.projects[0].normalizedProblem, null);
  assert.equal(harness.semanticSearches.length, 0);
  assert.equal(
    harness.createdCheckIns[0].difficulties,
    'O usuário não está conseguindo autenticar no Protheus.',
  );
});

test('segunda mensagem do mesmo projeto atualiza o CheckIn diário e vincula a nova Message', async () => {
  const harness = createHarness({
    projects: [{ id: 'project-1', name: 'Portal' }],
    extractions: [
      [{
        projectId: 'project-1',
        summary: 'A autenticação foi implementada.',
        difficulties: null,
        nextSteps: 'Testar a autenticação.',
        classification: 'NO_PROBLEM',
        normalizedProblem: null,
      }],
      [{
        projectId: 'project-1',
        summary: 'A autenticação foi implementada e os testes começaram.',
        difficulties: 'O token está expirando antes da requisição.',
        nextSteps: null,
        classification: 'TECHNICAL_PROBLEM',
        normalizedProblem: 'O token expira antes da requisição durante a autenticação.',
      }],
    ],
  });

  await harness.service.separateMessageByProject(
    'user-1',
    'Implementei a autenticação e vou testá-la.',
  );
  const result = await harness.service.separateMessageByProject(
    'user-1',
    'Comecei os testes, mas o token expira antes da requisição.',
  );

  assert.equal(harness.createdCheckIns.length, 1);
  assert.deepEqual(harness.updatedCheckIns[0].data, {
    summary: 'A autenticação foi implementada e os testes começaram.',
    difficulties: 'O token está expirando antes da requisição.',
    nextSteps: 'Testar a autenticação.',
    messageId: 'message-2',
  });
  assert.deepEqual(harness.projectContextsSentToAi[1][0], {
    id: 'project-1',
    name: 'Portal',
    description: undefined,
    currentSummary: 'A autenticação foi implementada.',
    currentDifficulties: null,
    currentNextSteps: 'Testar a autenticação.',
  });
  assert.equal(result.projects[0].classification, 'TECHNICAL_PROBLEM');
  assert.equal(
    result.projects[0].normalizedProblem,
    'O token expira antes da requisição durante a autenticação.',
  );
});

test('nova mensagem não apaga dificuldade ou próximo passo anteriores quando não os menciona', async () => {
  const harness = createHarness({
    projects: [{ id: 'project-1', name: 'Portal' }],
    existingCheckIns: [checkInRecord('project-1', {
      difficulties: 'O certificado de homologação expirou.',
      nextSteps: 'Solicitar um novo certificado.',
    })],
    extractions: [[{
      projectId: 'project-1',
      summary: 'O contexto anterior foi preservado e a documentação da integração foi atualizada.',
      difficulties: null,
      nextSteps: null,
      classification: 'NO_PROBLEM',
      normalizedProblem: null,
    }]],
  });

  const result = await harness.service.separateMessageByProject(
    'user-1',
    'Atualizei a documentação da integração.',
  );

  assert.deepEqual(harness.updatedCheckIns[0].data, {
    summary: 'O contexto anterior foi preservado e a documentação da integração foi atualizada.',
    difficulties: 'O certificado de homologação expirou.',
    nextSteps: 'Solicitar um novo certificado.',
    messageId: 'message-1',
  });
  assert.equal(
    result.projects[0].difficulties,
    'O certificado de homologação expirou.',
  );
  assert.equal(
    result.projects[0].nextSteps,
    'Solicitar um novo certificado.',
  );
});

test('mantém contextos isolados quando uma mensagem menciona dois projetos', async () => {
  const harness = createHarness({
    projects: [
      { id: 'project-finance', name: 'Financeiro' },
      { id: 'project-portal', name: 'Portal' },
    ],
    similarProblems: [{
      id: 'problem-from-another-project',
      projectId: 'project-legacy',
      problem: 'A aplicação falha ao enviar requisições no Safari.',
      solution: 'Atualizar o tratamento do cabeçalho no cliente HTTP.',
      technology: 'Safari',
      author: { id: 'user-2', name: 'Gustavo' },
      similarity: 0.84,
    }],
    extractions: [[
      {
        projectId: 'project-finance',
        summary: 'A conciliação bancária foi concluída.',
        difficulties: null,
        nextSteps: 'Validar o relatório financeiro.',
        classification: 'NO_PROBLEM',
        normalizedProblem: null,
      },
      {
        projectId: 'project-portal',
        summary: 'A revisão do login foi iniciada.',
        difficulties: 'O login falha no navegador Safari.',
        nextSteps: null,
        classification: 'TECHNICAL_PROBLEM',
        normalizedProblem: 'O login falha no navegador Safari no Portal.',
      },
    ]],
  });

  const result = await harness.service.separateMessageByProject(
    'user-1',
    'Concluí a conciliação no Financeiro e comecei o login do Portal, que falha no Safari.',
  );

  const finance = harness.createdCheckIns.find(
    (checkIn) => checkIn.projectId === 'project-finance',
  );
  const portal = harness.createdCheckIns.find(
    (checkIn) => checkIn.projectId === 'project-portal',
  );

  assert.deepEqual(finance, {
    projectId: 'project-finance',
    userId: 'user-1',
    summary: 'A conciliação bancária foi concluída.',
    difficulties: null,
    nextSteps: 'Validar o relatório financeiro.',
    messageIds: ['message-1'],
  });
  assert.deepEqual(portal, {
    projectId: 'project-portal',
    userId: 'user-1',
    summary: 'A revisão do login foi iniciada.',
    difficulties: 'O login falha no navegador Safari.',
    nextSteps: null,
    messageIds: ['message-1'],
  });
  assert.deepEqual(harness.linkedProjects.sort(), [
    'project-finance',
    'project-portal',
  ]);
  assert.deepEqual(
    result.projects.map((project) => ({
      projectId: project.projectId,
      classification: project.classification,
    })),
    [
      { projectId: 'project-finance', classification: 'NO_PROBLEM' },
      { projectId: 'project-portal', classification: 'TECHNICAL_PROBLEM' },
    ],
  );
  assert.equal(harness.extractionCallCount(), 1);
  assert.deepEqual(harness.embeddingInputs, [
    'O login falha no navegador Safari no Portal.',
  ]);
  assert.deepEqual(result.projects[0].similarProblems, []);
  assert.equal(result.projects[1].similarProblems[0].similarity, 0.84);
  assert.equal(
    result.projects[1].similarProblems[0].projectId,
    'project-legacy',
  );
  assert.equal(harness.semanticSearches[0].limit, 5);
  assert.equal(harness.semanticSearches[0].threshold, 0.78);
  assert.equal(harness.semanticSearches[0].userId, 'user-1');
});
