import 'reflect-metadata';
import assert from 'node:assert/strict';
import test from 'node:test';
import { ForbiddenException, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { AccessControlService } from '../common/auth/access-control.service';
import { OpenAIService } from '../ai/openai.service';
import { PrismaService } from '../prisma.service';
import { ProjectsService } from '../projects/projects.service';
import { ProjectRepository } from '../projects/project.repository';
import { PrismaTechnicalProblemRepository } from './prisma-technical-problem.repository';
import { TechnicalProblemRecord, TechnicalProblemRepository } from './technical-problem.repository';
import { TechnicalProblemService } from './technical-problem.service';

const access = {
  isAdmin: async (userId: string) => userId === 'admin',
  isTeamMember: async (userId: string, teamId: string) => userId === 'member' && teamId === 'team-accessible',
} as unknown as AccessControlService;

function record(projectId = 'project-other', authorized = true): TechnicalProblemRecord {
  return {
    id: 'problem-1', projectId, authorId: 'author', title: 'Token OAuth',
    problem: 'Token expira antes da chamada.', solution: 'Renovar token.',
    sharingAuthorizedAt: authorized ? new Date() : null,
    createdAt: new Date(), updatedAt: new Date(),
  };
}

function serviceFor(item: TechnicalProblemRecord, teamId = 'team-accessible') {
  const repository = {
    findById: async () => item,
    findProjectTeamId: async () => teamId,
  } as unknown as TechnicalProblemRepository;
  return new TechnicalProblemService(repository, {} as OpenAIService, access);
}

test('MEMBER lê problema compartilhado de outro projeto da mesma equipe pelo ID', async () => {
  const item = record();
  assert.equal(await serviceFor(item).getById(item.id, 'member'), item);
});

test('MEMBER não lê problema pelo ID de equipe sem vínculo', async () => {
  await assert.rejects(serviceFor(record(), 'team-external').getById('problem-1', 'member'), NotFoundException);
});

test('ADMIN lê globalmente mas não ignora consentimento de compartilhamento', async () => {
  assert.equal((await serviceFor(record(), 'team-external').getById('problem-1', 'admin')).id, 'problem-1');
  await assert.rejects(serviceFor(record('p1', false)).getById('problem-1', 'admin'), NotFoundException);
});

test('busca textual aplica filtro de equipe no banco e mantém pesquisa entre projetos', async () => {
  let captured: unknown;
  const prisma = {
    technicalProblem: { findMany: async (query: unknown) => { captured = query; return []; } },
  } as unknown as PrismaService;
  const repo = new PrismaTechnicalProblemRepository(prisma);
  const service = new TechnicalProblemService(repo, {} as OpenAIService, access);
  await service.list('token', undefined, undefined, 'member');
  assert.deepEqual(captured, {
    where: {
      project: { team: { members: { some: { userId: 'member' } } } },
      sharingAuthorizedAt: { not: null },
      OR: ['title', 'problem', 'technology', 'solution'].map(field => ({ [field]: { contains: 'token', mode: 'insensitive' } })),
    },
    select: {
      id: true, projectId: true, title: true, problem: true, technology: true,
      solution: true, sharingAuthorizedAt: true, createdAt: true,
      author: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: 'desc' }, take: 50,
  });
});

test('busca textual de ADMIN usa escopo global e continua exigindo autorização', async () => {
  let captured: unknown;
  const prisma = {
    technicalProblem: { findMany: async (query: { where: unknown }) => { captured = query.where; return []; } },
  } as unknown as PrismaService;
  const service = new TechnicalProblemService(new PrismaTechnicalProblemRepository(prisma), {} as OpenAIService, access);
  await service.list(undefined, undefined, undefined, 'admin');
  assert.deepEqual(captured, { sharingAuthorizedAt: { not: null } });
});

test('listagem sem usuário falha fechada antes de consultar conhecimento', async () => {
  const service = serviceFor(record());
  await assert.rejects(service.list('token'), UnauthorizedException);
});

test('autor/autorizador autenticado não pode ser substituído pelo body', async () => {
  const service = serviceFor(record());
  await assert.rejects(service.create({ projectId: 'p1', authorId: 'author', title: 'Título', problem: 'Problema' }, 'member'), ForbiddenException);
  await assert.rejects(service.authorize('p1', { authorId: 'author' }, 'member'), ForbiddenException);
});

test('detalhe de projeto e leader view não expõem problemas de equipe externa; ADMIN é global', async () => {
  const repo = {
    findById: async () => ({ id: 'p1', teamId: 'team-external', technicalProblems: [record()] }),
  } as unknown as ProjectRepository;
  const service = new ProjectsService(repo, access);
  await assert.rejects(service.getById('p1', 'member'), ForbiddenException);
  await assert.rejects(service.getLeaderView('p1', 'member'), ForbiddenException);
  assert.equal((await service.getLeaderView('p1', 'admin')).openTechnicalProblems.length, 1);
});
