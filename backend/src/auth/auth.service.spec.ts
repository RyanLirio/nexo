import 'reflect-metadata';
import assert from 'node:assert/strict';
import test from 'node:test';
import { ForbiddenException, NotFoundException, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import * as jwt from 'jsonwebtoken';
import { AuthService } from './auth.service';
import { GoogleAuthLibraryVerifier, GooglePayload, GoogleTokenVerifier } from './google-verifier';
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

  async list(): Promise<UserRecord[]> {
    return this.users;
  }

  async create(data: { name: string; email: string; role: string }): Promise<UserRecord> {
    const record: UserRecord = {
      id: `user-${this.users.length + 1}`,
      name: data.name,
      email: data.email,
      role: data.role,
      isActive: true,
      avatarUrl: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.users.push(record);
    return record;
  }

  async update(id: string, data: { name?: string; role?: string; isActive?: boolean }): Promise<UserRecord> {
    const user = this.users.find((u) => u.id === id);
    if (!user) throw new NotFoundException('User not found');
    if (data.name !== undefined) (user as any).name = data.name;
    if (data.role !== undefined) (user as any).role = data.role;
    if (data.isActive !== undefined) user.isActive = data.isActive;
    return user;
  }

  async countActiveAdmins(): Promise<number> {
    return this.users.filter((u) => u.role === 'ADMIN' && u.isActive).length;
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

test('GoogleAuthLibraryVerifier informa quando o client ID não está configurado', async () => {
  const originalClientId = process.env.GOOGLE_CLIENT_ID;
  delete process.env.GOOGLE_CLIENT_ID;

  try {
    const verifier = new GoogleAuthLibraryVerifier();
    await assert.rejects(() => verifier.verify('token'), ServiceUnavailableException);
  } finally {
    if (originalClientId === undefined) delete process.env.GOOGLE_CLIENT_ID;
    else process.env.GOOGLE_CLIENT_ID = originalClientId;
  }
});

test('AuthService.loginWithGoogle autentica usuário pré-cadastrado e emite JWT válido', async () => {
  const repo = new MockUserRepository();
  repo.users.push({
    id: 'user-1',
    name: 'Gustavo Felicetti',
    email: 'gustavo@nexo.com',
    role: 'MEMBER',
    isActive: true,
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
  assert.equal(result.user.role, 'MEMBER');

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

test('AuthService.loginWithGoogle rejeita usuário inativo com ForbiddenException', async () => {
  const repo = new MockUserRepository();
  repo.users.push({
    id: 'user-inactive',
    name: 'Inativo User',
    email: 'gustavo@nexo.com',
    role: 'MEMBER',
    isActive: false,
    avatarUrl: null,
    googleSubject: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  const verifier = new MockGoogleVerifier();
  const service = new AuthService(repo, verifier, JWT_SECRET);

  await assert.rejects(
    () => service.loginWithGoogle('valid-token-inactive-user'),
    (err: any) => err instanceof ForbiddenException && err.message.includes('inativo'),
  );
});

test('AuthService.loginWithGoogle rejeita conta não cadastrada com ForbiddenException (política de acesso restrito)', async () => {
  const repo = new MockUserRepository();
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
    role: 'MEMBER',
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  const verifier = new MockGoogleVerifier(true);
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
      role: 'MEMBER',
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const verifier = new MockGoogleVerifier();
    const service = new AuthService(repo, verifier, JWT_SECRET);

    const result = await service.devLogin('dev@nexo.com');
    assert.ok(result.accessToken);
    assert.equal(result.user.id, 'user-dev-1');
    assert.equal(result.user.role, 'MEMBER');

    const decoded = jwt.verify(result.accessToken, JWT_SECRET) as { sub: string };
    assert.equal(decoded.sub, 'user-dev-1');
  } finally {
    process.env.NODE_ENV = originalEnv;
  }
});

test('AuthService.devLogin bloqueia usuário inativo', async () => {
  const originalEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = 'development';
  try {
    const repo = new MockUserRepository();
    repo.users.push({
      id: 'user-dev-inactive',
      name: 'Dev Inactive',
      email: 'inactive@nexo.com',
      role: 'MEMBER',
      isActive: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const verifier = new MockGoogleVerifier();
    const service = new AuthService(repo, verifier, JWT_SECRET);

    await assert.rejects(
      () => service.devLogin('inactive@nexo.com'),
      (err: any) => err instanceof ForbiddenException && err.message.includes('inativo'),
    );
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
