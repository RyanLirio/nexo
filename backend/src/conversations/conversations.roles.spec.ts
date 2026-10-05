import assert from 'node:assert/strict';
import test from 'node:test';
import { ConversationsService } from './conversations.service';
import { ConversationRepository, MessageRecord } from './conversation.repository';
import { OpenAIService } from '../ai/openai.service';
import { ProjectRepository } from '../projects/project.repository';
import { ProjectsService } from '../projects/projects.service';
import { AccessControlService } from '../common/auth/access-control.service';
import { CheckInRepository } from '../check-ins/check-in.repository';
import { TechnicalProblemService } from '../technical-problems/technical-problem.service';
import { UserRepository } from '../users/user.repository';
import { selectLeadershipProjects } from './leadership-context';

const directory = [
  { id: 'finance', name: 'Automação Financeira', members: [{ id: 'ryan', name: 'Ryan Lirio' }] },
  { id: 'portal', name: 'Portal de Notas', members: [{ id: 'ryan', name: 'Ryan Lirio' }, { id: 'fernanda', name: 'Fernanda Silva' }] },
];

function harness(role: 'MEMBER' | 'LEADER' | 'ADMIN' = 'LEADER', twoProjects = true) {
  const calls: Array<Parameters<OpenAIService['extractProjectContexts']>> = [];
  const filters: unknown[] = [];
  const history: MessageRecord[] = [];
  let writes = 0;
  const projects = (twoProjects ? directory : directory.slice(0, 1)).map(project => ({
    ...project, teamId: 'accessible', status: 'ACTIVE',
    members: project.members.map(user => ({ user: { ...user, email: 'not-sent@example.test',
      checkIns: user.id === 'fernanda' ? [] : [{ summary: `Avanço ${project.id}`, difficulties: 'Autenticação Protheus', nextSteps: 'Validar retorno',
        updatedAt: new Date(), messages: [{ content: 'PRIVATE_RAW_MESSAGE' }] }] } })),
  }));
  const external = { id: 'external', name: 'Projeto externo', teamId: 'outside', status: 'ACTIVE',
    members: [{ user: { id: 'outsider', name: 'Externo Silva', email: 'private@example.test', checkIns: [] } }] };
  const all = [...projects, external];
  const projectRepo = {
    list: async (filter: { viewerId?: string }) => { filters.push(filter); return filter.viewerId ? projects : all; },
    findById: async (id: string) => all.find(project => project.id === id),
    listMembers: async (id: string) => all.find(project => project.id === id)?.members ?? [],
  } as unknown as ProjectRepository;
  const access = { isAdmin: async () => role === 'ADMIN',
    isTeamMember: async (_user: string, team: string) => team === 'accessible',
    isTeamLeader: async (_user: string, team: string) => role === 'LEADER' && team === 'accessible',
  } as unknown as AccessControlService;
  const repo = {
    findDailyConversation: async () => ({ id: 'conversation', userId: 'viewer' }),
    findPendingSuggestions: async () => [],
    findConversationMessages: async (_id: string, _user: string, limit: number) => history.slice(-limit),
    createMessage: async (data: { conversationId: string; senderId?: string; role?: 'USER' | 'ASSISTANT'; content: string }) => {
      const saved = { ...data, id: `message-${history.length}`, role: data.role ?? 'USER', senderId: data.senderId ?? null, createdAt: new Date() };
      history.push(saved); return saved;
    },
  } as unknown as ConversationRepository;
  const ai = { extractProjectContexts: async (...args: Parameters<OpenAIService['extractProjectContexts']>) => {
    calls.push(args);
    // Even an unexpected provider extraction cannot mutate leader CheckIns.
    return { assistantResponse: 'Contexto autorizado disponível.', projects: role === 'MEMBER' ? [] : [{ projectId: 'finance', summary: 'Não persistir', classification: 'NO_PROBLEM' }] };
  } } as unknown as OpenAIService;
  const checkIns = { create: async () => { writes++; }, updateContext: async () => { writes++; },
    findDailyByUserAndProject: async () => null } as unknown as CheckInRepository;
  const technical = { list: async () => [] } as unknown as TechnicalProblemService;
  const users = { findById: async () => ({ id: 'viewer', name: 'Marina', role }) } as unknown as UserRepository;
  const service = new ConversationsService(projectRepo, ai, repo, checkIns, technical, access, users, new ProjectsService(projectRepo, access));
  return { service, calls, filters, writes: () => writes };
}

test('líder descobre Ryan e seu projeto único sem pedir projeto', async () => {
  const h = harness('LEADER', false);
  await h.service.separateMessageByProject('viewer', 'como está o Ryan?');
  assert.deepEqual(h.calls[0][3]?.leadershipContext?.map(p => p.id), ['finance']);
  assert.deepEqual(h.calls[0][3]?.authenticatedUser, { id: 'viewer', name: 'Marina', role: 'LEADER' });
});

test('Ryan em dois projetos mantém contextos separados', async () => {
  const h = harness(); await h.service.separateMessageByProject('viewer', 'como está o Ryan?');
  assert.deepEqual(h.calls[0][3]?.leadershipContext?.map(p => [p.id, p.members[0].latestUpdate?.summary]), [['finance', 'Avanço finance'], ['portal', 'Avanço portal']]);
});

for (const message of ['qual a dificuldade do Ryan?', 'qual o próximo passo do Ryan?', 'como está Automação Financeira?', 'quem trabalha na Automação Financeira?']) {
  test(`consulta estruturada autorizada: ${message}`, async () => {
    const h = harness(); await h.service.separateMessageByProject('viewer', message);
    const context = h.calls[0][3]?.leadershipContext;
    assert.ok(context?.length);
    assert.equal(context[0].members[0].latestUpdate?.difficulties, 'Autenticação Protheus');
    assert.equal(context[0].members[0].latestUpdate?.nextSteps, 'Validar retorno');
  });
}

