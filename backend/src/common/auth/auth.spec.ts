import 'reflect-metadata';
import assert from 'node:assert/strict';
import test from 'node:test';
import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from './auth.guard';
import { extractUserFromContext } from './current-user.decorator';

function createMockContext(headers: Record<string, string> = {}, user?: { id: string; email?: string }): ExecutionContext {
  const req = {
    headers,
    user,
  };
  return {
    switchToHttp: () => ({
      getRequest: () => req,
    }),
  } as unknown as ExecutionContext;
}

test('AuthGuard extrai usuário a partir do header x-user-id quando req.user não existe', () => {
  const guard = new AuthGuard();
  const context = createMockContext({ 'x-user-id': 'user-123' });

  const canActivate = guard.canActivate(context);
  assert.equal(canActivate, true);

  const user = extractUserFromContext(context);
  assert.deepEqual(user, { id: 'user-123' });
});

test('AuthGuard preserva req.user caso já esteja presente', () => {
  const guard = new AuthGuard();
  const context = createMockContext({}, { id: 'user-auth', email: 'user@nexo.com' });

  const canActivate = guard.canActivate(context);
  assert.equal(canActivate, true);

  const user = extractUserFromContext(context);
  assert.deepEqual(user, { id: 'user-auth', email: 'user@nexo.com' });
});

test('AuthGuard lança UnauthorizedException quando nenhum identificador é fornecido', () => {
  const guard = new AuthGuard();
  const context = createMockContext({});

  assert.throws(() => guard.canActivate(context), UnauthorizedException);
});
