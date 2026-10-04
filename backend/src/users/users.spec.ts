import 'reflect-metadata';
import assert from 'node:assert/strict';
import test from 'node:test';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { ListUsersParams, UserRepository, UserRecord } from './user.repository';
import { UsersService } from './users.service';

class InMemoryUserRepository extends UserRepository {
  public users: UserRecord[] = [];
  public projects: any[] = [];

  async findById(id: string): Promise<UserRecord | null> {
    return this.users.find(u => u.id === id) || null;
  }

  async findByEmail(email: string): Promise<UserRecord | null> {
    return this.users.find(u => u.email.toLowerCase() === email.toLowerCase()) || null;
  }

  async list(params?: ListUsersParams | string): Promise<UserRecord[]> {
    const search = typeof params === 'string' ? params : params?.search;
    const status = typeof params === 'object' ? params?.status : undefined;
    const role = typeof params === 'object' ? params?.role : undefined;

    return this.users.filter(u => {
      if (search) {
        const term = search.toLowerCase();
        if (!u.name.toLowerCase().includes(term) && !u.email.toLowerCase().includes(term)) {
          return false;
        }
      }
      if (status === 'active' && !u.isActive) return false;
      if (status === 'inactive' && u.isActive) return false;
      if (role && role !== 'ALL' && u.role !== role) return false;
      return true;
    });
  }

  async create(data: { name: string; email: string; role: string }): Promise<UserRecord> {
    const user: UserRecord = {
      id: `u-${this.users.length + 1}`,
      name: data.name,
      email: data.email,
      role: data.role,
      isActive: true,
      avatarUrl: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.users.push(user);
    return user;
  }

  async update(id: string, data: { name?: string; role?: string; isActive?: boolean }): Promise<UserRecord> {
    const user = await this.findById(id);
    if (!user) throw new NotFoundException('Usuário não encontrado');
    if (data.name !== undefined) user.name = data.name;
    if (data.role !== undefined) user.role = data.role;
    if (data.isActive !== undefined) user.isActive = data.isActive;
    user.updatedAt = new Date();
    return user;
  }

  async countActiveAdmins(): Promise<number> {
    return this.users.filter(u => u.role === 'ADMIN' && u.isActive).length;
  }

  async findUserProjects(userId: string, relation?: 'member' | 'responsible' | 'leader', status?: string): Promise<any[]> {
    return this.projects.filter(p => {
      if (status && p.status !== status) return false;
      if (relation === 'leader') return p.leaderId === userId;
      if (relation === 'responsible') return p.responsibleUserId === userId;
      if (relation === 'member') return p.members?.some((m: any) => m.userId === userId);
      return (
        p.leaderId === userId ||
        p.responsibleUserId === userId ||
        p.members?.some((m: any) => m.userId === userId)
      );
    });
  }

  async updateGoogleAuth(): Promise<void> {}
}

test('UsersService.getMe retorna usuário autenticado com role', async () => {
  const repo = new InMemoryUserRepository();
  repo.users = [{ id: 'user-me', name: 'Gustavo', email: 'gustavo@nexo.com', role: 'ADMIN', isActive: true, createdAt: new Date(), updatedAt: new Date() }];
  const service = new UsersService(repo);

  const me = await service.getMe('user-me');
  assert.equal(me.id, 'user-me');
  assert.equal(me.email, 'gustavo@nexo.com');
  assert.equal(me.role, 'ADMIN');
});

test('UsersService.getMe lança NotFoundException quando usuário não existe', async () => {
  const repo = new InMemoryUserRepository();
  const service = new UsersService(repo);

  await assert.rejects(service.getMe('inexistente'), NotFoundException);
});

test('UsersService.list filtra usuários por busca textual', async () => {
  const repo = new InMemoryUserRepository();
  repo.users = [
    { id: '1', name: 'Ryan Lirio', email: 'ryan@nexo.com', role: 'MEMBER', isActive: true, createdAt: new Date(), updatedAt: new Date() },
    { id: '2', name: 'Gustavo Felicetti', email: 'gustavo@nexo.com', role: 'ADMIN', isActive: true, createdAt: new Date(), updatedAt: new Date() },
  ];
  const service = new UsersService(repo);

  const result = await service.list('ryan');
  assert.equal(result.length, 1);
  assert.equal(result[0].id, '1');
});

test('UsersService.create cadastra novo usuário com sucesso', async () => {
  const repo = new InMemoryUserRepository();
  const service = new UsersService(repo);

  const user = await service.create({
    name: 'Novo Colaborador',
    email: 'novo@empresa.com',
    role: 'LEADER',
  });

  assert.equal(user.name, 'Novo Colaborador');
  assert.equal(user.email, 'novo@empresa.com');
  assert.equal(user.role, 'LEADER');
  assert.equal(user.isActive, true);
});

test('UsersService.create rejeita cadastro com e-mail duplicado', async () => {
  const repo = new InMemoryUserRepository();
  repo.users = [
    { id: '1', name: 'Existente', email: 'duplicado@empresa.com', role: 'MEMBER', isActive: true, createdAt: new Date(), updatedAt: new Date() },
  ];
  const service = new UsersService(repo);

  await assert.rejects(
    () => service.create({ name: 'Outro', email: 'duplicado@empresa.com', role: 'MEMBER' }),
    ConflictException,
  );
});

test('UsersService.update altera nome e role com validação', async () => {
  const repo = new InMemoryUserRepository();
  repo.users = [
    { id: '1', name: 'Admin 1', email: 'admin1@nexo.com', role: 'ADMIN', isActive: true, createdAt: new Date(), updatedAt: new Date() },
    { id: '2', name: 'Admin 2', email: 'admin2@nexo.com', role: 'ADMIN', isActive: true, createdAt: new Date(), updatedAt: new Date() },
  ];
  const service = new UsersService(repo);

  const updated = await service.update('1', { name: 'Admin Renomeado', role: 'MEMBER' });
  assert.equal(updated.name, 'Admin Renomeado');
  assert.equal(updated.role, 'MEMBER');
});

test('UsersService.update impede desativação do único administrador ativo', async () => {
  const repo = new InMemoryUserRepository();
  repo.users = [
    { id: '1', name: 'Único Admin', email: 'admin@nexo.com', role: 'ADMIN', isActive: true, createdAt: new Date(), updatedAt: new Date() },
  ];
  const service = new UsersService(repo);

  await assert.rejects(
    () => service.update('1', { isActive: false }),
    (err: any) => err instanceof BadRequestException && err.message.includes('único administrador ativo'),
  );
});

test('UsersService.update permite desativação quando há outro admin ativo', async () => {
  const repo = new InMemoryUserRepository();
  repo.users = [
    { id: '1', name: 'Admin 1', email: 'admin1@nexo.com', role: 'ADMIN', isActive: true, createdAt: new Date(), updatedAt: new Date() },
    { id: '2', name: 'Admin 2', email: 'admin2@nexo.com', role: 'ADMIN', isActive: true, createdAt: new Date(), updatedAt: new Date() },
  ];
  const service = new UsersService(repo);

  const updated = await service.update('1', { isActive: false });
  assert.equal(updated.isActive, false);
});
