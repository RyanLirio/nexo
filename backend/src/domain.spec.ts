import 'reflect-metadata';
import assert from 'node:assert/strict';
import test from 'node:test';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { CheckInsService } from './check-ins/check-ins.service';
import { HelpRequestsService } from './help-requests/help-requests.service';
import { TechnicalProblemService } from './technical-problems/technical-problem.service';
import { ProjectsService } from './projects/projects.service';
import { PrismaService } from './prisma.service';
import { User, UserRole } from './users/models';
import { Team, TeamMember } from './teams/models';
import { Project, ProjectMember, ProjectStatus, ProjectRole, VALID_PROJECT_STATUSES } from './projects/models';
import { CheckIn } from './check-ins/models';
import { TechnicalProblem } from './technical-problems/models';
import { HelpRequest, HelpStatus, HELP_STATUS_TRANSITIONS } from './help-requests/models';
import { AiToolsService } from './ai/tools/ai-tools.service';
import { AI_TOOL_DEFINITIONS } from './ai/tools/ai-tools.definitions';
import { OpenAIService } from './ai/openai.service';

const embeddingUnavailable = {
  generateEmbedding: async () => { throw new Error('Provider unavailable in unit test'); },
} as unknown as OpenAIService;


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

test('busca de problemas técnicos exige autorização de compartilhamento', async () => {
  let queryCaptured: string | undefined;
  const repo = {
    list: async (query?: string) => {
      queryCaptured = query;
      return [];
    },
  } as unknown as import('./technical-problems/technical-problem.repository').TechnicalProblemRepository;
  const service = new TechnicalProblemService(repo, embeddingUnavailable);

  await service.list('porta');
  assert.equal(queryCaptured, 'porta');
});

