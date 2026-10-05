import 'reflect-metadata';
import assert from 'node:assert/strict';
import test from 'node:test';
import { ForbiddenException } from '@nestjs/common';
import { ProjectsService } from './projects.service';
import { ProjectRepository, ProjectRecord } from './project.repository';
import { PrismaProjectRepository } from './prisma-project.repository';
import { PrismaService } from '../prisma.service';
import { AccessControlService } from '../common/auth/access-control.service';
import { ChatProjectCreation, isProjectCreationTurn, ProjectCreationTeam } from './chat-project-creation';

const marina = { id: 'marina', name: 'Marina Souza', role: 'LEADER' as const };
const team: ProjectCreationTeam = { id: 'team', name: 'Automação & Integrações', leaders: [marina] };
const input: ChatProjectCreation = { name: 'Automação de Cobrança', description: 'Cobranças de clientes.', leaderName: 'Marina', teamName: null };

function harness(teams: ProjectCreationTeam[] = [team], allowed = true) {
  const records: ProjectRecord[] = [];
  const writes: Array<Parameters<ProjectRepository['create']>[0]> = [];
  const repo = {
    findCreationTeams: async () => teams,
    list: async (filter?: { teamId?: string; userId?: string; viewerId?: string }) => records.filter(record =>
      (!filter?.teamId || record.teamId === filter.teamId)
      && (!filter?.userId || record.members?.some(member => member.userId === filter.userId))),
    findTeam: async (id: string) => teams.find(item => item.id === id) ?? null,
    findTeamMember: async (teamId: string, id: string) => {
      const current = teams.find(item => item.id === teamId);
      if (!current) return null;
      if (id === 'ryan') return { userId: id, role: 'MEMBER' };
      const leader = current.leaders.find(member => member.id === id);
      return leader ? { userId: id, role: leader.role } : null;
    },
    create: async (data: Parameters<ProjectRepository['create']>[0]) => {
      writes.push(data);
      const now = new Date();
      const record: ProjectRecord = { ...data, id: `created-${writes.length}`, status: 'ACTIVE', createdAt: now, updatedAt: now,
        members: data.members?.map(member => ({ ...member, projectId: `created-${writes.length}`, joinedAt: now })) };
      records.push(record); return record;
    },
  } as unknown as ProjectRepository;
  const access: AccessControlService = { isAdmin: async () => false, isTeamMember: async () => allowed, isTeamLeader: async () => false };
  return { service: new ProjectsService(repo, access), records, writes };
}

test('criação usa o service existente e persiste creator/responsável autenticados, líder e dois membros sem mudar role', async () => {
  const h = harness();
  const result = await h.service.createFromConversation({ ...input, creator: 'attacker', responsibleUserId: 'attacker', leaderId: 'attacker' } as ChatProjectCreation, 'ryan');
  assert.equal(h.writes.length, 1);
  assert.equal(result.project?.name, input.name);
  assert.equal(result.project?.status, 'ACTIVE');
  assert.deepEqual(h.writes[0], { teamId: 'team', name: input.name, description: input.description,
    leaderId: 'marina', responsibleUserId: 'ryan', createdBy: 'ryan', estimatedCompletionAt: null, priority: null,
    members: [{ userId: 'marina', role: 'OWNER' }, { userId: 'ryan', role: 'MEMBER' }] });
  assert.match(result.reply, /criado.*responsável.*Marina Souza.*líder/);
});

test('projeto criado aparece na lista por membro, incluindo criador e líder', async () => {
  const h = harness(); await h.service.createFromConversation(input, 'ryan');
  for (const id of ['ryan', 'marina']) assert.equal((await h.service.list({ userId: id }, id)).length, 1);
});

test('ADMIN pertencente à equipe também pode ser líder conforme domínio existente', async () => {
  const h = harness([{ ...team, leaders: [{ ...marina, role: 'ADMIN' }] }]);
  assert.equal((await h.service.createFromConversation(input, 'ryan')).project?.leaderId, 'marina');
});

test('dois times comuns pedem seleção; resposta com nome do time resolve somente ele', async () => {
  const h = harness([team, { ...team, id: 'second', name: 'Engenharia' }]);
  const pending = await h.service.createFromConversation(input, 'ryan');
  assert.equal(h.writes.length, 0); assert.match(pending.reply, /em qual time.*Automação & Integrações.*Engenharia/);
  assert.equal((await h.service.createFromConversation({ ...input, teamName: 'Engenharia' }, 'ryan')).project?.teamId, 'second');
});

test('team arbitrário fora dos times comuns não cria nem muda para equipe externa', async () => {
  const h = harness(); await h.service.createFromConversation({ ...input, teamName: 'Equipe externa' }, 'ryan');
  assert.equal(h.writes.length, 0);
});

