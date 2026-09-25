import 'reflect-metadata';
import assert from 'node:assert/strict';
import test from 'node:test';
import { ExecutionContext, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AccessControlService } from './access-control.service';
import { AppRole, ROLES_KEY } from './roles.decorator';
import { RolesGuard } from './roles.guard';

class MockAccessControlService extends AccessControlService {
  public adminUserIds = new Set<string>();
  public teamMemberships = new Map<string, 'MEMBER' | 'LEADER'>(); // key: `${teamId}:${userId}`

  async isAdmin(userId: string): Promise<boolean> {
    return this.adminUserIds.has(userId);
  }

  async isTeamMember(userId: string, teamId: string): Promise<boolean> {
    return this.teamMemberships.has(`${teamId}:${userId}`);
  }

  async isTeamLeader(userId: string, teamId: string): Promise<boolean> {
    return this.teamMemberships.get(`${teamId}:${userId}`) === 'LEADER';
  }
}

function createMockContext(
  user?: { id: string; email?: string },
  roles?: AppRole[],
  params: Record<string, string> = {},
): ExecutionContext {
  const req = {
    user,
    params,
  };

  const handler = () => {};
  const cls = class {};

  if (roles && roles.length > 0) {
    Reflect.defineMetadata(ROLES_KEY, roles, handler);
  }

  return {
    switchToHttp: () => ({
      getRequest: () => req,
    }),
    getHandler: () => handler,
    getClass: () => cls,
  } as unknown as ExecutionContext;
}

test('RolesGuard permite acesso quando rota não possui @Roles', async () => {
  const reflector = new Reflector();
  const accessControl = new MockAccessControlService();
  const guard = new RolesGuard(reflector, accessControl);

  const context = createMockContext({ id: 'user-1' });
  const result = await guard.canActivate(context);
  assert.equal(result, true);
});

test('RolesGuard lança UnauthorizedException quando req.user não existe em rota protegida', async () => {
  const reflector = new Reflector();
  const accessControl = new MockAccessControlService();
  const guard = new RolesGuard(reflector, accessControl);

  const context = createMockContext(undefined, ['ADMIN']);
  await assert.rejects(() => guard.canActivate(context), UnauthorizedException);
});

test('RolesGuard permite acesso irrestrito a usuário ADMIN mesmo em rotas específicas', async () => {
  const reflector = new Reflector();
  const accessControl = new MockAccessControlService();
  accessControl.adminUserIds.add('admin-1');

  const guard = new RolesGuard(reflector, accessControl);
  const context = createMockContext({ id: 'admin-1' }, ['ADMIN']);

  const result = await guard.canActivate(context);
  assert.equal(result, true);
});

test('RolesGuard rejeita com ForbiddenException usuário não ADMIN em rota @Roles(ADMIN)', async () => {
  const reflector = new Reflector();
  const accessControl = new MockAccessControlService();
  // user-1 NÃO é admin
  const guard = new RolesGuard(reflector, accessControl);
  const context = createMockContext({ id: 'user-1' }, ['ADMIN']);

  await assert.rejects(() => guard.canActivate(context), ForbiddenException);
});

test('RolesGuard permite membro de equipe em rota @Roles(MEMBER)', async () => {
  const reflector = new Reflector();
  const accessControl = new MockAccessControlService();
  accessControl.teamMemberships.set('team-1:user-collab', 'MEMBER');

  const guard = new RolesGuard(reflector, accessControl);
  const context = createMockContext({ id: 'user-collab' }, ['MEMBER'], { id: 'team-1' });

  const result = await guard.canActivate(context);
  assert.equal(result, true);
});

test('RolesGuard rejeita com ForbiddenException usuário que não pertence à equipe em rota @Roles(MEMBER)', async () => {
  const reflector = new Reflector();
  const accessControl = new MockAccessControlService();
  // user-outsider NÃO pertence a team-1
  const guard = new RolesGuard(reflector, accessControl);
  const context = createMockContext({ id: 'user-outsider' }, ['MEMBER'], { id: 'team-1' });

  await assert.rejects(() => guard.canActivate(context), ForbiddenException);
});
