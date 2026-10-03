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
  TechnicalProblemRecord,
  TechnicalProblemRepository,
} from '../technical-problems/technical-problem.repository';
import {
  ConversationRepository,
  MessageRecord,
  PendingSolutionSuggestionInput,
  PendingSolutionSuggestionRecord,
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
  similarProblemsByText?: Record<string, SimilarTechnicalProblem[]>;
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
  const savedMessages: MessageRecord[] = [];
  const pendingSuggestions = new Map<string, PendingSolutionSuggestionRecord>();
  const knowledgeReads: string[] = [];
  const knowledgeRecords = new Map<string, TechnicalProblemRecord>(
    [...(options.similarProblems ?? []), ...Object.values(options.similarProblemsByText ?? {}).flat()]
      .map((candidate) => [candidate.id, {
        ...candidate, authorId: candidate.author.id, title: 'Problema conhecido',
        sharingAuthorizedAt: new Date(), createdAt: new Date(), updatedAt: new Date(),
      }]),
  );
  let canReadKnowledge = true;
  let pendingVersion = 0;
  const semanticSearches: Array<{
    userId: string;
    embedding: number[];
    limit?: number;
    threshold?: number;
  }> = [];
  let extractionIndex = 0;
  let messageIndex = 0;
  let assistantIndex = 0;
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
      const embedding = Array.from({ length: 1536 }, () => 0.01);
      embedding[0] = embeddingInputs.length;
      return embedding;
    },
  } as unknown as OpenAIService;

  const conversationRepo = {
    findDailyConversation: async (userId: string) => ({
      id: userId === 'user-1' ? 'conversation-1' : 'conversation-2',
      userId,
      createdAt: new Date(),
      updatedAt: new Date(),
    }),
    createMessage: async (data: Parameters<ConversationRepository['createMessage']>[0]): Promise<MessageRecord> => {
      const role = data.role ?? 'USER';
      if (role === 'USER') messageIndex += 1;
      else assistantIndex += 1;
      const saved = {
        id: role === 'USER' ? `message-${messageIndex}` : `assistant-${assistantIndex}`,
        conversationId: data.conversationId,
        senderId: data.senderId,
        role,
        content: data.content,
        createdAt: new Date(),
      };
      savedMessages.push(saved);
      return saved;
    },
    linkProject: async (_conversationId: string, projectId: string) => {
      linkedProjects.push(projectId);
    },
    savePendingSuggestion: async (data: PendingSolutionSuggestionInput) => {
      const slot = `${data.userId}:${data.conversationId}:${data.projectId}`;
      pendingVersion += 1;
      const saved: PendingSolutionSuggestionRecord = {
        ...data, id: slot, status: 'PENDING', createdAt: new Date(), updatedAt: new Date(pendingVersion),
      };
      pendingSuggestions.set(slot, saved);
      return saved;
    },
    findPendingSuggestions: async (userId: string, conversationId: string) => [...pendingSuggestions.values()]
      .filter((row) => row.userId === userId && row.conversationId === conversationId && row.status === 'PENDING')
      .map((row) => ({
        ...row,
        projectName: options.projects.find((project) => project.id === row.projectId)?.name ?? row.projectId,
      })),
    completeSuggestion: async (snapshot: PendingSolutionSuggestionRecord, status: 'ACCEPTED' | 'DECLINED', content: string) => {
      const current = pendingSuggestions.get(snapshot.id);
      if (!current || current.status !== 'PENDING' || current.updatedAt.getTime() !== snapshot.updatedAt.getTime()) return null;
      pendingSuggestions.set(snapshot.id, { ...current, status });
      assistantIndex += 1;
      const saved: MessageRecord = {
        id: `assistant-${assistantIndex}`, conversationId: snapshot.conversationId,
        role: 'ASSISTANT', content, createdAt: new Date(),
      };
      savedMessages.push(saved);
      return saved;
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
    findById: async (id: string) => {
      knowledgeReads.push(id);
      return knowledgeRecords.get(id) ?? null;
    },
    findProjectTeamId: async () => 'knowledge-team',
    searchSimilar: async (
      userId: string,
      embedding: number[],
      limit?: number,
      threshold?: number,
    ) => {
      semanticSearches.push({ userId, embedding, limit, threshold });
      if (options.similarProblemsByText) {
        return options.similarProblemsByText[embeddingInputs[embedding[0] - 1]] ?? [];
      }
      return options.similarProblems ?? [];
    },
  } as unknown as TechnicalProblemRepository;

  return {
    service: new ConversationsService(
      projectRepo,
      openAIService,
      conversationRepo,
      checkInRepo,
      new TechnicalProblemService(technicalProblemRepo, openAIService, {
        isAdmin: async () => false,
        isTeamMember: async () => canReadKnowledge,
      } as unknown as AccessControlService),
    ),
    createdCheckIns,
    updatedCheckIns,
    linkedProjects,
    projectContextsSentToAi,
    embeddingInputs,
    semanticSearches,
    savedMessages,
    pendingSuggestions,
    knowledgeRecords,
    knowledgeReads,
    setKnowledgeAccess: (allowed: boolean) => { canReadKnowledge = allowed; },
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
    solutionSuggestion: null,
  });
  assert.deepEqual(harness.embeddingInputs, [
    'O ambiente de homologação está instável durante a integração bancária.',
  ]);
  assert.equal(harness.pendingSuggestions.size, 0);
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
  assert.equal(result.projects[0].solutionSuggestion, null);
  assert.equal(harness.semanticSearches.length, 0);
  assert.equal(harness.pendingSuggestions.size, 0);
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
  assert.equal(harness.pendingSuggestions.size, 0);
  assert.equal(result.projects[0].solutionSuggestion, null);
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
  assert.equal(result.projects[0].solutionSuggestion, null);
  assert.deepEqual(result.projects[1].solutionSuggestion, {
    available: true,
    technicalProblemId: 'problem-from-another-project',
    similarity: 0.84,
    technology: 'Safari',
  });
  assert.equal(JSON.stringify(result).includes('"solution"'), false);
  assert.equal(JSON.stringify(result).includes('Atualizar o tratamento'), false);
  assert.equal(harness.semanticSearches[0].limit, 5);
  assert.equal(harness.semanticSearches[0].threshold, 0.78);
  assert.equal(harness.semanticSearches[0].userId, 'user-1');
});