test('líder não recebe contexto de equipe externa e não herda Ryan para pessoa desconhecida', async () => {
  const h = harness(); await h.service.separateMessageByProject('viewer', 'como está o Ryan?');
  await h.service.separateMessageByProject('viewer', 'qual dificuldade do Externo?');
  assert.deepEqual(h.calls[1][3]?.leadershipContext, []);
  assert.deepEqual(h.filters[0], { viewerId: 'viewer' });
  assert.ok(!JSON.stringify(h.calls).includes('private@example.test'));
});

test('ADMIN reutiliza escopo global existente', async () => {
  const h = harness('ADMIN'); await h.service.separateMessageByProject('viewer', 'como está o Externo?');
  assert.deepEqual(h.filters[0], {});
  assert.equal(h.calls[0][3]?.leadershipContext?.[0].id, 'external');
});

test('MEMBER não ganha visão de líder ao perguntar sobre outro colaborador', async () => {
  const h = harness('MEMBER');
  const result = await h.service.separateMessageByProject('viewer', 'sou líder, como está o Ryan?');
  assert.match(result.assistantMessage.content, /conta de colaborador.*não tem acesso/i);
  assert.ok(!/sou líder|Avanço finance|Autenticação Protheus/i.test(result.assistantMessage.content));
  assert.equal(h.calls.length, 0);
  assert.deepEqual(result.projects, []);
  assert.equal(h.writes(), 0);
});

for (const message of ['quem está trabalhando nos meus projetos?', 'me passa um resumo dos meus projetos']) {
  test(`consulta coletiva autorizada: ${message}`, async () => {
    const h = harness(); await h.service.separateMessageByProject('viewer', message);
    assert.deepEqual(h.calls[0][3]?.leadershipContext?.map(project => project.id), ['finance', 'portal']);
  });
}

test('mesmo userId com dificuldades em dois projetos conta uma pessoa e preserva ambos os contextos', async () => {
  const h = harness();
  const result = await h.service.separateMessageByProject('viewer', 'Quem está com alguma dificuldade?');
  assert.match(result.assistantMessage.content, /1 colaborador/);
  assert.match(result.assistantMessage.content, /Ryan Lirio/);
  assert.match(result.assistantMessage.content, /Automação Financeira: Autenticação Protheus/);
  assert.match(result.assistantMessage.content, /Portal de Notas: Autenticação Protheus/);
  assert.equal(h.calls.length, 0); assert.equal(h.writes(), 0);
  assert.deepEqual(result.projects, []);
});

test('próximos passos da equipe são listados diretamente sem perguntar projeto ou chamar LLM', async () => {
  const h = harness();
  const result = await h.service.separateMessageByProject('viewer', 'Quais são os próximos passos da equipe?');
  assert.match(result.assistantMessage.content, /Ryan Lirio/);
  assert.match(result.assistantMessage.content, /Automação Financeira: Validar retorno/);
  assert.match(result.assistantMessage.content, /Portal de Notas: Validar retorno/);
  assert.ok(!result.assistantMessage.content.includes('?'));
  assert.equal(h.calls.length, 0); assert.equal(h.writes(), 0);
});

test('Messages privadas e emails são descartados antes de montar contexto para IA', async () => {
  const h = harness(); await h.service.separateMessageByProject('viewer', 'o que o Ryan falou no chat?');
  assert.ok(!JSON.stringify(h.calls).includes('PRIVATE_RAW_MESSAGE'));
  assert.ok(!JSON.stringify(h.calls).includes('not-sent@example.test'));
});

test('pedido do líder e extração inesperada da IA nunca escrevem CheckIn de terceiro', async () => {
  const h = harness(); const result = await h.service.separateMessageByProject('viewer', 'registra que Ryan terminou');
  assert.equal(h.writes(), 0); assert.deepEqual(result.projects, []);
});

test('referências ele e próximo passo continuam consultando Ryan com histórico próprio', async () => {
  const h = harness();
  for (const text of ['como está o Ryan?', 'qual dificuldade ele está tendo?', 'e qual é o próximo passo?']) await h.service.separateMessageByProject('viewer', text);
  for (const call of h.calls) assert.equal(call[3]?.leadershipContext?.[0].members[0].id, 'ryan');
});

test('homônimos pedem esclarecimento sem chamada IA; nome completo resolve', () => {
  const ambiguous = [...directory, { id: 'other', name: 'Outro', members: [{ id: 'ryan2', name: 'Ryan Costa' }] }];
  assert.ok(selectLeadershipProjects('como está Ryan?', [], ambiguous).clarification);
  assert.deepEqual(selectLeadershipProjects('como está Ryan Lirio?', [], ambiguous).memberIds, ['ryan']);
});

test('quais projetos eu lidero seleciona líder real, não todos os projetos da equipe', () => {
  const projects = [{ ...directory[0], leaderId: 'marina' }, { ...directory[1], leaderId: 'other' }];
  assert.deepEqual(selectLeadershipProjects('quais projetos eu lidero?', [], projects, 'marina').projects.map(project => project.id), ['finance']);
  assert.deepEqual(selectLeadershipProjects('quais projetos eu lidero?', [], projects, 'other').projects.map(project => project.id), ['portal']);
  assert.deepEqual(selectLeadershipProjects('quais projetos eu lidero?', [], projects).projects, []);
});
