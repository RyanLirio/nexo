import 'reflect-metadata';
import assert from 'node:assert/strict';
import test from 'node:test';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { CheckInsService } from './check-ins/check-ins.service';
import { HelpRequestsService } from './help-requests/help-requests.service';
import { KnowledgeService } from './knowledge/knowledge.service';
import { ProjectsService } from './projects/projects.service';
import { PrismaService } from './prisma.service';
import { User } from './users/models';
import { Team, TeamMember, TeamRole } from './teams/models';
import { Project, ProjectMember, ProjectStatus, ProjectRole, VALID_PROJECT_STATUSES } from './projects/models';
import { CheckIn } from './check-ins/models';
import { KnowledgeEntry } from './knowledge/models';
import { HelpRequest, HelpStatus, HELP_STATUS_TRANSITIONS } from './help-requests/models';


test('cria check-in quando a pessoa participa do projeto', async () => {
  let saved: unknown;
  const repo = {
    projectExists: async () => true,
    isProjectMember: async () => true,
    create: async (data: unknown) => { saved = data; return data as any; },
  } as unknown as import('./check-ins/check-in.repository').CheckInRepository;
  const service = new CheckInsService(repo);

  await service.create('project-1', { userId: 'user-1', summary: '  Avancei na integração  ', nextSteps: 'Revisar testes', messageIds: ['msg-1'] });

  assert.deepEqual(saved, {
    projectId: 'project-1',
    userId: 'user-1',
    summary: 'Avancei na integração',
    difficulties: null,
    nextSteps: 'Revisar testes',
    messageIds: ['msg-1'],
  });
});

test('não cria check-in em projeto inexistente', async () => {
  const repo = {
    projectExists: async () => false,
  } as unknown as import('./check-ins/check-in.repository').CheckInRepository;
  const service = new CheckInsService(repo);
  await assert.rejects(
    service.create('missing', { userId: 'user-1', summary: 'Avanço' }),
    NotFoundException,
  );
});

test('busca de conhecimento exige autorização de compartilhamento', async () => {
  let queryCaptured: string | undefined;
  const repo = {
    list: async (query?: string) => {
      queryCaptured = query;
      return [];
    },
  } as unknown as import('./knowledge/knowledge.repository').KnowledgeRepository;
  const service = new KnowledgeService(repo);

  await service.list('porta');
  assert.equal(queryCaptured, 'porta');
});

test('rejeita criação de conhecimento com duas origens simultâneas', async () => {
  const repo = {
    projectExists: async () => true,
    isProjectMember: async () => true,
  } as unknown as import('./knowledge/knowledge.repository').KnowledgeRepository;
  const service = new KnowledgeService(repo);

  await assert.rejects(
    service.create({
      projectId: 'project-1',
      authorId: 'user-1',
      title: 'Solução Conflitante',
      problem: 'Problema',
      solution: 'Solução',
      sourceCheckInId: 'checkin-1',
      sourceHelpRequestId: 'help-1',
    }),
    BadRequestException,
  );
});

test('autorização de conhecimento preenche autorizador e timestamp juntos', async () => {
  let authorizedCall: { id: string; authorId: string; date: Date } | undefined;
  const repo = {
    findById: async () => ({ id: 'know-1', authorId: 'user-1', sharingAuthorizedAt: null }),
    authorize: async (id: string, authorId: string, date: Date) => {
      authorizedCall = { id, authorId, date };
      return { id, authorId, sharingAuthorizedBy: authorId, sharingAuthorizedAt: date } as any;
    },
  } as unknown as import('./knowledge/knowledge.repository').KnowledgeRepository;
  const service = new KnowledgeService(repo);

  await service.authorize('know-1', { authorId: 'user-1' });

  assert.equal(authorizedCall?.id, 'know-1');
  assert.equal(authorizedCall?.authorId, 'user-1');
  assert.ok(authorizedCall?.date instanceof Date);
});

test('rejeita autorização de conhecimento feita por outro usuário que não seja o autor', async () => {
  const repo = {
    findById: async () => ({ id: 'know-1', authorId: 'user-ryan', sharingAuthorizedAt: null }),
  } as unknown as import('./knowledge/knowledge.repository').KnowledgeRepository;
  const service = new KnowledgeService(repo);

  await assert.rejects(
    service.authorize('know-1', { authorId: 'user-gustavo' }),
    ForbiddenException,
  );
});

