import 'reflect-metadata';
import assert from 'node:assert/strict';
import test from 'node:test';
import { ForbiddenException, NotFoundException, UnauthorizedException } from '@nestjs/common';
import * as jwt from 'jsonwebtoken';
import { AuthService } from './auth.service';
import { GooglePayload, GoogleTokenVerifier } from './google-verifier';
import { UserRecord, UserRepository } from '../users/user.repository';

class MockGoogleVerifier implements GoogleTokenVerifier {
  constructor(
    private readonly shouldFail: boolean = false,
    private readonly payload: GooglePayload = {
      sub: 'google-sub-123',
      email: 'gustavo@nexo.com',
      name: 'Gustavo Felicetti',
      picture: 'https://avatar.google.com/photo.jpg',
    },
  ) {}

  async verify(idToken: string): Promise<GooglePayload> {
    if (this.shouldFail || !idToken) {
      throw new Error('Invalid Google token');
    }
    return this.payload;
  }
}

class MockUserRepository extends UserRepository {
  public users: (UserRecord & { googleSubject?: string | null })[] = [];
  public updatedUser: unknown = null;

  async findById(id: string): Promise<UserRecord | null> {
    const u = this.users.find((user) => user.id === id);
    return u ?? null;
  }

  async findByEmail(email: string): Promise<UserRecord | null> {
    const u = this.users.find((user) => user.email === email);
    return u ?? null;
  }

  async list(search?: string): Promise<UserRecord[]> {
    return this.users;
  }

  async findUserProjects(): Promise<any[]> {
    return [];
  }

  async updateGoogleAuth(userId: string, data: { googleSubject?: string; avatarUrl?: string }): Promise<void> {
    this.updatedUser = { userId, ...data };
    const u = this.users.find((user) => user.id === userId);
    if (u) {
      if (data.googleSubject) u.googleSubject = data.googleSubject;
      if (data.avatarUrl) u.avatarUrl = data.avatarUrl;
    }
  }
}

const JWT_SECRET = 'test_secret_key_12345';

test('AuthService.loginWithGoogle autentica usuário pré-cadastrado e emite JWT válido', async () => {
  const repo = new MockUserRepository();
  repo.users.push({
    id: 'user-1',
    name: 'Gustavo Felicetti',
    email: 'gustavo@nexo.com',
    avatarUrl: null,
    googleSubject: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  const verifier = new MockGoogleVerifier();
  const service = new AuthService(repo, verifier, JWT_SECRET);

  const result = await service.loginWithGoogle('valid-google-id-token');

  assert.ok(result.accessToken);
  assert.equal(result.user.id, 'user-1');
  assert.equal(result.user.email, 'gustavo@nexo.com');

  const decoded = jwt.verify(result.accessToken, JWT_SECRET) as { sub: string; email: string };
  assert.equal(decoded.sub, 'user-1');
  assert.equal(decoded.email, 'gustavo@nexo.com');
  assert.deepEqual(repo.updatedUser, {
    userId: 'user-1',
    googleSubject: 'google-sub-123',
    avatarUrl: 'https://avatar.google.com/photo.jpg',
    name: 'Gustavo Felicetti',
  });
});

test('AuthService.loginWithGoogle rejeita conta não cadastrada com ForbiddenException (política de acesso restrito)', async () => {
  const repo = new MockUserRepository();
  // Nao há usuarios cadastrados no repo
  const verifier = new MockGoogleVerifier();
  const service = new AuthService(repo, verifier, JWT_SECRET);

  await assert.rejects(
    () => service.loginWithGoogle('valid-token-unknown-user'),
    ForbiddenException,
  );
});

test('AuthService.loginWithGoogle rejeita token inválido com UnauthorizedException', async () => {
  const repo = new MockUserRepository();
  repo.users.push({
    id: 'user-1',
    name: 'Gustavo',
    email: 'gustavo@nexo.com',
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  const verifier = new MockGoogleVerifier(true); // Falha na verificacao
  const service = new AuthService(repo, verifier, JWT_SECRET);

  await assert.rejects(
    () => service.loginWithGoogle('invalid-token'),
    UnauthorizedException,
  );
});

test('AuthService.devLogin autentica usuário cadastrado em ambiente não produtivo', async () => {
  const originalEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = 'development';
  try {
    const repo = new MockUserRepository();
    repo.users.push({
      id: 'user-dev-1',
      name: 'Dev User',
      email: 'dev@nexo.com',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const verifier = new MockGoogleVerifier();
    const service = new AuthService(repo, verifier, JWT_SECRET);

    const result = await service.devLogin('dev@nexo.com');
    assert.ok(result.accessToken);
    assert.equal(result.user.id, 'user-dev-1');

    const decoded = jwt.verify(result.accessToken, JWT_SECRET) as { sub: string };
    assert.equal(decoded.sub, 'user-dev-1');
  } finally {
    process.env.NODE_ENV = originalEnv;
  }
});

test('AuthService.devLogin lança ForbiddenException em ambiente de produção', async () => {
  const originalEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = 'production';
  try {
    const repo = new MockUserRepository();
    const verifier = new MockGoogleVerifier();
    const service = new AuthService(repo, verifier, JWT_SECRET);

    await assert.rejects(
      () => service.devLogin('dev@nexo.com'),
      ForbiddenException,
    );
  } finally {
    process.env.NODE_ENV = originalEnv;
  }
});
