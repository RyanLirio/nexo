import 'reflect-metadata';
import assert from 'node:assert/strict';
import test from 'node:test';
import { ForbiddenException } from '@nestjs/common';
import { AccessControlService } from '../common/auth/access-control.service';
import { ProjectRepository } from './project.repository';
import { ProjectsService } from './projects.service';
import { ProjectsController } from './projects.controller';
import { PrismaProjectRepository } from './prisma-project.repository';
import { PrismaService } from '../prisma.service';

const checkIn = { id: 'daily', summary: 'Integração concluída', difficulties: null, nextSteps: 'Testar', createdAt: new Date(), updatedAt: new Date() };
const project = {
  id: 'project', teamId: 'team', name: 'Projeto', status: 'ACTIVE', priority: 50,
  members: [
    { userId: 'member', user: { id: 'member', name: 'Pessoa', checkIns: [checkIn] } },
    { userId: 'quiet', user: { id: 'quiet', name: 'Sem atualização', checkIns: [] } },
  ],
  checkIns: [checkIn], technicalProblems: [],
};
function service() {
  return new ProjectsService({ findById: async () => project } as unknown as ProjectRepository, {
    isAdmin: async (id: string) => id === 'admin',
    isTeamMember: async (id: string) => ['member', 'leader'].includes(id),
    isTeamLeader: async (id: string, teamId: string) => id === 'leader' && teamId === 'team',
  } as AccessControlService);
}

test('leader view disponibiliza último CheckIn individual e mantém ausência neutra', async () => {
  const view = await service().getLeaderView('project', 'leader');
  assert.deepEqual(view.members[0].latestCheckIn, checkIn);
  assert.equal(view.members[1].latestCheckIn, null);
  assert.ok(!('checkIns' in view.members[0].user));
  assert.equal(view.latestCheckIn.id, 'daily');
});
test('MEMBER da mesma equipe não acessa leader view', async () => {
  await assert.rejects(service().getLeaderView('project', 'member'), ForbiddenException);
});
test('líder sem vínculo não acessa leader view por ID arbitrário', async () => {
  await assert.rejects(service().getLeaderView('project', 'external-leader'), ForbiddenException);
});
test('ADMIN mantém acesso global à leader view', async () => {
  assert.equal((await service().getLeaderView('project', 'admin')).id, 'project');
});
test('leitura de membros autoriza o projeto antes de consultar a lista', async () => {
  let read = false;
  const controller = new ProjectsController({
    getById: async () => { throw new ForbiddenException(); },
    listMembers: async () => { read = true; return []; },
  } as unknown as ProjectsService);
  await assert.rejects(controller.listMembers('external', { id: 'member' }), ForbiddenException);
  assert.equal(read, false);
});
test('consulta por membro limita último CheckIn ao projeto solicitado', async () => {
  let captured: unknown;
  const repository = new PrismaProjectRepository({ project: {
    findUnique: async (query: unknown) => { captured = query; return null; },
  } } as unknown as PrismaService);
  await repository.findById('project');
  const query = captured as { include: { members: { include: { user: { select: { checkIns: { where: { projectId: string }; take: number; orderBy: { createdAt: string } } } } } } } };
  assert.deepEqual(query.include.members.include.user.select.checkIns.where, { projectId: 'project' });
  assert.equal(query.include.members.include.user.select.checkIns.take, 1);
  assert.equal(query.include.members.include.user.select.checkIns.orderBy.createdAt, 'desc');
});