test('cada problema técnico mantém sua sugestão isolada sem expor soluções internas', async () => {
  const oauthProblem = 'O token OAuth expira antes da requisição ao Protheus.';
  const apiProblem = 'A API de boletos retorna erro 500.';
  const candidate = (id: string, problem: string, similarity: number): SimilarTechnicalProblem => ({
    id,
    projectId: 'project-knowledge',
    problem,
    solution: `SOLUÇÃO PRIVADA ${id}`,
    technology: null,
    author: { id: 'author-1', name: 'Autor' },
    similarity,
  });
  const oauthCandidates = [candidate('oauth-match', oauthProblem, 0.9), candidate('oauth-second', oauthProblem, 0.82)];
  const apiCandidates = [candidate('api-match', apiProblem, 0.85)];
  const harness = createHarness({
    projects: [{ id: 'finance', name: 'Financeiro' }, { id: 'portal', name: 'Portal' }],
    similarProblemsByText: { [oauthProblem]: oauthCandidates, [apiProblem]: apiCandidates },
    extractions: [[
      { projectId: 'finance', summary: 'Falha na autenticação.', difficulties: oauthProblem, nextSteps: null, classification: 'TECHNICAL_PROBLEM', normalizedProblem: oauthProblem },
      { projectId: 'portal', summary: 'Falha na emissão de boletos.', difficulties: apiProblem, nextSteps: null, classification: 'TECHNICAL_PROBLEM', normalizedProblem: apiProblem },
    ]],
  });

  const result = await harness.service.separateMessageByProject('user-1', 'No Financeiro o token expira; no Portal a API retorna 500.');

  assert.equal(oauthCandidates[0].solution, 'SOLUÇÃO PRIVADA oauth-match');
  assert.deepEqual(result.projects.map((project) => project.solutionSuggestion?.technicalProblemId), ['oauth-match', 'api-match']);
  assert.deepEqual(result.projects.map((project) => project.solutionSuggestion?.similarity), [0.9, 0.85]);
  assert.equal(harness.extractionCallCount(), 1);
  assert.deepEqual(harness.embeddingInputs, [oauthProblem, apiProblem]);
  const publicJson = JSON.stringify(result);
  assert.equal(publicJson.includes('"solution"'), false);
  assert.equal(publicJson.includes('similarProblems'), false);
  assert.equal(publicJson.includes('SOLUÇÃO PRIVADA'), false);
});