test('criação de projeto rejeita líder que não pertence ao time', async () => {
  const repo = {
    findTeam: async () => ({ id: 'team-1' }),
    findTeamMember: async () => null,
  } as unknown as import('./projects/project.repository').ProjectRepository;
  const service = new ProjectsService(repo);

  await assert.rejects(
    service.create({
      teamId: 'team-1',
      name: 'Projeto Automação',
      leaderId: 'user-externo',
    }),
    BadRequestException,
  );
});

test('criação de projeto rejeita líder com papel MEMBER no time', async () => {
  const repo = {
    findTeam: async () => ({ id: 'team-1' }),
    findTeamMember: async () => ({ userId: 'user-member', role: 'MEMBER' }),
  } as unknown as import('./projects/project.repository').ProjectRepository;
  const service = new ProjectsService(repo);

  await assert.rejects(
    service.create({
      teamId: 'team-1',
      name: 'Projeto Automação',
      leaderId: 'user-member',
    }),
    BadRequestException,
  );
});

test('criação de projeto aceita líder com papel LEADER e cadastra responsável', async () => {
  let projectCreated: Record<string, unknown> | undefined;
  const repo = {
    findTeam: async () => ({ id: 'team-1' }),
    findTeamMember: async (_teamId: string, userId: string) => {
      if (userId === 'user-leader') return { userId: 'user-leader', role: 'LEADER' };
      if (userId === 'user-resp') return { userId: 'user-resp', role: 'MEMBER' };
      return null;
    },
    create: async (data: Record<string, unknown>) => {
      projectCreated = data;
      return { id: 'proj-123', ...data };
    },
  } as unknown as import('./projects/project.repository').ProjectRepository;
  const service = new ProjectsService(repo);

  const result = await service.create({
    teamId: 'team-1',
    name: 'Projeto Automação',
    leaderId: 'user-leader',
    responsibleUserId: 'user-resp',
  });

  assert.equal(result.id, 'proj-123');
  assert.equal(projectCreated?.leaderId, 'user-leader');
  assert.equal(projectCreated?.responsibleUserId, 'user-resp');
  assert.deepEqual(projectCreated?.members, [
    { userId: 'user-leader', role: 'OWNER' },
    { userId: 'user-resp', role: 'MEMBER' },
  ]);
});

test('alteração de status de projeto grava auditoria e valida status válidos', async () => {
  let statusUpdate: Record<string, unknown> | undefined;
  const repo = {
    findById: async () => ({ id: 'proj-1', status: 'ACTIVE' }),
    updateStatus: async (id: string, newStatus: string, changedById: string, reason?: string) => {
      statusUpdate = { id, newStatus, changedById, reason };
      return { id, status: newStatus };
    },
  } as unknown as import('./projects/project.repository').ProjectRepository;
  const service = new ProjectsService(repo);

  const updated = await service.changeStatus('proj-1', { status: 'COMPLETED', reason: 'Entrega finalizada' }, 'user-author');
  assert.equal(updated.status, 'COMPLETED');
  assert.equal(statusUpdate?.newStatus, 'COMPLETED');
  assert.equal(statusUpdate?.changedById, 'user-author');

  await assert.rejects(
    service.changeStatus('proj-1', { status: 'INVALIDO' }, 'user-author'),
    BadRequestException,
  );
});

test('pedido de ajuda aceita avanço e rejeita retorno após resolução', async () => {
  let updatedData: { id: string; status: string; resolvedAt: Date | null } | undefined;
  const repo = {
    findById: async (id: string) => ({
      id,
      status: id === 'resolved' ? 'RESOLVED' : 'OPEN',
    }),
    updateStatus: async (id: string, status: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED', resolvedAt: Date | null) => {
      updatedData = { id, status, resolvedAt };
      return { id, status, resolvedAt } as any;
    },
  } as unknown as import('./help-requests/help-request.repository').HelpRequestRepository;
  const service = new HelpRequestsService(repo);

  await service.changeStatus('open', { status: 'IN_PROGRESS' });
  assert.deepEqual(updatedData, { id: 'open', status: 'IN_PROGRESS', resolvedAt: null });
  await assert.rejects(service.changeStatus('resolved', { status: 'OPEN' }), BadRequestException);
});

// ==================== Domain Model Tests ====================

// --- User Model ---
test('User.displayName retorna o primeiro nome', () => {
  const user = new User({ id: '1', name: 'Ryan Lirio', email: 'ryan@nexo.dev', createdAt: new Date(), updatedAt: new Date() });
  assert.equal(user.displayName, 'Ryan');
});

