import 'reflect-metadata';
import assert from 'node:assert/strict';
import test from 'node:test';
import { PrismaService } from '../../prisma.service';
import { PrismaAccessControlService } from './access-control.service';

test('controle de acesso identifica administrador pelo papel global do usuário', async () => {
  const prisma = {
    user: {
      findUnique: async ({ where }: { where: { id: string } }) =>
        where.id === 'admin-1' ? { role: 'ADMIN' } : { role: 'MEMBER' },
    },
  } as unknown as PrismaService;
  const service = new PrismaAccessControlService(prisma);

  assert.equal(await service.isAdmin('admin-1'), true);
  assert.equal(await service.isAdmin('member-1'), false);
});

test('controle de acesso exige vínculo com a equipe e papel global de líder', async () => {
  const prisma = {
    teamMember: {
      findUnique: async ({ where }: { where: { teamId_userId: { userId: string } } }) => {
        const userId = where.teamId_userId.userId;
        if (userId === 'leader-1') return { user: { role: 'LEADER' } };
        if (userId === 'member-1') return { user: { role: 'MEMBER' } };
        return null;
      },
    },
  } as unknown as PrismaService;
  const service = new PrismaAccessControlService(prisma);

  assert.equal(await service.isTeamLeader('leader-1', 'team-1'), true);
  assert.equal(await service.isTeamLeader('member-1', 'team-1'), false);
  assert.equal(await service.isTeamLeader('leader-without-team', 'team-1'), false);
});
