import 'reflect-metadata';
import assert from 'node:assert/strict';
import test from 'node:test';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { CheckInsService } from './check-ins/check-ins.service';
import { HelpRequestsService } from './help-requests/help-requests.service';
import { KnowledgeService } from './knowledge/knowledge.service';
import { ProjectsService } from './projects/projects.service';
import { PrismaService } from './prisma.service';

test('cria check-in quando a pessoa participa do projeto', async () => {
  let saved: unknown;
  const repo = {
    projectExists: async () => true,
    isProjectMember: async () => true,
    create: async (data: unknown) => { saved = data; return data as any; },
  } as unknown as import('./check-ins/check-in.repository').CheckInRepository;
  const service = new CheckInsService(repo);

  await service.create('project-1', { userId: 'user-1', summary: '  Avancei na integração  ', nextSteps: 'Revisar testes', messageIds: ['msg-1'] });

  assert.deepEqual(saved, {
    projectId: 'project-1',
    userId: 'user-1',
    summary: 'Avancei na integração',
    difficulties: null,
    nextSteps: 'Revisar testes',
    messageIds: ['msg-1'],
  });
});

test('não cria check-in em projeto inexistente', async () => {
  const repo = {
    projectExists: async () => false,
  } as unknown as import('./check-ins/check-in.repository').CheckInRepository;
  const service = new CheckInsService(repo);
  await assert.rejects(
    service.create('missing', { userId: 'user-1', summary: 'Avanço' }),
    NotFoundException,
  );
});

test('busca de conhecimento exige autorização de compartilhamento', async () => {
  let queryCaptured: string | undefined;
  const repo = {
    list: async (query?: string) => {
      queryCaptured = query;
      return [];
    },
  } as unknown as import('./knowledge/knowledge.repository').KnowledgeRepository;
  const service = new KnowledgeService(repo);

  await service.list('porta');
  assert.equal(queryCaptured, 'porta');
});

test('rejeita criação de conhecimento com duas origens simultâneas', async () => {
  const repo = {
    projectExists: async () => true,
    isProjectMember: async () => true,
  } as unknown as import('./knowledge/knowledge.repository').KnowledgeRepository;
  const service = new KnowledgeService(repo);

  await assert.rejects(
    service.create({
      projectId: 'project-1',
      authorId: 'user-1',
      title: 'Solução Conflitante',
      problem: 'Problema',
      solution: 'Solução',
      sourceCheckInId: 'checkin-1',
      sourceHelpRequestId: 'help-1',
    }),
    BadRequestException,
  );
});

test('autorização de conhecimento preenche autorizador e timestamp juntos', async () => {
  let authorizedCall: { id: string; authorId: string; date: Date } | undefined;
  const repo = {
    findById: async () => ({ id: 'know-1', authorId: 'user-1', sharingAuthorizedAt: null }),
    authorize: async (id: string, authorId: string, date: Date) => {
      authorizedCall = { id, authorId, date };
      return { id, authorId, sharingAuthorizedBy: authorId, sharingAuthorizedAt: date } as any;
    },
  } as unknown as import('./knowledge/knowledge.repository').KnowledgeRepository;
  const service = new KnowledgeService(repo);

  await service.authorize('know-1', { authorId: 'user-1' });

  assert.equal(authorizedCall?.id, 'know-1');
  assert.equal(authorizedCall?.authorId, 'user-1');
  assert.ok(authorizedCall?.date instanceof Date);
});

test('rejeita autorização de conhecimento feita por outro usuário que não seja o autor', async () => {
  const repo = {
    findById: async () => ({ id: 'know-1', authorId: 'user-ryan', sharingAuthorizedAt: null }),
  } as unknown as import('./knowledge/knowledge.repository').KnowledgeRepository;
  const service = new KnowledgeService(repo);

  await assert.rejects(
    service.authorize('know-1', { authorId: 'user-gustavo' }),
    ForbiddenException,
  );
});