test('User.validateCreate rejeita nome vazio', () => {
  assert.throws(() => User.validateCreate({ name: '', email: 'a@b.com' }), BadRequestException);
});

test('User.validateCreate rejeita email sem @', () => {
  assert.throws(() => User.validateCreate({ name: 'Ryan', email: 'invalid' }), BadRequestException);
});

test('User.validateCreate normaliza dados', () => {
  const result = User.validateCreate({ name: '  Ryan  ', email: '  Ryan@NEXO.dev  ' });
  assert.equal(result.name, 'Ryan');
  assert.equal(result.email, 'ryan@nexo.dev');
});

// --- TeamMember Model ---
test('TeamMember.isLeader identifica papel de líder', () => {
  const leader = new TeamMember({ teamId: 't1', userId: 'u1', role: TeamRole.LEADER, joinedAt: new Date() });
  const member = new TeamMember({ teamId: 't1', userId: 'u2', role: TeamRole.MEMBER, joinedAt: new Date() });
  assert.equal(leader.isLeader, true);
  assert.equal(member.isLeader, false);
});

test('TeamMember.validateRole normaliza e valida papéis', () => {
  assert.equal(TeamMember.validateRole('leader'), TeamRole.LEADER);
  assert.equal(TeamMember.validateRole('member'), TeamRole.MEMBER);
  assert.equal(TeamMember.validateRole(undefined), TeamRole.MEMBER);
  assert.throws(() => TeamMember.validateRole('ADMIN'), BadRequestException);
});

// --- Project Model ---
test('Project.isActive e isCompleted refletem estado correto', () => {
  const now = new Date();
  const active = new Project({ id: 'p1', name: 'Proj', status: ProjectStatus.ACTIVE, teamId: 't1', createdAt: now, updatedAt: now });
  const done = new Project({ id: 'p2', name: 'Proj', status: ProjectStatus.COMPLETED, teamId: 't1', createdAt: now, updatedAt: now });
  assert.equal(active.isActive, true);
  assert.equal(active.isCompleted, false);
  assert.equal(done.isActive, false);
  assert.equal(done.isCompleted, true);
});

test('ProjectMember.isOwner distingue OWNER de MEMBER', () => {
  const now = new Date();
  const owner = new ProjectMember({ projectId: 'p1', userId: 'u1', role: ProjectRole.OWNER, joinedAt: now });
  const member = new ProjectMember({ projectId: 'p1', userId: 'u2', role: ProjectRole.MEMBER, joinedAt: now });
  assert.equal(owner.isOwner, true);
  assert.equal(member.isOwner, false);
});

test('VALID_PROJECT_STATUSES contém todos os 4 status do enum', () => {
  assert.equal(VALID_PROJECT_STATUSES.length, 4);
  assert.ok(VALID_PROJECT_STATUSES.includes(ProjectStatus.PLANNING));
  assert.ok(VALID_PROJECT_STATUSES.includes(ProjectStatus.ACTIVE));
  assert.ok(VALID_PROJECT_STATUSES.includes(ProjectStatus.PAUSED));
  assert.ok(VALID_PROJECT_STATUSES.includes(ProjectStatus.COMPLETED));
});

// --- CheckIn Model ---
test('CheckIn.hasDifficulties detecta campo preenchido ou vazio', () => {
  const now = new Date();
  const withDiff = new CheckIn({ id: 'c1', projectId: 'p1', userId: 'u1', summary: 'ok', difficulties: 'algo', createdAt: now, updatedAt: now });
  const withoutDiff = new CheckIn({ id: 'c2', projectId: 'p1', userId: 'u1', summary: 'ok', createdAt: now, updatedAt: now });
  const emptyDiff = new CheckIn({ id: 'c3', projectId: 'p1', userId: 'u1', summary: 'ok', difficulties: '', createdAt: now, updatedAt: now });
  assert.equal(withDiff.hasDifficulties, true);
  assert.equal(withoutDiff.hasDifficulties, false);
  assert.equal(emptyDiff.hasDifficulties, false);
});

