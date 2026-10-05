import 'reflect-metadata';
import assert from 'node:assert/strict';
import test from 'node:test';
import { ConversationsService } from './conversations.service';
import { ConversationRepository, MessageRecord } from './conversation.repository';
import { ProjectRepository, ProjectRecord } from '../projects/project.repository';
import { ProjectsService } from '../projects/projects.service';
import { AccessControlService } from '../common/auth/access-control.service';
import { OpenAIService } from '../ai/openai.service';
import { CheckInRepository } from '../check-ins/check-in.repository';
import { TechnicalProblemService } from '../technical-problems/technical-problem.service';
import { UserRepository } from '../users/user.repository';
import { ChatProjectCreation } from '../projects/chat-project-creation';

const creation: ChatProjectCreation = { name: 'Cobrança', description: null, leaderName: 'Marina', teamName: null };
function harness(outputs: Array<{ projectCreation?: ChatProjectCreation; work?: boolean }>, role: 'MEMBER' | 'LEADER' | 'ADMIN' = 'MEMBER') {
  const messages: MessageRecord[] = [];
  const records: ProjectRecord[] = [];
  const checkIns: Array<Parameters<CheckInRepository['create']>[0]> = [];
  const links: string[] = [];
  const calls: Array<Parameters<OpenAIService['extractProjectContexts']>> = [];
  const projectRepo = {
    findCreationTeams: async () => [{ id: 'team', name: 'Equipe', leaders: [{ id: 'marina', name: 'Marina', role: 'LEADER' }] }],
    findTeam: async () => ({ id: 'team' }),
    findTeamMember: async (_team: string, id: string) => ({ userId: id, role: id === 'marina' ? 'LEADER' : 'MEMBER' }),
    list: async () => records,
    listMembers: async () => [],
    create: async (data: Parameters<ProjectRepository['create']>[0]) => {
      const now = new Date();
      const record = { ...data, id: 'new-project', status: 'ACTIVE', createdAt: now, updatedAt: now, members: [] };
      records.push(record); return record;
    },
  } as unknown as ProjectRepository;
  const access: AccessControlService = { isAdmin: async () => role === 'ADMIN', isTeamMember: async () => true, isTeamLeader: async () => role === 'LEADER' };
  const conversations = {
    findDailyConversation: async () => ({ id: 'conversation', userId: 'ryan' }),
    findPendingSuggestions: async () => [],
    findConversationMessages: async (_conversation: string, _user: string, limit: number) => messages.slice(-limit),
    linkProject: async (_conversation: string, id: string) => { links.push(id); },
    createMessage: async (data: Parameters<ConversationRepository['createMessage']>[0]) => {
      const message = { ...data, id: `message-${messages.length}`, role: data.role ?? 'USER', createdAt: new Date() };
      messages.push(message); return message;
    },
  } as unknown as ConversationRepository;
  const ai = { extractProjectContexts: async (...args: Parameters<OpenAIService['extractProjectContexts']>) => {
    calls.push(args); const output = outputs.shift() ?? {};
    return { projectCreation: output.projectCreation, assistantResponse: 'Entendi.', projects: output.work ? [{
      projectId: 'new-project', summary: 'Configuração iniciada.', difficulties: null, nextSteps: null,
      classification: 'NO_PROBLEM', normalizedProblem: null,
    }] : [] };
  } } as unknown as OpenAIService;
  const checks = { findDailyByUserAndProject: async () => null,
    create: async (data: Parameters<CheckInRepository['create']>[0]) => { checkIns.push(data); } } as unknown as CheckInRepository;
  const service = new ConversationsService(projectRepo, ai, conversations, checks, {} as TechnicalProblemService, access,
    { findById: async () => ({ id: 'ryan', name: 'Ryan', role }) } as unknown as UserRepository, new ProjectsService(projectRepo, access));
  return { service, records, messages, checkIns, links, calls };
}

