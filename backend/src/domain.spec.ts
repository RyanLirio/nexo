import 'reflect-metadata';
import assert from 'node:assert/strict';
import test from 'node:test';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { CheckInsService } from './check-ins/check-ins.service';
import { HelpRequestsService } from './help-requests/help-requests.service';
import { KnowledgeService } from './knowledge/knowledge.service';
import { ProjectsService } from './projects/projects.service';
import { PrismaService } from './prisma.service';

test('cria check-in quando a pessoa participa do projeto', async () => {
  let saved: unknown;
  const database = {
    project: { findUnique: async () => ({ id: 'project-1' }) },
    projectMember: { findUnique: async () => ({ userId: 'user-1' }) },
    checkIn: { create: async (input: { data: unknown }) => { saved = input.data; return input.data; } },
  } as unknown as PrismaService;
  const service = new CheckInsService(database);

  await service.create('project-1', { userId: 'user-1', summary: '  Avancei na integração  ', nextSteps: 'Revisar testes' });

  assert.deepEqual(saved, {
    projectId: 'project-1',
    userId: 'user-1',
    summary: 'Avancei na integração',
    difficulties: null,
    nextSteps: 'Revisar testes',
  });
});

test('não cria check-in em projeto inexistente', async () => {
  const database = { project: { findUnique: async () => null } } as unknown as PrismaService;
  const service = new CheckInsService(database);
  await assert.rejects(
    service.create('missing', { userId: 'user-1', summary: 'Avanço' }),
    NotFoundException,
  );
});

test('busca de conhecimento exige autorização de compartilhamento', async () => {
  let filter: Record<string, unknown> | undefined;
  const database = {
    knowledgeEntry: { findMany: async (input: { where: Record<string, unknown> }) => { filter = input.where; return []; } },
  } as unknown as PrismaService;
  const service = new KnowledgeService(database);

  await service.list('porta');

  assert.deepEqual(filter?.sharingAuthorizedAt, { not: null });
  assert.ok(Array.isArray(filter?.OR));
});

test('rejeita criação de conhecimento com duas origens simultâneas', async () => {
  const database = {
    project: { findUnique: async () => ({ id: 'project-1' }) },
    projectMember: { findUnique: async () => ({ userId: 'user-1' }) },
  } as unknown as PrismaService;
  const service = new KnowledgeService(database);

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
  let updateData: Record<string, unknown> | undefined;
  const database = {
    knowledgeEntry: {
      findUnique: async () => ({ id: 'know-1', authorId: 'user-1', sharingAuthorizedAt: null }),
      update: async (input: { data: Record<string, unknown> }) => { updateData = input.data; return input.data; },
    },
  } as unknown as PrismaService;
  const service = new KnowledgeService(database);

  await service.authorize('know-1', { authorId: 'user-1' });

  assert.equal(updateData?.sharingAuthorizedBy, 'user-1');
  assert.ok(updateData?.sharingAuthorizedAt instanceof Date);
});

test('criação de projeto rejeita líder que não pertence ao time', async () => {
  const database = {
    team: { findUnique: async () => ({ id: 'team-1' }) },
    teamMember: { findUnique: async () => null },
  } as unknown as PrismaService;
  const service = new ProjectsService(database);

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
  const database = {
    team: { findUnique: async () => ({ id: 'team-1' }) },
    teamMember: { findUnique: async () => ({ userId: 'user-member', role: 'MEMBER' }) },
  } as unknown as PrismaService;
  const service = new ProjectsService(database);

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
  const database = {
    team: { findUnique: async () => ({ id: 'team-1' }) },
    teamMember: {
      findUnique: async (input: { where: { teamId_userId: { userId: string } } }) => {
        if (input.where.teamId_userId.userId === 'user-leader') {
          return { userId: 'user-leader', role: 'LEADER' };
        }
        if (input.where.teamId_userId.userId === 'user-resp') {
          return { userId: 'user-resp', role: 'MEMBER' };
        }
        return null;
      },
    },
    project: {
      create: async (input: { data: Record<string, unknown> }) => {
        projectCreated = input.data;
        return { id: 'proj-123', ...input.data };
      },
    },
  } as unknown as PrismaService;
  const service = new ProjectsService(database);

  const result = await service.create({
    teamId: 'team-1',
    name: 'Projeto Automação',
    leaderId: 'user-leader',
    responsibleUserId: 'user-resp',
  });

  assert.equal(result.id, 'proj-123');
  assert.equal(projectCreated?.leaderId, 'user-leader');
  assert.equal(projectCreated?.responsibleUserId, 'user-resp');
  assert.deepEqual(projectCreated?.members, {
    create: [
      { userId: 'user-leader', role: 'OWNER' },
      { userId: 'user-resp', role: 'MEMBER' },
    ],
  });
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