test('criação de projeto rejeita líder que não pertence ao time', async () => {
  const repo = {
    findTeam: async () => ({ id: 'team-1' }),
    findTeamMember: async () => null,
  } as unknown as import('./projects/project.repository').ProjectRepository;
  const service = new ProjectsService(repo);

  await assert.rejects(
    service.create({
      teamId: 'team-1',
      name: 'Projeto Automação',
      leaderId: 'user-externo',
    }),
    BadRequestException,
  );
});

test('criação de projeto rejeita líder com papel MEMBER no time', async () => {
  const repo = {
    findTeam: async () => ({ id: 'team-1' }),
    findTeamMember: async () => ({ userId: 'user-member', role: 'MEMBER' }),
  } as unknown as import('./projects/project.repository').ProjectRepository;
  const service = new ProjectsService(repo);

  await assert.rejects(
    service.create({
      teamId: 'team-1',
      name: 'Projeto Automação',
      leaderId: 'user-member',
    }),
    BadRequestException,
  );
});

test('criação de projeto aceita líder com papel LEADER e cadastra responsável', async () => {
  let projectCreated: Record<string, unknown> | undefined;
  const repo = {
    findTeam: async () => ({ id: 'team-1' }),
    findTeamMember: async (_teamId: string, userId: string) => {
      if (userId === 'user-leader') return { userId: 'user-leader', role: 'LEADER' };
      if (userId === 'user-resp') return { userId: 'user-resp', role: 'MEMBER' };
      return null;
    },
    create: async (data: Record<string, unknown>) => {
      projectCreated = data;
      return { id: 'proj-123', ...data };
    },
  } as unknown as import('./projects/project.repository').ProjectRepository;
  const service = new ProjectsService(repo);

  const result = await service.create({
    teamId: 'team-1',
    name: 'Projeto Automação',
    leaderId: 'user-leader',
    responsibleUserId: 'user-resp',
  });

  assert.equal(result.id, 'proj-123');
  assert.equal(projectCreated?.leaderId, 'user-leader');
  assert.equal(projectCreated?.responsibleUserId, 'user-resp');
  assert.deepEqual(projectCreated?.members, [
    { userId: 'user-leader', role: 'OWNER' },
    { userId: 'user-resp', role: 'MEMBER' },
  ]);
});

test('alteração de status de projeto grava auditoria e valida status válidos', async () => {
  let statusUpdate: Record<string, unknown> | undefined;
  const repo = {
    findById: async () => ({ id: 'proj-1', status: 'ACTIVE' }),
    updateStatus: async (id: string, newStatus: string, changedById: string, reason?: string) => {
      statusUpdate = { id, newStatus, changedById, reason };
      return { id, status: newStatus };
    },
  } as unknown as import('./projects/project.repository').ProjectRepository;
  const service = new ProjectsService(repo);

  const updated = await service.changeStatus('proj-1', { status: 'COMPLETED', reason: 'Entrega finalizada' }, 'user-author');
  assert.equal(updated.status, 'COMPLETED');
  assert.equal(statusUpdate?.newStatus, 'COMPLETED');
  assert.equal(statusUpdate?.changedById, 'user-author');

  await assert.rejects(
    service.changeStatus('proj-1', { status: 'INVALIDO' }, 'user-author'),
    BadRequestException,
  );
});

test('pedido de ajuda aceita avanço e rejeita retorno após resolução', async () => {
  let updated: Record<string, unknown> | undefined;
  const database = {
    helpRequest: {
      findUnique: async ({ where }: { where: { id: string } }) =>
        ({ id: where.id, status: where.id === 'resolved' ? 'RESOLVED' : 'OPEN' }),
      update: async (input: { data: Record<string, unknown> }) => { updated = input.data; return input.data; },
    },
  } as unknown as PrismaService;
  const service = new HelpRequestsService(database);

  await service.changeStatus('open', { status: 'IN_PROGRESS' });
  assert.deepEqual(updated, { status: 'IN_PROGRESS', resolvedAt: null });
  await assert.rejects(service.changeStatus('resolved', { status: 'OPEN' }), BadRequestException);
});