const knownSolution = 'Renovar o token OAuth antes da requisição.';
const knownCandidate: SimilarTechnicalProblem = {
  id: 'known-oauth', projectId: 'knowledge-project',
  problem: 'O token OAuth expira antes da requisição ao Protheus.',
  solution: knownSolution, technology: 'OAuth',
  author: { id: 'knowledge-author', name: 'Autor' }, similarity: 0.86,
};
const technicalContext: ExtractedProjectContext = {
  projectId: 'finance', summary: 'Falha na autenticação do Protheus.',
  difficulties: knownCandidate.problem, nextSteps: null,
  classification: 'TECHNICAL_PROBLEM', normalizedProblem: knownCandidate.problem,
};

function solutionHarness() {
  return createHarness({
    projects: [{ id: 'finance', name: 'Financeiro' }],
    similarProblems: [knownCandidate], extractions: [[technicalContext], []],
  });
}

function assertNoSolution(value: unknown) {
  const json = JSON.stringify(value);
  assert.equal(json.includes('"solution"'), false);
  assert.equal(json.includes(knownSolution), false);
}

test('match persiste PENDING sem solução/vetor e salva pergunta como Message ASSISTANT', async () => {
  const harness = solutionHarness();
  const response = await harness.service.separateMessageByProject('user-1', knownCandidate.problem);
  const pending = [...harness.pendingSuggestions.values()][0];
  assert.equal(pending.status, 'PENDING');
  assert.equal(pending.technicalProblemId, knownCandidate.id);
  assert.equal(pending.projectId, 'finance');
  assert.equal(pending.userId, 'user-1');
  assert.equal(pending.conversationId, response.conversationId);
  assert.equal('solution' in pending, false);
  assert.equal('problemEmbedding' in pending, false);
  assert.equal(response.assistantMessage.content, 'Encontrei um problema parecido. Quer ver a solução?');
  assert.deepEqual(harness.savedMessages.map((message) => message.role), ['USER', 'ASSISTANT']);
  assert.equal(harness.savedMessages[1].senderId, undefined);
  assertNoSolution(response);
});

for (const reply of ['sim', 'sim mostra', 'sim, mostra', 'mostra', 'pode mostrar', 'quero ver', 'quero a solução', 'manda', 'pode mandar', ' SIM, MOSTRA!!! ']) {
  test(`aceite "${reply}" revalida conhecimento e mostra solução sem nova IA`, async () => {
    const harness = solutionHarness();
    await harness.service.separateMessageByProject('user-1', knownCandidate.problem);
    const response = await harness.service.separateMessageByProject('user-1', reply);
    assert.equal([...harness.pendingSuggestions.values()][0].status, 'ACCEPTED');
    assert.deepEqual(response.acceptedSolution, {
      projectId: 'finance', technicalProblemId: knownCandidate.id, solution: knownSolution,
    });
    assert.equal(response.assistantMessage.role, 'ASSISTANT');
    assert.equal(response.assistantMessage.content, knownSolution);
    assert.deepEqual(harness.knowledgeReads, [knownCandidate.id]);
    assert.equal(harness.extractionCallCount(), 1);
    assert.equal(harness.embeddingInputs.length, 1);
    assert.equal(harness.createdCheckIns.length, 1);
    assert.equal(harness.savedMessages.at(-1)?.content, knownSolution);
  });
}