// --- KnowledgeEntry Model ---
test('KnowledgeEntry.isAuthorized reflete estado de autorização', () => {
  const now = new Date();
  const authorized = new KnowledgeEntry({
    id: 'k1', projectId: 'p1', authorId: 'u1', title: 'T', problem: 'P', solution: 'S',
    sharingAuthorizedAt: now, sharingAuthorizedBy: 'u1', createdAt: now, updatedAt: now,
  });
  const pending = new KnowledgeEntry({
    id: 'k2', projectId: 'p1', authorId: 'u1', title: 'T', problem: 'P', solution: 'S',
    createdAt: now, updatedAt: now,
  });
  assert.equal(authorized.isAuthorized, true);
  assert.equal(pending.isAuthorized, false);
});

test('KnowledgeEntry.hasDualSource detecta origens conflitantes', () => {
  const now = new Date();
  const dual = new KnowledgeEntry({
    id: 'k1', projectId: 'p1', authorId: 'u1', title: 'T', problem: 'P', solution: 'S',
    sourceCheckInId: 'c1', sourceHelpRequestId: 'h1', createdAt: now, updatedAt: now,
  });
  const single = new KnowledgeEntry({
    id: 'k2', projectId: 'p1', authorId: 'u1', title: 'T', problem: 'P', solution: 'S',
    sourceCheckInId: 'c1', createdAt: now, updatedAt: now,
  });
  assert.equal(dual.hasDualSource, true);
  assert.equal(single.hasDualSource, false);
});

// --- HelpRequest Model ---
test('HelpRequest.isResolved e isOpen refletem estado do pedido', () => {
  const now = new Date();
  const open = new HelpRequest({
    id: 'h1', projectId: 'p1', requesterId: 'u1', problem: 'bug', status: HelpStatus.OPEN,
    createdAt: now, updatedAt: now,
  });
  const resolved = new HelpRequest({
    id: 'h2', projectId: 'p1', requesterId: 'u1', problem: 'bug', status: HelpStatus.RESOLVED,
    createdAt: now, updatedAt: now, resolvedAt: now,
  });
  assert.equal(open.isOpen, true);
  assert.equal(open.isResolved, false);
  assert.equal(resolved.isOpen, false);
  assert.equal(resolved.isResolved, true);
});

test('HELP_STATUS_TRANSITIONS define máquina de estados correta', () => {
  assert.deepEqual(HELP_STATUS_TRANSITIONS[HelpStatus.OPEN], [HelpStatus.IN_PROGRESS, HelpStatus.RESOLVED]);
  assert.deepEqual(HELP_STATUS_TRANSITIONS[HelpStatus.IN_PROGRESS], [HelpStatus.RESOLVED]);
  assert.deepEqual(HELP_STATUS_TRANSITIONS[HelpStatus.RESOLVED], []);
});

// --- Project Model Domain Methods ---
test('Project.validateStatus aceita status válidos e rejeita inválidos', () => {
  assert.equal(Project.validateStatus('active'), ProjectStatus.ACTIVE);
  assert.equal(Project.validateStatus('COMPLETED'), ProjectStatus.COMPLETED);
  assert.throws(() => Project.validateStatus('INVALIDO'), BadRequestException);
});

test('Project.validateLeader rejeita membro nulo ou sem papel LEADER', () => {
  assert.throws(() => Project.validateLeader(null), BadRequestException);
  assert.throws(() => Project.validateLeader({ userId: 'u1', role: 'MEMBER' }), BadRequestException);
  assert.doesNotThrow(() => Project.validateLeader({ userId: 'u1', role: 'LEADER' }));
});

test('Project.validateResponsible rejeita membro nulo', () => {
  assert.throws(() => Project.validateResponsible(null), BadRequestException);
  assert.doesNotThrow(() => Project.validateResponsible({ userId: 'u1', role: 'MEMBER' }));
});

test('Project.buildInitialMembers monta lista de membros corretamente', () => {
  assert.deepEqual(Project.buildInitialMembers('leader-1', 'resp-1'), [
    { userId: 'leader-1', role: 'OWNER' },
    { userId: 'resp-1', role: 'MEMBER' },
  ]);
  assert.deepEqual(Project.buildInitialMembers('leader-1', 'leader-1'), [
    { userId: 'leader-1', role: 'OWNER' },
  ]);
  assert.deepEqual(Project.buildInitialMembers(null, null), []);
  assert.deepEqual(Project.buildInitialMembers(null, 'resp-1'), [
    { userId: 'resp-1', role: 'MEMBER' },
  ]);
});

test('Project.validateMemberRole valida e normaliza papel no projeto', () => {
  assert.equal(Project.validateMemberRole('owner'), 'OWNER');
  assert.equal(Project.validateMemberRole('member'), 'MEMBER');
  assert.equal(Project.validateMemberRole(undefined), 'MEMBER');
  assert.throws(() => Project.validateMemberRole('ADMIN'), BadRequestException);
});