for (const [name, teams] of [['líder inexistente', [team]], ['sem time comum', []], ['MEMBER não é líder', [{ ...team, leaders: [] }]]] as const) {
  test(`${name} não cria, não enumera pessoas externas e explica vínculo/papel válido`, async () => {
    const h = harness(teams.map(item => ({ ...item, leaders: [...item.leaders] })));
    const result = await h.service.createFromConversation({ ...input, leaderName: name === 'líder inexistente' ? 'Inexistente' : 'Marina' }, 'ryan');
    assert.equal(h.writes.length, 0); assert.match(result.reply, /líder válido.*compartilhar uma equipe/);
  });
}

test('homônimos não são desempatados pela ordem; nome completo único pode resolver', async () => {
  const h = harness([{ ...team, leaders: [marina, { ...marina, id: 'other', name: 'Marina Silva' }] }]);
  const result = await h.service.createFromConversation(input, 'ryan');
  assert.match(result.reply, /Marina Souza ou Marina Silva/); assert.equal(h.writes.length, 0);
  assert.equal((await h.service.createFromConversation({ ...input, leaderName: 'Marina Silva' }, 'ryan')).project?.leaderId, 'other');
});

test('dados mínimos ausentes pedem nome/líder sem persistir nada', async () => {
  const h = harness();
  assert.match((await h.service.createFromConversation({ ...input, name: null, leaderName: null }, 'ryan')).reply, /nome.*líder/);
  assert.match((await h.service.createFromConversation({ ...input, leaderName: null }, 'ryan')).reply, /Automação de Cobrança.*Quem será o líder/);
  assert.match((await h.service.createFromConversation({ ...input, name: null }, 'ryan')).reply, /Marina.*Qual será o nome/);
  assert.equal(h.writes.length, 0);
});

test('acesso é revalidado antes de criar mesmo com diretório anteriormente válido', async () => {
  const h = harness([team], false);
  await assert.rejects(h.service.createFromConversation(input, 'ryan'), ForbiddenException);
  assert.equal(h.writes.length, 0);
});

test('nome duplicado no time, diferenças de caixa/acentos e request simultâneo não duplicam', async () => {
  const h = harness();
  const results = await Promise.all([h.service.createFromConversation(input, 'ryan'), h.service.createFromConversation(input, 'ryan')]);
  assert.equal(h.writes.length, 1); assert.ok(results.some(result => /Já existe/.test(result.reply)));
  await h.service.createFromConversation({ ...input, name: '  automacao de cobranca  ' }, 'ryan');
  assert.equal(h.writes.length, 1);
});

test('mesmo nome em outro time não é duplicidade no time selecionado', async () => {
  const h = harness([team, { ...team, id: 'second', name: 'Engenharia' }]);
  for (const teamName of [team.name, 'Engenharia']) await h.service.createFromConversation({ ...input, teamName }, 'ryan');
  assert.equal(h.writes.length, 2);
});

test('repositório resolve apenas equipes do usuário e LEADER/ADMIN, sem consultar diretório global', async () => {
  let query: unknown;
  const repo = new PrismaProjectRepository({ team: { findMany: async (value: unknown) => { query = value; return []; } } } as unknown as PrismaService);
  assert.deepEqual(await repo.findCreationTeams('ryan'), []);
  assert.deepEqual(query, { where: { members: { some: { userId: 'ryan' } } },
    select: { id: true, name: true, members: { where: { user: { role: { in: ['LEADER', 'ADMIN'] } } },
      select: { user: { select: { id: true, name: true, role: true } } } } }, orderBy: { name: 'asc' } });
});

for (const message of ['Cria um projeto chamado Cobrança e coloca Marina como líder.', 'Quero criar um projeto novo.', 'quero criar']) {
  test(`intenção clara: ${message}`, () => assert.equal(isProjectCreationTurn(message, []), true));
}
for (const message of ['Talvez futuramente a gente possa criar um projeto de cobrança.', 'Como eu poderia organizar um projeto de cobrança?',
  'Estou pensando em talvez criar um projeto novo.', 'Estou trabalhando na Automação Financeira.', 'Não quero criar projeto.', 'Já criei um projeto.',
  'Quero criar um projeto se a Marina aceitar.', 'Quero criar uma função Python.']) {
  test(`não cria por engano: ${message}`, () => assert.equal(isProjectCreationTurn(message, []), false));
}
test('respostas curtas continuam somente uma pergunta de criação pendente; confirmação antiga não cria outra vez', () => {
  const pending = [{ role: 'ASSISTANT', content: 'Para criar o projeto, quem será o líder?' }];
  for (const message of ['a Marina', 'Automação & Integrações']) assert.equal(isProjectCreationTurn(message, pending), true);
  assert.equal(isProjectCreationTurn('Cancelar', pending), false);
  assert.equal(isProjectCreationTurn('Hoje terminei os testes no Financeiro.', pending), false);
  assert.equal(isProjectCreationTurn('Agora iniciei a configuração.', [{ role: 'ASSISTANT', content: 'Projeto Cobrança criado.' }]), false);
});