test('fluxo real do service usa uma extração, cria projeto e confirma só depois da persistência, sem CheckIn no pedido', async () => {
  const h = harness([{ projectCreation: creation }]);
  const response = await h.service.separateMessageByProject('ryan', 'Cria um projeto chamado Cobrança e coloca Marina como líder.');
  assert.equal(h.calls.length, 1); assert.equal(h.records.length, 1);
  assert.equal(h.records[0].createdBy, 'ryan'); assert.equal(h.records[0].responsibleUserId, 'ryan');
  assert.equal(h.records[0].leaderId, 'marina'); assert.deepEqual(h.links, ['new-project']);
  assert.match(response.assistantMessage.content, /Projeto Cobrança criado/);
  assert.deepEqual(response.projects, []); assert.equal(h.checkIns.length, 0);
});

test('multi-turno nome e resposta curta de líder usam os dez turnos sem tabela pending nova', async () => {
  const h = harness([
    { projectCreation: { ...creation, name: null, leaderName: null } },
    { projectCreation: { ...creation, leaderName: null } }, { projectCreation: creation },
  ]);
  const first = await h.service.separateMessageByProject('ryan', 'Quero criar um projeto novo.');
  assert.match(first.assistantMessage.content, /nome.*líder/); assert.equal(h.records.length, 0);
  const second = await h.service.separateMessageByProject('ryan', 'Cobrança.');
  assert.match(second.assistantMessage.content, /Quem será o líder/); assert.equal(h.records.length, 0);
  await h.service.separateMessageByProject('ryan', 'a Marina');
  assert.equal(h.records.length, 1);
  assert.ok(h.calls.every(call => call[3]?.projectCreationAllowed));
  assert.equal(h.calls[2][2]?.length, 4);
});

test('request/clique duplicado na Conversation é serializado e não cria dois projetos', async () => {
  const h = harness([{ projectCreation: creation }, { projectCreation: creation }]);
  const responses = await Promise.all([1, 2].map(() => h.service.separateMessageByProject('ryan', 'Cria Cobrança com Marina.')));
  assert.equal(h.records.length, 1); assert.equal(h.calls.length, 2);
  assert.ok(responses.some(response => /Já existe/.test(response.assistantMessage.content)));
});

test('novo projeto ACTIVE recebe atualização e vínculo Message-CheckIn na mensagem seguinte', async () => {
  const h = harness([{ projectCreation: creation }, { work: true }]);
  await h.service.separateMessageByProject('ryan', 'Cria Cobrança com Marina.');
  const response = await h.service.separateMessageByProject('ryan', 'Hoje iniciei a configuração da Cobrança.');
  assert.equal(response.projects[0].projectId, 'new-project');
  assert.equal(h.checkIns[0].projectId, 'new-project'); assert.equal(h.checkIns[0].userId, 'ryan');
  assert.deepEqual(h.checkIns[0].messageIds, [response.messageId]);
  assert.equal(h.calls[1][1][0].id, 'new-project'); assert.equal(h.calls[1][3]?.projectCreationAllowed, false);
});

test('mesmo com ação indevida do provider, hipótese não cria nem solicita dados do diretório', async () => {
  const h = harness([{ projectCreation: creation }]);
  await h.service.separateMessageByProject('ryan', 'Talvez futuramente a gente possa criar um projeto de cobrança.');
  assert.equal(h.records.length, 0); assert.equal(h.calls[0][3]?.projectCreationAllowed, false);
});

for (const role of ['LEADER', 'ADMIN'] as const) {
  test(`${role} mantém consulta e não executa criação mesmo com ação retornada pelo provider`, async () => {
    const h = harness([{ projectCreation: creation }], role);
    await h.service.separateMessageByProject('ryan', 'Cria um projeto Cobrança.');
    assert.equal(h.records.length, 0); assert.equal(h.checkIns.length, 0);
    assert.equal(h.calls[0][3]?.authenticatedUser.role, role);
    assert.equal(h.calls[0][3]?.projectCreationAllowed, undefined);
  });
}
