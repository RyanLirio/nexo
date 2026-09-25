import 'reflect-metadata';
import assert from 'node:assert/strict';
import test from 'node:test';
import { NotFoundException } from '@nestjs/common';
import { UserRepository, UserRecord } from './user.repository';
import { UsersService } from './users.service';

class InMemoryUserRepository extends UserRepository {
  public users: UserRecord[] = [];
  public projects: any[] = [];

  async findById(id: string): Promise<UserRecord | null> {
    return this.users.find(u => u.id === id) || null;
  }

  async findByEmail(email: string): Promise<UserRecord | null> {
    return this.users.find(u => u.email === email) || null;
  }

  async list(search?: string): Promise<UserRecord[]> {
    if (!search) return this.users;
    const term = search.toLowerCase();
    return this.users.filter(u => u.name.toLowerCase().includes(term) || u.email.toLowerCase().includes(term));
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
}

test('UsersService.getMe retorna usuário autenticado com role', async () => {
  const repo = new InMemoryUserRepository();
  repo.users = [{ id: 'user-me', name: 'Gustavo', email: 'gustavo@nexo.com', role: 'ADMIN', createdAt: new Date(), updatedAt: new Date() }];
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
    { id: '1', name: 'Ryan Lirio', email: 'ryan@nexo.com', role: 'MEMBER', createdAt: new Date(), updatedAt: new Date() },
    { id: '2', name: 'Gustavo Felicetti', email: 'gustavo@nexo.com', role: 'ADMIN', createdAt: new Date(), updatedAt: new Date() },
  ];
  const service = new UsersService(repo);

  const result = await service.list('ryan');
  assert.equal(result.length, 1);
  assert.equal(result[0].id, '1');
});

test('UsersService.getMeProjects filtra projetos por relação leader', async () => {
  const repo = new InMemoryUserRepository();
  repo.users = [{ id: 'u1', name: 'Líder', email: 'l@nexo.com', role: 'LEADER', createdAt: new Date(), updatedAt: new Date() }];
  repo.projects = [
    { id: 'p1', name: 'Proj 1', leaderId: 'u1', responsibleUserId: 'u2', status: 'ACTIVE' },
    { id: 'p2', name: 'Proj 2', leaderId: 'u2', responsibleUserId: 'u1', status: 'ACTIVE' },
  ];
  const service = new UsersService(repo);

  const leaderProjects = await service.getMeProjects('u1', { relation: 'leader' });
  assert.equal(leaderProjects.length, 1);
  assert.equal(leaderProjects[0].id, 'p1');
});