for (const reply of ['não', 'nao', 'agora não', 'agora nao', 'não precisa', 'nao precisa', 'deixa pra lá', 'deixa pra la']) {
  test(`recusa "${reply}" encerra sem ler ou revelar solução`, async () => {
    const harness = solutionHarness();
    await harness.service.separateMessageByProject('user-1', knownCandidate.problem);
    const response = await harness.service.separateMessageByProject('user-1', reply);
    assert.equal([...harness.pendingSuggestions.values()][0].status, 'DECLINED');
    assert.equal(response.assistantMessage.content, 'Sem problema. Seguimos por aqui.');
    assert.equal(harness.knowledgeReads.length, 0);
    assert.equal(harness.extractionCallCount(), 1);
    assertNoSolution(response);
  });
}

test('aceite após perder acesso à equipe não revela solução', async () => {
  const harness = solutionHarness();
  await harness.service.separateMessageByProject('user-1', knownCandidate.problem);
  harness.setKnowledgeAccess(false);
  const response = await harness.service.separateMessageByProject('user-1', 'sim');
  assert.equal(response.assistantMessage.content, 'Essa solução não está mais disponível para você.');
  assert.equal([...harness.pendingSuggestions.values()][0].status, 'DECLINED');
  assertNoSolution(response);
});

test('aceite revalida autorização de compartilhamento retirada depois da sugestão', async () => {
  const harness = solutionHarness();
  await harness.service.separateMessageByProject('user-1', knownCandidate.problem);
  const record = harness.knowledgeRecords.get(knownCandidate.id)!;
  harness.knowledgeRecords.set(record.id, { ...record, sharingAuthorizedAt: null });
  const response = await harness.service.separateMessageByProject('user-1', 'mostra');
  assert.equal([...harness.pendingSuggestions.values()][0].status, 'DECLINED');
  assertNoSolution(response);
});

for (const solution of [null, '   ']) {
  test(`aceite não revela solução que deixou de existir (${JSON.stringify(solution)})`, async () => {
    const harness = solutionHarness();
    await harness.service.separateMessageByProject('user-1', knownCandidate.problem);
    const record = harness.knowledgeRecords.get(knownCandidate.id)!;
    harness.knowledgeRecords.set(record.id, { ...record, solution });
    const response = await harness.service.separateMessageByProject('user-1', 'sim');
    assert.equal([...harness.pendingSuggestions.values()][0].status, 'DECLINED');
    assertNoSolution(response);
  });
}

test('um usuário não aceita pendência de outro usuário', async () => {
  const harness = solutionHarness();
  await harness.service.separateMessageByProject('user-1', knownCandidate.problem);
  const response = await harness.service.separateMessageByProject('user-2', 'sim');
  assert.equal([...harness.pendingSuggestions.values()][0].status, 'PENDING');
  assert.equal(harness.knowledgeReads.length, 0);
  assertNoSolution(response);
});

test('resposta ambígua não assume aceite nem recusa', async () => {
  const harness = solutionHarness();
  await harness.service.separateMessageByProject('user-1', knownCandidate.problem);
  const response = await harness.service.separateMessageByProject('user-1', 'talvez, depois');
  assert.equal([...harness.pendingSuggestions.values()][0].status, 'PENDING');
  assert.equal(harness.knowledgeReads.length, 0);
  assertNoSolution(response);
});

test('duas pendências e "sim" pedem o projeto, sem escolher candidato', async () => {
  const harness = createHarness({
    projects: [{ id: 'finance', name: 'Financeiro' }, { id: 'portal', name: 'Portal' }],
    similarProblems: [knownCandidate],
    extractions: [[technicalContext, { ...technicalContext, projectId: 'portal' }]],
  });
  await harness.service.separateMessageByProject('user-1', 'Falha técnica nos dois projetos.');
  const response = await harness.service.separateMessageByProject('user-1', 'sim');
  assert.equal(response.assistantMessage.content, 'Tenho soluções sugeridas para mais de um projeto. Para qual projeto você quer ver a solução?');
  assert.equal(harness.pendingSuggestions.size, 2);
  assert.ok([...harness.pendingSuggestions.values()].every((row) => row.status === 'PENDING'));
  assert.equal(harness.knowledgeReads.length, 0);
  assert.equal(harness.extractionCallCount(), 1);
  assertNoSolution(response);
});