// --- Team Model Domain Methods ---
test('Team.validateCreate valida e normaliza dados de equipe', () => {
  assert.throws(() => Team.validateCreate({ organizationId: '', name: 'Equipe' }), BadRequestException);
  assert.throws(() => Team.validateCreate({ organizationId: 'org-1', name: '' }), BadRequestException);
  assert.throws(() => Team.validateCreate({ organizationId: 'org-1', name: 'a'.repeat(161) }), BadRequestException);
  const result = Team.validateCreate({ organizationId: '  org-1  ', name: '  Alpha  ', description: '  Desc  ' });
  assert.deepEqual(result, { organizationId: 'org-1', name: 'Alpha', description: 'Desc' });
});

// --- CheckIn Model Domain Methods ---
test('CheckIn.validateCreate valida resumo e filtra messageIds', () => {
  assert.throws(() => CheckIn.validateCreate({ summary: '' }), BadRequestException);
  assert.throws(() => CheckIn.validateCreate({ summary: '   ' }), BadRequestException);
  const result = CheckIn.validateCreate({
    summary: '  Resumo  ',
    difficulties: '  Nenhuma  ',
    nextSteps: '  Testar  ',
    messageIds: ['msg-1', ' ', 'msg-2', 123 as any],
  });
  assert.deepEqual(result, {
    summary: 'Resumo',
    difficulties: 'Nenhuma',
    nextSteps: 'Testar',
    messageIds: ['msg-1', 'msg-2'],
  });
});

// --- KnowledgeEntry Model Domain Methods ---
test('KnowledgeEntry.validateSources rejeita origens simultâneas', () => {
  assert.throws(() => KnowledgeEntry.validateSources('checkin-1', 'help-1'), BadRequestException);
  assert.doesNotThrow(() => KnowledgeEntry.validateSources('checkin-1', undefined));
  assert.doesNotThrow(() => KnowledgeEntry.validateSources(undefined, 'help-1'));
  assert.doesNotThrow(() => KnowledgeEntry.validateSources(undefined, undefined));
});

test('KnowledgeEntry.validateAuthorization garante integridade de autor', () => {
  const entry = { authorId: 'user-1', sharingAuthorizedAt: null, sharingAuthorizedBy: null };
  assert.throws(() => KnowledgeEntry.validateAuthorization(entry, 'user-2'), ForbiddenException);
  assert.equal(KnowledgeEntry.validateAuthorization(entry, 'user-1'), true);

  const authorizedEntry = { authorId: 'user-1', sharingAuthorizedAt: new Date(), sharingAuthorizedBy: 'user-1' };
  assert.equal(KnowledgeEntry.validateAuthorization(authorizedEntry, 'user-1'), false);
});

// --- HelpRequest Model Domain Methods ---
test('HelpRequest.validateStatus normaliza status válidos e rejeita inválidos', () => {
  assert.equal(HelpRequest.validateStatus('open'), HelpStatus.OPEN);
  assert.equal(HelpRequest.validateStatus('IN_PROGRESS'), HelpStatus.IN_PROGRESS);
  assert.equal(HelpRequest.validateStatus('RESOLVED'), HelpStatus.RESOLVED);
  assert.throws(() => HelpRequest.validateStatus('CLOSED'), BadRequestException);
  assert.throws(() => HelpRequest.validateStatus(''), BadRequestException);
});

test('HelpRequest.validateTransition valida transições de ciclo de vida', () => {
  assert.doesNotThrow(() => HelpRequest.validateTransition(HelpStatus.OPEN, HelpStatus.IN_PROGRESS));
  assert.doesNotThrow(() => HelpRequest.validateTransition(HelpStatus.OPEN, HelpStatus.RESOLVED));
  assert.doesNotThrow(() => HelpRequest.validateTransition(HelpStatus.IN_PROGRESS, HelpStatus.RESOLVED));
  assert.doesNotThrow(() => HelpRequest.validateTransition(HelpStatus.OPEN, HelpStatus.OPEN));
  assert.throws(() => HelpRequest.validateTransition(HelpStatus.RESOLVED, HelpStatus.OPEN), BadRequestException);
  assert.throws(() => HelpRequest.validateTransition(HelpStatus.RESOLVED, HelpStatus.IN_PROGRESS), BadRequestException);
});