test('rejeita criação de problema técnico com duas origens simultâneas', async () => {
  const repo = {
    projectExists: async () => true,
    isProjectMember: async () => true,
  } as unknown as import('./technical-problems/technical-problem.repository').TechnicalProblemRepository;
  const service = new TechnicalProblemService(repo, embeddingUnavailable);

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

test('cria problema técnico mesmo sem solução', async () => {
  let saved: Record<string, unknown> | undefined;
  const repo = {
    projectExists: async () => true,
    isProjectMember: async () => true,
    create: async (data: Record<string, unknown>) => {
      saved = data;
      return { id: 'know-pending', ...data } as any;
    },
  } as unknown as import('./technical-problems/technical-problem.repository').TechnicalProblemRepository;
  const service = new TechnicalProblemService(repo, embeddingUnavailable);

  await service.create({
    projectId: 'project-1',
    authorId: 'user-1',
    title: 'Falha ainda em análise',
    problem: 'A integração retorna timeout de forma intermitente.',
  });

  assert.equal(saved?.problem, 'A integração retorna timeout de forma intermitente.');
  assert.equal(saved?.solution, null);
});

test('continua criando problema técnico com problema e solução', async () => {
  let saved: Record<string, unknown> | undefined;
  const repo = {
    projectExists: async () => true,
    isProjectMember: async () => true,
    create: async (data: Record<string, unknown>) => {
      saved = data;
      return { id: 'know-solved', ...data } as any;
    },
  } as unknown as import('./technical-problems/technical-problem.repository').TechnicalProblemRepository;
  const service = new TechnicalProblemService(repo, embeddingUnavailable);

  await service.create({
    projectId: 'project-1',
    authorId: 'user-1',
    title: 'Timeout resolvido',
    problem: 'A integração retornava timeout.',
    solution: '  Ajustar o tempo limite do cliente HTTP.  ',
  });

  assert.equal(saved?.problem, 'A integração retornava timeout.');
  assert.equal(saved?.solution, 'Ajustar o tempo limite do cliente HTTP.');
});

test('autorização de problema técnico preenche autorizador e timestamp juntos', async () => {
  let authorizedCall: { id: string; authorId: string; date: Date } | undefined;
  const repo = {
    findById: async () => ({ id: 'know-1', authorId: 'user-1', sharingAuthorizedAt: null }),
    authorize: async (id: string, authorId: string, date: Date) => {
      authorizedCall = { id, authorId, date };
      return { id, authorId, sharingAuthorizedBy: authorId, sharingAuthorizedAt: date } as any;
    },
  } as unknown as import('./technical-problems/technical-problem.repository').TechnicalProblemRepository;
  const service = new TechnicalProblemService(repo, embeddingUnavailable);

  await service.authorize('know-1', { authorId: 'user-1' });

  assert.equal(authorizedCall?.id, 'know-1');
  assert.equal(authorizedCall?.authorId, 'user-1');
  assert.ok(authorizedCall?.date instanceof Date);
});

test('rejeita autorização de problema técnico feita por outro usuário que não seja o autor', async () => {
  const repo = {
    findById: async () => ({ id: 'know-1', authorId: 'user-ryan', sharingAuthorizedAt: null }),
  } as unknown as import('./technical-problems/technical-problem.repository').TechnicalProblemRepository;
  const service = new TechnicalProblemService(repo, embeddingUnavailable);

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

test('criação de projeto aceita líder com papel ADMIN', async () => {
  const repo = {
    findTeam: async () => ({ id: 'team-1' }),
    findTeamMember: async (_teamId: string, userId: string) => {
      if (userId === 'user-admin') return { userId: 'user-admin', role: 'ADMIN' };
      return null;
    },
    create: async (data: Record<string, unknown>) => ({ id: 'proj-admin', ...data }),
  } as unknown as import('./projects/project.repository').ProjectRepository;
  const service = new ProjectsService(repo);

  const result = await service.create({
    teamId: 'team-1',
    name: 'Projeto Admin',
    leaderId: 'user-admin',
  });

  assert.equal(result.id, 'proj-admin');
});

test('criação de projeto aceita estimatedCompletionAt e priority válidos', async () => {
  let projectCreated: Record<string, unknown> | undefined;
  const repo = {
    findTeam: async () => ({ id: 'team-1' }),
    create: async (data: Record<string, unknown>) => {
      projectCreated = data;
      return { id: 'proj-priority', ...data };
    },
  } as unknown as import('./projects/project.repository').ProjectRepository;
  const service = new ProjectsService(repo);

  const targetDate = '2026-12-31T23:59:59.000Z';
  const result = await service.create({
    teamId: 'team-1',
    name: 'Projeto Prioritário',
    priority: 85,
    estimatedCompletionAt: targetDate,
  });

  assert.equal(result.id, 'proj-priority');
  assert.equal(projectCreated?.priority, 85);
  assert.ok(projectCreated?.estimatedCompletionAt instanceof Date);
  assert.equal((projectCreated?.estimatedCompletionAt as Date).toISOString(), targetDate);
});

test('criação de projeto com campos de estimativa e prioridade omitidos persiste como null', async () => {
  let projectCreated: Record<string, unknown> | undefined;
  const repo = {
    findTeam: async () => ({ id: 'team-1' }),
    create: async (data: Record<string, unknown>) => {
      projectCreated = data;
      return { id: 'proj-sem-prioridade', ...data };
    },
  } as unknown as import('./projects/project.repository').ProjectRepository;
  const service = new ProjectsService(repo);

  await service.create({
    teamId: 'team-1',
    name: 'Projeto Normal',
  });

  assert.equal(projectCreated?.priority, null);
  assert.equal(projectCreated?.estimatedCompletionAt, null);
});

test('criação de projeto rejeita prioridade fora do intervalo 0 a 100', async () => {
  const repo = {
    findTeam: async () => ({ id: 'team-1' }),
  } as unknown as import('./projects/project.repository').ProjectRepository;
  const service = new ProjectsService(repo);

  await assert.rejects(
    service.create({
      teamId: 'team-1',
      name: 'Projeto Inválido',
      priority: 150,
    }),
    BadRequestException,
  );

  await assert.rejects(
    service.create({
      teamId: 'team-1',
      name: 'Projeto Inválido Negativo',
      priority: -5,
    }),
    BadRequestException,
  );
});

test('criação de projeto rejeita data de estimativa inválida', async () => {
  const repo = {
    findTeam: async () => ({ id: 'team-1' }),
  } as unknown as import('./projects/project.repository').ProjectRepository;
  const service = new ProjectsService(repo);

  await assert.rejects(
    service.create({
      teamId: 'team-1',
      name: 'Projeto Data Inválida',
      estimatedCompletionAt: 'data-invalida',
    }),
    BadRequestException,
  );
});

test('atualização de projeto permite que líder atualize estimativa e prioridade', async () => {
  let updateData: Record<string, unknown> | undefined;
  const repo = {
    findById: async () => ({
      id: 'proj-1',
      teamId: 'team-1',
      leaderId: 'user-leader',
      status: 'ACTIVE',
    }),
    findTeamMember: async () => null,
    findMember: async () => null,
    update: async (id: string, data: Record<string, unknown>) => {
      updateData = data;
      return { id, ...data };
    },
  } as unknown as import('./projects/project.repository').ProjectRepository;
  const service = new ProjectsService(repo);

  const targetDate = '2026-11-30T10:00:00.000Z';
  const updated = await service.update('proj-1', {
    priority: 90,
    estimatedCompletionAt: targetDate,
  }, 'user-leader');

  assert.equal(updateData?.priority, 90);
  assert.ok(updateData?.estimatedCompletionAt instanceof Date);
  assert.equal((updateData?.estimatedCompletionAt as Date).toISOString(), targetDate);
  assert.equal(updated.id, 'proj-1');
});

test('atualização de projeto permite que desenvolvedor membro da equipe atualize dados', async () => {
  let updateData: Record<string, unknown> | undefined;
  const repo = {
    findById: async () => ({
      id: 'proj-1',
      teamId: 'team-1',
      leaderId: 'user-leader',
      status: 'ACTIVE',
    }),
    findTeamMember: async (teamId: string, userId: string) => {
      if (teamId === 'team-1' && userId === 'user-dev') return { userId: 'user-dev', role: 'MEMBER' };
      return null;
    },
    findMember: async () => null,
    update: async (id: string, data: Record<string, unknown>) => {
      updateData = data;
      return { id, ...data };
    },
  } as unknown as import('./projects/project.repository').ProjectRepository;
  const service = new ProjectsService(repo);

  await service.update('proj-1', {
    priority: 40,
    name: 'Projeto Renomeado',
  }, 'user-dev');

  assert.equal(updateData?.priority, 40);
  assert.equal(updateData?.name, 'Projeto Renomeado');
});

test('atualização de projeto rejeita usuário sem vínculo com equipe ou liderança com ForbiddenException', async () => {
  const repo = {
    findById: async () => ({
      id: 'proj-1',
      teamId: 'team-1',
      leaderId: 'user-leader',
      status: 'ACTIVE',
    }),
    findTeamMember: async () => null,
    findMember: async () => null,
  } as unknown as import('./projects/project.repository').ProjectRepository;
  const service = new ProjectsService(repo);

  await assert.rejects(
    service.update('proj-1', { priority: 50 }, 'user-estranho'),
    ForbiddenException,
  );
});

test('atualização de projeto rejeita prioridade fora de [0, 100]', async () => {
  const repo = {
    findById: async () => ({
      id: 'proj-1',
      teamId: 'team-1',
      leaderId: 'user-leader',
      status: 'ACTIVE',
    }),
  } as unknown as import('./projects/project.repository').ProjectRepository;
  const service = new ProjectsService(repo);

  await assert.rejects(
    service.update('proj-1', { priority: 120 }, 'user-leader'),
    BadRequestException,
  );
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
  assert.equal(result.role, UserRole.MEMBER);
});

test('User identifica papéis de acesso corretamente', () => {
  const now = new Date();
  const admin = new User({ id: '1', name: 'Admin', email: 'admin@nexo.dev', role: UserRole.ADMIN, createdAt: now, updatedAt: now });
  const leader = new User({ id: '2', name: 'Leader', email: 'leader@nexo.dev', role: UserRole.LEADER, createdAt: now, updatedAt: now });
  const member = new User({ id: '3', name: 'Member', email: 'member@nexo.dev', role: UserRole.MEMBER, createdAt: now, updatedAt: now });

  assert.equal(admin.isAdmin, true);
  assert.equal(admin.isLeader, false);
  assert.equal(leader.isLeader, true);
  assert.equal(leader.isAdmin, false);
  assert.equal(member.isMember, true);
  assert.equal(member.isLeader, false);
});

test('User.validateRole valida e normaliza papéis', () => {
  assert.equal(User.validateRole('admin'), UserRole.ADMIN);
  assert.equal(User.validateRole('leader'), UserRole.LEADER);
  assert.equal(User.validateRole('member'), UserRole.MEMBER);
  assert.equal(User.validateRole(undefined), UserRole.MEMBER);
  assert.throws(() => User.validateRole('INVALIDO'), BadRequestException);
});

test('User.validateCreate aceita e valida role', () => {
  const result = User.validateCreate({ name: 'Ryan', email: 'ryan@nexo.dev', role: 'leader' });
  assert.equal(result.role, UserRole.LEADER);
});


// --- TeamMember Model ---
test('TeamMember instancia associação pura', () => {
  const member = new TeamMember({ teamId: 't1', userId: 'u1', joinedAt: new Date() });
  assert.equal(member.teamId, 't1');
  assert.equal(member.userId, 'u1');
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

// --- TechnicalProblem Model ---
test('TechnicalProblem.isAuthorized reflete estado de autorização', () => {
  const now = new Date();
  const authorized = new TechnicalProblem({
    id: 'k1', projectId: 'p1', authorId: 'u1', title: 'T', problem: 'P', solution: 'S',
    sharingAuthorizedAt: now, sharingAuthorizedBy: 'u1', createdAt: now, updatedAt: now,
  });
  const pending = new TechnicalProblem({
    id: 'k2', projectId: 'p1', authorId: 'u1', title: 'T', problem: 'P', solution: 'S',
    createdAt: now, updatedAt: now,
  });
  assert.equal(authorized.isAuthorized, true);
  assert.equal(pending.isAuthorized, false);
});

test('TechnicalProblem aceita problema sem solução conhecida', () => {
  const now = new Date();
  const entry = new TechnicalProblem({
    id: 'k-pending', projectId: 'p1', authorId: 'u1', title: 'Em análise', problem: 'Falha intermitente',
    createdAt: now, updatedAt: now,
  });

  assert.equal(entry.problem, 'Falha intermitente');
  assert.equal(entry.problemEmbedding, null);
  assert.equal(entry.solution, null);
});

test('TechnicalProblem.hasDualSource detecta origens conflitantes', () => {
  const now = new Date();
  const dual = new TechnicalProblem({
    id: 'k1', projectId: 'p1', authorId: 'u1', title: 'T', problem: 'P', solution: 'S',
    sourceCheckInId: 'c1', sourceHelpRequestId: 'h1', createdAt: now, updatedAt: now,
  });
  const single = new TechnicalProblem({
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

test('Project.validateLeader rejeita membro nulo ou sem papel LEADER/ADMIN', () => {
  assert.throws(() => Project.validateLeader(null), BadRequestException);
  assert.throws(() => Project.validateLeader({ userId: 'u1', role: 'MEMBER' }), BadRequestException);
  assert.doesNotThrow(() => Project.validateLeader({ userId: 'u1', role: 'LEADER' }));
  assert.doesNotThrow(() => Project.validateLeader({ userId: 'u1', role: 'ADMIN' }));
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

test('Project.validatePriority aceita valores inteiros entre 0 e 100 e rejeita inválidos', () => {
  assert.equal(Project.validatePriority(0), 0);
  assert.equal(Project.validatePriority(50), 50);
  assert.equal(Project.validatePriority(100), 100);
  assert.equal(Project.validatePriority('75'), 75);
  assert.equal(Project.validatePriority(null), null);
  assert.equal(Project.validatePriority(undefined), null);
  assert.throws(() => Project.validatePriority(-1), BadRequestException);
  assert.throws(() => Project.validatePriority(101), BadRequestException);
  assert.throws(() => Project.validatePriority(45.5), BadRequestException);
  assert.throws(() => Project.validatePriority('invalido'), BadRequestException);
});

test('Project.validateEstimatedCompletionAt aceita data válida e rejeita inválida', () => {
  const dateStr = '2026-12-31T00:00:00.000Z';
  const parsed = Project.validateEstimatedCompletionAt(dateStr);
  assert.ok(parsed instanceof Date);
  assert.equal(parsed.toISOString(), dateStr);
  assert.equal(Project.validateEstimatedCompletionAt(null), null);
  assert.equal(Project.validateEstimatedCompletionAt(undefined), null);
  assert.throws(() => Project.validateEstimatedCompletionAt('data-invalida'), BadRequestException);
});

test('Project.validateMemberRole valida e normaliza papel no projeto', () => {
  assert.equal(Project.validateMemberRole('owner'), 'OWNER');
  assert.equal(Project.validateMemberRole('member'), 'MEMBER');
  assert.equal(Project.validateMemberRole(undefined), 'MEMBER');
  assert.throws(() => Project.validateMemberRole('ADMIN'), BadRequestException);
});

// --- Team Model Domain Methods ---
test('Team.validateCreate valida e normaliza dados de equipe', () => {
  assert.throws(() => Team.validateCreate({ name: '' }), BadRequestException);
  assert.throws(() => Team.validateCreate({ name: 'a'.repeat(161) }), BadRequestException);
  const result = Team.validateCreate({ name: '  Alpha  ', description: '  Desc  ' });
  assert.deepEqual(result, { name: 'Alpha', description: 'Desc' });
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

// --- TechnicalProblem Model Domain Methods ---
test('TechnicalProblem.validateSources rejeita origens simultâneas', () => {
  assert.throws(() => TechnicalProblem.validateSources('checkin-1', 'help-1'), BadRequestException);
  assert.doesNotThrow(() => TechnicalProblem.validateSources('checkin-1', undefined));
  assert.doesNotThrow(() => TechnicalProblem.validateSources(undefined, 'help-1'));
  assert.doesNotThrow(() => TechnicalProblem.validateSources(undefined, undefined));
});

test('TechnicalProblem.validateAuthorization garante integridade de autor', () => {
  const entry = { authorId: 'user-1', sharingAuthorizedAt: null, sharingAuthorizedBy: null };
  assert.throws(() => TechnicalProblem.validateAuthorization(entry, 'user-2'), ForbiddenException);
  assert.equal(TechnicalProblem.validateAuthorization(entry, 'user-1'), true);

  const authorizedEntry = { authorId: 'user-1', sharingAuthorizedAt: new Date(), sharingAuthorizedBy: 'user-1' };
  assert.equal(TechnicalProblem.validateAuthorization(authorizedEntry, 'user-1'), false);
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

// --- AiToolsService & Dispatcher ---
test('AiToolsService exporta o catálogo de definições com 6 tools', () => {
  assert.equal(AI_TOOL_DEFINITIONS.length, 6);
  const toolNames = AI_TOOL_DEFINITIONS.map((t) => t.function.name);
  assert.deepEqual(toolNames.sort(), [
    'get_project_context',
    'get_recent_messages',
    'get_user_projects',
    'manage_technical_problem',
    'save_checkin',
    'search_knowledge_base',
  ].sort());
});

test('AiToolsService.executeTool rejeita ferramenta desconhecida com BadRequestException', async () => {
  const service = new AiToolsService(
    {} as any,
    {} as any,
    {} as any,
    {} as any,
  );
  await assert.rejects(
    service.executeTool('unknown_tool', {}, 'user-1'),
    BadRequestException,
  );
});

test('AiToolsService.executeTool rejeita execução sem userId com BadRequestException', async () => {
  const service = new AiToolsService(
    {} as any,
    {} as any,
    {} as any,
    {} as any,
  );
  await assert.rejects(
    service.executeTool('get_user_projects', {}, ''),
    BadRequestException,
  );
});

test('AiToolsService.executeTool rejeita acesso a projeto de não-membro com ForbiddenException', async () => {
  const mockProjectsService = {
    isMember: async () => false,
  };
  const service = new AiToolsService(
    mockProjectsService as any,
    {} as any,
    {} as any,
    {} as any,
  );
  await assert.rejects(
    service.executeTool('get_project_context', { projectId: 'proj-secret' }, 'user-stranger'),
    ForbiddenException,
  );
});

test('AiToolsService.executeTool(get_user_projects) retorna lista de projetos ativos do usuário', async () => {
  let capturedFilter: unknown;
  const mockProjectsService = {
    list: async (filter: unknown) => {
      capturedFilter = filter;
      return [{ id: 'p1', name: 'Nexo' }];
    },
  };
  const service = new AiToolsService(
    mockProjectsService as any,
    {} as any,
    {} as any,
    {} as any,
  );

  const result = await service.executeTool('get_user_projects', {}, 'user-1');
  assert.deepEqual(capturedFilter, { userId: 'user-1', status: 'ACTIVE' });
  assert.deepEqual(result, [{ id: 'p1', name: 'Nexo' }]);
});

test('AiToolsService.executeTool(get_project_context) agrega metadados, prioridade, estimativa e membros', async () => {
  const mockProjectsService = {
    isMember: async () => true,
    getById: async (id: string) => ({
      id,
      name: 'Nexo AI',
      description: 'Gestão Inteligente',
      status: 'ACTIVE',
      priority: 85,
      estimatedCompletionAt: new Date('2026-12-31'),
      team: { id: 'team-1', name: 'Alpha' },
      leader: { id: 'user-1', name: 'Gustavo' },
      responsibleUser: { id: 'user-2', name: 'Ryan' },
      members: [
        { userId: 'user-1', role: 'OWNER', user: { name: 'Gustavo', email: 'g@example.com' } },
        { userId: 'user-2', role: 'MEMBER', user: { name: 'Ryan', email: 'r@example.com' } },
      ],
      checkIns: [{ id: 'chk-1', summary: 'Daily ok' }],
      technicalProblems: [{ id: 'tp-1', title: 'OAuth expira', technology: 'Auth' }],
    }),
  };
  const service = new AiToolsService(
    mockProjectsService as any,
    {} as any,
    {} as any,
    {} as any,
  );

  const context: any = await service.executeTool('get_project_context', { projectId: 'p1' }, 'user-1');
  assert.equal(context.id, 'p1');
  assert.equal(context.name, 'Nexo AI');
  assert.equal(context.priority, 85);
  assert.equal(context.members.length, 2);
  assert.equal(context.latestCheckIn.id, 'chk-1');
  assert.equal(context.openTechnicalProblems[0].id, 'tp-1');
});

test('AiToolsService.executeTool(get_recent_messages) consulta mensagens via conversationRepo', async () => {
  let capturedUserId: string | undefined;
  let capturedLimit: number | undefined;
  const mockConversationRepo = {
    findRecentMessages: async (userId: string, limit?: number) => {
      capturedUserId = userId;
      capturedLimit = limit;
      return [{ id: 'msg-1', content: 'Olá', role: 'USER' }];
    },
  };
  const service = new AiToolsService(
    {} as any,
    {} as any,
    {} as any,
    mockConversationRepo as any,
  );

  const res: any = await service.executeTool('get_recent_messages', { limit: 5 }, 'user-42');
  assert.equal(capturedUserId, 'user-42');
  assert.equal(capturedLimit, 5);
  assert.equal(res.messages.length, 1);
});

test('AiToolsService.executeTool(save_checkin) chama checkInsService.saveCheckIn', async () => {
  let savedArgs: unknown;
  const mockProjectsService = {
    isMember: async () => true,
  };
  const mockCheckInsService = {
    saveCheckIn: async (projectId: string, args: unknown, userId: string) => {
      savedArgs = { projectId, args, userId };
      return { id: 'checkin-1', projectId, userId, summary: 'Progresso diário' };
    },
  };
  const service = new AiToolsService(
    mockProjectsService as any,
    mockCheckInsService as any,
    {} as any,
    {} as any,
  );

  const res: any = await service.executeTool('save_checkin', { projectId: 'p1', summary: 'Feito feature A' }, 'user-1');
  assert.equal(res.id, 'checkin-1');
  assert.deepEqual(savedArgs, {
    projectId: 'p1',
    args: { projectId: 'p1', summary: 'Feito feature A' },
    userId: 'user-1',
  });
});

test('AiToolsService.executeTool(manage_technical_problem, create) chama technicalProblemService.create', async () => {
  let createdData: unknown;
  const mockProjectsService = {
    isMember: async () => true,
  };
  const mockTechService = {
    create: async (args: unknown, userId: string) => {
      createdData = { args, userId };
      return { id: 'tp-new', title: 'Bug SSL' };
    },
  };
  const service = new AiToolsService(
    mockProjectsService as any,
    {} as any,
    mockTechService as any,
    {} as any,
  );

  const res: any = await service.executeTool(
    'manage_technical_problem',
    { action: 'create', projectId: 'p1', title: 'Bug SSL', problem: 'SSL expirado' },
    'user-1',
  );
  assert.equal(res.id, 'tp-new');
  assert.equal((createdData as any).userId, 'user-1');
});

test('AiToolsService.executeTool(manage_technical_problem, resolve) chama technicalProblemService.updateSolution', async () => {
  let resolvedData: unknown;
  const mockProjectsService = {
    isMember: async () => true,
  };
  const mockTechService = {
    updateSolution: async (problemId: string, solution: string, userId: string) => {
      resolvedData = { problemId, solution, userId };
      return { id: problemId, solution };
    },
  };
  const service = new AiToolsService(
    mockProjectsService as any,
    {} as any,
    mockTechService as any,
    {} as any,
  );

  const res: any = await service.executeTool(
    'manage_technical_problem',
    { action: 'resolve', projectId: 'p1', problemId: 'tp-10', solution: 'Atualizar certbot' },
    'user-1',
  );
  assert.equal(res.id, 'tp-10');
  assert.deepEqual(resolvedData, {
    problemId: 'tp-10',
    solution: 'Atualizar certbot',
    userId: 'user-1',
  });
});

test('AiToolsService.executeTool(search_knowledge_base) delega para technicalProblemService.list', async () => {
  let queryCaptured: string | undefined;
  let projectCaptured: string | undefined;
  const mockProjectsService = {
    isMember: async () => true,
  };
  const mockTechService = {
    list: async (query?: string, projectId?: string) => {
      queryCaptured = query;
      projectCaptured = projectId;
      return [{ id: 'tp-1', solution: 'Reiniciar gateway' }];
    },
  };
  const service = new AiToolsService(
    mockProjectsService as any,
    {} as any,
    mockTechService as any,
    {} as any,
  );

  const res: any = await service.executeTool('search_knowledge_base', { query: 'gateway', projectId: 'p1' }, 'user-1');
  assert.equal(queryCaptured, 'gateway');
  assert.equal(projectCaptured, 'p1');
  assert.equal(res.length, 1);
});

// --- Ticket 4: Endpoints e Serviços da Visão do Líder ---
test('ProjectsService.getLeaderView retorna dados consolidados quando usuário é membro/líder', async () => {
  const mockRepo = {
    findById: async (id: string) => ({
      id,
      name: 'Projeto Beta',
      leaderId: 'leader-1',
      teamId: 't-1',
      priority: 50,
      estimatedCompletionAt: null,
      members: [{ userId: 'leader-1', role: 'OWNER' }],
      checkIns: [{ id: 'chk-1', summary: 'Status ok' }],
      technicalProblems: [{ id: 'tp-1', title: 'DB lock' }],
    }),
    findMember: async () => null,
    findTeamMember: async () => null,
  };
  const service = new ProjectsService(mockRepo as any);
  const view = await service.getLeaderView('p-beta', 'leader-1');
  assert.equal(view.id, 'p-beta');
  assert.equal(view.priority, 50);
  assert.equal(view.latestCheckIn.id, 'chk-1');
  assert.equal(view.openTechnicalProblems[0].id, 'tp-1');
});

test('ProjectsService.getLeaderView rejeita usuário não membro com ForbiddenException', async () => {
  const mockRepo = {
    findById: async (id: string) => ({
      id,
      name: 'Projeto Beta',
      leaderId: 'leader-1',
      teamId: 't-1',
    }),
    findMember: async () => null,
    findTeamMember: async () => null,
  };
  const service = new ProjectsService(mockRepo as any);
  await assert.rejects(
    service.getLeaderView('p-beta', 'user-outsider'),
    ForbiddenException,
  );
});

test('CheckInsService.list repassa filtros de userId e datas ao repositório', async () => {
  let capturedFilter: unknown;
  const mockRepo = {
    projectExists: async () => true,
    listByProject: async (projectId: string, filter?: unknown) => {
      capturedFilter = filter;
      return [];
    },
  };
  const service = new CheckInsService(mockRepo as any);
  const startDate = new Date('2026-01-01');
  const endDate = new Date('2026-01-31');
  await service.list('p-1', { userId: 'u-1', startDate, endDate });
  assert.deepEqual(capturedFilter, { userId: 'u-1', startDate, endDate });
});

test('TechnicalProblemService.updateSolution atualiza solução para membro autorizado', async () => {
  let updatedSolution: string | undefined;
  const mockRepo = {
    findById: async (id: string) => ({ id, projectId: 'p-1', authorId: 'u-1' }),
    isProjectMember: async () => true,
    updateSolution: async (id: string, solution: string) => {
      updatedSolution = solution;
      return { id, solution } as any;
    },
  };
  const service = new TechnicalProblemService(mockRepo as any, embeddingUnavailable);
  const res = await service.updateSolution('tp-1', 'Corrigido com retry', 'u-1');
  assert.equal(updatedSolution, 'Corrigido com retry');
  assert.equal(res.solution, 'Corrigido com retry');
});

test('TechnicalProblemService.updateSolution rejeita solução vazia com BadRequestException', async () => {
  const service = new TechnicalProblemService({} as any, embeddingUnavailable);
  await assert.rejects(
    service.updateSolution('tp-1', '   ', 'u-1'),
    BadRequestException,
  );
});