function multipleSuggestionsHarness(projects: TestProject[] = [
  { id: 'finance', name: 'Automação Financeira' },
  { id: 'portal', name: 'Portal de Notas' },
]) {
  return createHarness({
    projects,
    similarProblems: [knownCandidate],
    extractions: [[
      { ...technicalContext, projectId: projects[0].id },
      { ...technicalContext, projectId: projects[1].id },
    ], []],
  });
}

for (const reply of ['Automação Financeira', 'a da Automação Financeira']) {
  test(`seleção única por projeto aceita a sugestão correta: "${reply}"`, async () => {
    const harness = multipleSuggestionsHarness();
    await harness.service.separateMessageByProject('user-1', 'Falha técnica nos dois projetos.');
    await harness.service.separateMessageByProject('user-1', 'sim');
    const response = await harness.service.separateMessageByProject('user-1', reply);
    const suggestions = [...harness.pendingSuggestions.values()];
    assert.equal(response.acceptedSolution?.projectId, 'finance');
    assert.equal(suggestions.find((row) => row.projectId === 'finance')?.status, 'ACCEPTED');
    assert.equal(suggestions.find((row) => row.projectId === 'portal')?.status, 'PENDING');
    assert.equal(response.assistantMessage.content, knownSolution);
    assert.equal(harness.savedMessages.at(-1)?.role, 'ASSISTANT');
  });
}

test('aceite com nome do projeto resolve em uma única mensagem', async () => {
  const harness = multipleSuggestionsHarness();
  await harness.service.separateMessageByProject('user-1', 'Falha técnica nos dois projetos.');
  const response = await harness.service.separateMessageByProject('user-1', 'sim, mostra a do Portal de Notas');
  const suggestions = [...harness.pendingSuggestions.values()];
  assert.equal(response.acceptedSolution?.projectId, 'portal');
  assert.equal(suggestions.find((row) => row.projectId === 'portal')?.status, 'ACCEPTED');
  assert.equal(suggestions.find((row) => row.projectId === 'finance')?.status, 'PENDING');
});

for (const [reply, projectId] of [
  ['dispensa a do Portal', 'portal'],
  ['não quero a da Automação Financeira', 'finance'],
  ['não precisa mostrar a do Portal de Notas', 'portal'],
] as const) {
  test(`recusa com projeto afeta somente o contexto identificado: "${reply}"`, async () => {
    const harness = multipleSuggestionsHarness();
    await harness.service.separateMessageByProject('user-1', 'Falha técnica nos dois projetos.');
    const response = await harness.service.separateMessageByProject('user-1', reply);
    const suggestions = [...harness.pendingSuggestions.values()];
    assert.equal(suggestions.find((row) => row.projectId === projectId)?.status, 'DECLINED');
    assert.equal(suggestions.find((row) => row.projectId !== projectId)?.status, 'PENDING');
    assert.equal(response.assistantMessage.content, 'Sem problema. Seguimos por aqui.');
    assertNoSolution(response);
  });
}

test('projeto desconhecido não escolhe pendência e lista opções sem vazar solução', async () => {
  const harness = multipleSuggestionsHarness();
  await harness.service.separateMessageByProject('user-1', 'Falha técnica nos dois projetos.');
  const response = await harness.service.separateMessageByProject('user-1', 'CRM');
  assert.match(response.assistantMessage.content, /Automação Financeira e Portal de Notas/);
  assert.ok([...harness.pendingSuggestions.values()].every((row) => row.status === 'PENDING'));
  assert.equal(harness.savedMessages.at(-1)?.role, 'ASSISTANT');
  assertNoSolution(response);
});

