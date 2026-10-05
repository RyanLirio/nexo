import 'reflect-metadata';
import assert from 'node:assert/strict';
import test from 'node:test';
import { BadRequestException, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { ProjectsService } from './projects/projects.service';
import { ProjectRepository } from './projects/project.repository';
import { AccessControlService } from './common/auth/access-control.service';
import { resolveJwtSecret } from './common/auth/jwt-config';
import { CheckInsService } from './check-ins/check-ins.service';
import { CheckInRepository } from './check-ins/check-in.repository';
import { AuthService } from './auth/auth.service';
import { GoogleTokenVerifier } from './auth/google-verifier';
import { UserRepository } from './users/user.repository';
import { PrismaConversationRepository } from './conversations/prisma-conversation.repository';
import { PrismaService } from './prisma.service';
import { HelpRequestsService } from './help-requests/help-requests.service';
import { HelpRequestRepository } from './help-requests/help-request.repository';
import { PrismaCheckInRepository } from './check-ins/prisma-check-in.repository';

const denied = { isAdmin: async () => false, isTeamMember: async () => false } as unknown as AccessControlService;
for (const operation of ['status', 'update', 'addMember', 'removeMember', 'create']) {
  test(`escrita de projeto ${operation} rejeita equipe externa antes de persistir`, async () => {
    const service = new ProjectsService({ findById: async () => ({ id: 'p', teamId: 'foreign' }), findTeam: async () => ({ id: 'foreign' }) } as unknown as ProjectRepository, denied);
    const action = operation === 'status' ? service.changeStatus('p', { status: 'PAUSED' }, 'u')
      : operation === 'update' ? service.update('p', { name: 'x' }, 'u')
      : operation === 'addMember' ? service.addMember('p', { userId: 'v' }, 'u')
      : operation === 'removeMember' ? service.removeMember('p', 'v', 'u')
      : service.create({ teamId: 'foreign', name: 'x' }, 'u');
    await assert.rejects(action, ForbiddenException);
  });
}
test('criador do projeto não pode ser forjado pelo body', async () => {
  const service = new ProjectsService({ findTeam: async () => ({ id: 't' }) } as unknown as ProjectRepository, { isAdmin: async () => false, isTeamMember: async () => true, isTeamLeader: async () => false });
  await assert.rejects(service.create({ teamId: 't', name: 'x', createdBy: 'other' }, 'u'), ForbiddenException);
});
for (const operation of ['create', 'saveCheckIn'] as const) {
  test(`CheckIn ${operation} bloqueia identidade forjada`, async () => {
    const service = new CheckInsService({} as CheckInRepository);
    await assert.rejects(service[operation]('p', { userId: 'other', summary: 'x' }, 'u'), ForbiddenException);
  });
  test(`CheckIn ${operation} bloqueia vínculo com Message privada alheia`, async () => {
    const service = new CheckInsService({ projectExists: async () => true, isProjectMember: async () => true, messagesBelongToUser: async () => false } as unknown as CheckInRepository);
    await assert.rejects(service[operation]('p', { summary: 'x', messageIds: ['foreign'] }, 'u'), ForbiddenException);
  });
}
test('tool save_checkin preserva dificuldades/próximos passos anteriores quando chegam null', async () => {
  let result: unknown;
  const service = new CheckInsService({ projectExists: async () => true, isProjectMember: async () => true,
    findDailyByUserAndProject: async () => ({ id: 'c', difficulties: 'Bloqueio', nextSteps: 'Testar' }),
    updateCheckIn: async (_id: string, data: unknown) => { result = data; return data; },
  } as unknown as CheckInRepository);
  await service.saveCheckIn('p', { summary: 'Avancei', difficulties: null, nextSteps: null }, 'u');
  assert.deepEqual(result, { summary: 'Avancei', difficulties: 'Bloqueio', nextSteps: 'Testar', messageIds: undefined });
});
test('intervalo inválido em CheckIn gera 400 antes da query', async () => {
  const service = new CheckInsService({ projectExists: async () => true } as unknown as CheckInRepository);
  await assert.rejects(service.list('p', { startDate: 'invalid' }), BadRequestException);
  await assert.rejects(service.list('p', { startDate: '2026-10-04', endDate: '2026-10-01' }), BadRequestException);
});
test('HelpRequest não aceita solicitante diferente do usuário autenticado', async () => {
  await assert.rejects(new HelpRequestsService({} as HelpRequestRepository).create('p', { requesterId: 'other', problem: 'x' }, 'u'), ForbiddenException);
});
test('falha do Google não devolve detalhes do provider ou token', async () => {
  const service = new AuthService({} as UserRepository, { verify: async () => { throw new Error('secret-provider-token'); } } as GoogleTokenVerifier, 'fixture-secret');
  await assert.rejects(service.loginWithGoogle('x'), error => error instanceof UnauthorizedException && !error.message.includes('secret-provider-token'));
});
test('produção não inicia aceitando JWT com segredo público de desenvolvimento', () => {
  const old = process.env.NODE_ENV; const secret = process.env.JWT_SECRET;
  try {
    process.env.NODE_ENV = 'production'; delete process.env.JWT_SECRET;
    assert.throws(() => resolveJwtSecret(), /JWT_SECRET/);
    assert.throws(() => resolveJwtSecret('nexo_default_jwt_secret_dev'), /JWT_SECRET/);
    assert.equal(resolveJwtSecret('fixture-configured'), 'fixture-configured');
  } finally {
    if (old === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = old;
    if (secret === undefined) delete process.env.JWT_SECRET; else process.env.JWT_SECRET = secret;
  }
});
test('histórico filtra Conversation + usuário no banco e devolve ordem cronológica', async () => {
  let query: unknown;
  const repository = new PrismaConversationRepository({ message: { findMany: async (args: unknown) => { query = args; return [{ id: 'new' }, { id: 'old' }]; } } } as unknown as PrismaService);
  assert.deepEqual(await repository.findConversationMessages('today', 'u'), [{ id: 'old' }, { id: 'new' }]);
  assert.deepEqual(query, { where: { conversationId: 'today', conversation: { userId: 'u' } }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: 50 });
});
test('atualizar CheckIn reconecta Message existente de forma idempotente', async () => {
  let query: unknown;
  const repository = new PrismaCheckInRepository({ checkIn: { update: async (args: unknown) => { query = args; return {}; } } } as unknown as PrismaService);
  await repository.updateCheckIn('c', { messageIds: ['m'] });
  assert.deepEqual((query as { data: unknown }).data, { messages: { connectOrCreate: [{ where: { checkInId_messageId: { checkInId: 'c', messageId: 'm' } }, create: { messageId: 'm' } }] } });
});
