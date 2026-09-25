import 'reflect-metadata';
import assert from 'node:assert/strict';
import test from 'node:test';
import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import * as jwt from 'jsonwebtoken';
import { AuthGuard } from './auth.guard';
import { extractUserFromContext } from './current-user.decorator';
import { IS_PUBLIC_KEY } from './public.decorator';

const JWT_SECRET = 'test_secret_for_guard_specs';

function createMockContext(
  headers: Record<string, string> = {},
  user?: { id: string; email?: string },
  isPublic = false,
): ExecutionContext {
  const req = {
    headers,
    user,
  };

  const handler = () => {};
  const cls = class {};

  if (isPublic) {
    Reflect.defineMetadata(IS_PUBLIC_KEY, true, handler);
  }

  return {
    switchToHttp: () => ({
      getRequest: () => req,
    }),
    getHandler: () => handler,
    getClass: () => cls,
  } as unknown as ExecutionContext;
}

test('AuthGuard libera rota anotada com @Public sem credenciais', () => {
  const reflector = new Reflector();
  const guard = new AuthGuard(reflector, JWT_SECRET);
  const context = createMockContext({}, undefined, true);

  const canActivate = guard.canActivate(context);
  assert.equal(canActivate, true);
});

test('AuthGuard autentica requisição com token Bearer JWT válido', () => {
  const reflector = new Reflector();
  const guard = new AuthGuard(reflector, JWT_SECRET);

  const token = jwt.sign({ sub: 'user-jwt-1', email: 'jwt@nexo.com' }, JWT_SECRET);
  const context = createMockContext({ authorization: `Bearer ${token}` });

  const canActivate = guard.canActivate(context);
  assert.equal(canActivate, true);

  const user = extractUserFromContext(context);
  assert.deepEqual(user, { id: 'user-jwt-1', email: 'jwt@nexo.com' });
});

test('AuthGuard rejeita token Bearer JWT inválido ou expirado', () => {
  const reflector = new Reflector();
  const guard = new AuthGuard(reflector, JWT_SECRET);
  const context = createMockContext({ authorization: 'Bearer invalid.jwt.token' });

  assert.throws(() => guard.canActivate(context), UnauthorizedException);
});

test('AuthGuard ignora header x-user-id e lança UnauthorizedException em ambiente de produção', () => {
  const originalEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = 'production';
  try {
    const reflector = new Reflector();
    const guard = new AuthGuard(reflector, JWT_SECRET);
    const context = createMockContext({ 'x-user-id': 'hacker-user' });

    assert.throws(() => guard.canActivate(context), UnauthorizedException);
  } finally {
    process.env.NODE_ENV = originalEnv;
  }
});

test('AuthGuard aceita x-user-id quando em ambiente de desenvolvimento/teste', () => {
  const originalEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = 'test';
  try {
    const reflector = new Reflector();
    const guard = new AuthGuard(reflector, JWT_SECRET);
    const context = createMockContext({ 'x-user-id': 'user-123' });

    const canActivate = guard.canActivate(context);
    assert.equal(canActivate, true);

    const user = extractUserFromContext(context);
    assert.deepEqual(user, { id: 'user-123' });
  } finally {
    process.env.NODE_ENV = originalEnv;
  }
});

test('AuthGuard preserva req.user caso já esteja presente', () => {
  const reflector = new Reflector();
  const guard = new AuthGuard(reflector, JWT_SECRET);
  const context = createMockContext({}, { id: 'user-auth', email: 'user@nexo.com' });

  const canActivate = guard.canActivate(context);
  assert.equal(canActivate, true);

  const user = extractUserFromContext(context);
  assert.deepEqual(user, { id: 'user-auth', email: 'user@nexo.com' });
});

test('AuthGuard lança UnauthorizedException quando nenhum identificador é fornecido', () => {
  const reflector = new Reflector();
  const guard = new AuthGuard(reflector, JWT_SECRET);
  const context = createMockContext({});

  assert.throws(() => guard.canActivate(context), UnauthorizedException);
});
