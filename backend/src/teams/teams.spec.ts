import 'reflect-metadata';
import assert from 'node:assert/strict';
import test from 'node:test';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { TeamMemberRecord, TeamRecord, TeamRepository } from './team.repository';
import { TeamsService } from './teams.service';

class InMemoryTeamRepository extends TeamRepository {
  public teams: TeamRecord[] = [];
  public members: TeamMemberRecord[] = [];

  async list(): Promise<TeamRecord[]> {
    return this.teams;
  }

  async findById(id: string): Promise<TeamRecord | null> {
    return this.teams.find(t => t.id === id) || null;
  }

  async create(data: { organizationId: string; name: string; description?: string | null }): Promise<TeamRecord> {
    const team: TeamRecord = {
      id: `team-${this.teams.length + 1}`,
      organizationId: data.organizationId,
      name: data.name,
      description: data.description || null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.teams.push(team);
    return team;
  }

  async update(id: string, data: { name?: string; description?: string | null }): Promise<TeamRecord> {
    const team = await this.findById(id);
    if (!team) throw new NotFoundException('Equipe não encontrada.');
    if (data.name !== undefined) team.name = data.name;
    if (data.description !== undefined) team.description = data.description;
    team.updatedAt = new Date();
    return team;
  }

  async listMembers(teamId: string): Promise<TeamMemberRecord[]> {
    return this.members.filter(m => m.teamId === teamId);
  }

  async findMember(teamId: string, userId: string): Promise<TeamMemberRecord | null> {
    return this.members.find(m => m.teamId === teamId && m.userId === userId) || null;
  }

  async addMember(teamId: string, userId: string, role: 'MEMBER' | 'LEADER' = 'MEMBER'): Promise<TeamMemberRecord> {
    const existing = await this.findMember(teamId, userId);
    if (existing) {
      existing.role = role;
      return existing;
    }
    const member: TeamMemberRecord = {
      teamId,
      userId,
      role,
      joinedAt: new Date(),
    };
    this.members.push(member);
    return member;
  }

  async removeMember(teamId: string, userId: string): Promise<void> {
    this.members = this.members.filter(m => !(m.teamId === teamId && m.userId === userId));
  }
}

test('TeamsService.create cria equipe com validação de dados', async () => {
  const repo = new InMemoryTeamRepository();
  const service = new TeamsService(repo);

  const team = await service.create({ organizationId: 'org-1', name: 'Engenharia', description: 'Time de Core' });
  assert.equal(team.name, 'Engenharia');
  assert.equal(team.organizationId, 'org-1');
});

test('TeamsService.addMember adiciona membro com papel LEADER ou MEMBER', async () => {
  const repo = new InMemoryTeamRepository();
  repo.teams = [{ id: 't1', organizationId: 'org-1', name: 'Design', createdAt: new Date(), updatedAt: new Date() }];
  const service = new TeamsService(repo);

  const member = await service.addMember('t1', { userId: 'u1', role: 'LEADER' });
  assert.equal(member.userId, 'u1');
  assert.equal(member.role, 'LEADER');
});

test('TeamsService.addMember rejeita equipe inexistente', async () => {
  const repo = new InMemoryTeamRepository();
  const service = new TeamsService(repo);

  await assert.rejects(service.addMember('inexistente', { userId: 'u1' }), NotFoundException);
});

test('TeamsService.removeMember remove usuário da equipe', async () => {
  const repo = new InMemoryTeamRepository();
  repo.teams = [{ id: 't1', organizationId: 'org-1', name: 'Design', createdAt: new Date(), updatedAt: new Date() }];
  repo.members = [{ teamId: 't1', userId: 'u1', role: 'MEMBER', joinedAt: new Date() }];
  const service = new TeamsService(repo);

  await service.removeMember('t1', 'u1');
  const members = await service.listMembers('t1');
  assert.equal(members.length, 0);
});