test('nome parcial comum a dois projetos permanece ambíguo', async () => {
  const harness = multipleSuggestionsHarness([
    { id: 'portal-notas', name: 'Portal de Notas' },
    { id: 'portal-financeiro', name: 'Portal Financeiro' },
  ]);
  await harness.service.separateMessageByProject('user-1', 'Falha técnica nos dois projetos.');
  const response = await harness.service.separateMessageByProject('user-1', 'Portal');
  assert.match(response.assistantMessage.content, /Não consegui identificar qual projeto/);
  assert.ok([...harness.pendingSuggestions.values()].every((row) => row.status === 'PENDING'));
  assertNoSolution(response);
});

test('nome de projeto sem pendência não redireciona aceite para a única pendência', async () => {
  const harness = solutionHarness();
  await harness.service.separateMessageByProject('user-1', knownCandidate.problem);
  const response = await harness.service.separateMessageByProject('user-1', 'quero a do Portal de Notas');
  assert.equal([...harness.pendingSuggestions.values()][0].status, 'PENDING');
  assert.match(response.assistantMessage.content, /A opção é: Financeiro/);
  assert.equal(harness.knowledgeReads.length, 0);
  assertNoSolution(response);
});

test('seleção por projeto continua revalidando acesso antes de revelar', async () => {
  const harness = multipleSuggestionsHarness();
  await harness.service.separateMessageByProject('user-1', 'Falha técnica nos dois projetos.');
  harness.setKnowledgeAccess(false);
  const response = await harness.service.separateMessageByProject('user-1', 'quero a solução da Automação Financeira');
  const suggestions = [...harness.pendingSuggestions.values()];
  assert.equal(suggestions.find((row) => row.projectId === 'finance')?.status, 'DECLINED');
  assert.equal(suggestions.find((row) => row.projectId === 'portal')?.status, 'PENDING');
  assert.equal(response.assistantMessage.content, 'Essa solução não está mais disponível para você.');
  assertNoSolution(response);
});

test('usuário não seleciona por nome pendência de outro usuário', async () => {
  const harness = multipleSuggestionsHarness();
  await harness.service.separateMessageByProject('user-1', 'Falha técnica nos dois projetos.');
  const response = await harness.service.separateMessageByProject('user-2', 'sim, mostra a da Automação Financeira');
  assert.ok([...harness.pendingSuggestions.values()].every((row) => row.status === 'PENDING'));
  assert.equal(harness.knowledgeReads.length, 0);
  assertNoSolution(response);
});

test('nova sugestão do mesmo contexto substitui somente sua pendência anterior', async () => {
  const another = { ...knownCandidate, id: 'new-oauth', problem: 'Outro problema técnico.', solution: 'Outra solução.' };
  const harness = createHarness({
    projects: [{ id: 'finance', name: 'Financeiro' }],
    similarProblemsByText: { [knownCandidate.problem]: [knownCandidate], [another.problem]: [another] },
    extractions: [[technicalContext], [{ ...technicalContext, normalizedProblem: another.problem }]],
  });
  await harness.service.separateMessageByProject('user-1', knownCandidate.problem);
  await harness.service.separateMessageByProject('user-1', another.problem);
  assert.equal(harness.pendingSuggestions.size, 1);
  assert.equal([...harness.pendingSuggestions.values()][0].technicalProblemId, another.id);
  const response = await harness.service.separateMessageByProject('user-1', 'sim');
  assert.equal(response.acceptedSolution?.solution, another.solution);
});

test('aceites concorrentes não revelam a mesma solução duas vezes', async () => {
  const harness = solutionHarness();
  await harness.service.separateMessageByProject('user-1', knownCandidate.problem);
  const results = await Promise.all([
    harness.service.separateMessageByProject('user-1', 'sim'),
    harness.service.separateMessageByProject('user-1', 'mostra'),
  ]);
  assert.equal(results.filter((response) => response.acceptedSolution).length, 1);
  assert.equal(harness.savedMessages.filter((message) => message.role === 'ASSISTANT' && message.content === knownSolution).length, 1);
});

test('mensagem vazia é rejeitada antes de persistência ou IA', async () => {
  const harness = solutionHarness();
  await assert.rejects(() => harness.service.separateMessageByProject('user-1', '   '), /Informe uma mensagem/);
  assert.equal(harness.savedMessages.length, 0);
});
