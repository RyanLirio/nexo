// Opt-in: PostgreSQL/OpenAI reais. Fixtures isoladas por UUID; nenhuma seed/migration.
require('dotenv/config');
require('reflect-metadata');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const jwt = require('jsonwebtoken');
const { NestFactory } = require('@nestjs/core');
const { AppModule } = require('../dist/app.module');
const { PrismaService } = require('../dist/prisma.service');
const { OpenAIService } = require('../dist/ai/openai.service');

const runId = `chat-create-${randomUUID()}`;
const ids = { ryan: `${runId}-ryan`, marina: `${runId}-marina`, homonym: `${runId}-homonym`, team: `${runId}-team`, secondTeam: `${runId}-second-team` };
const fixtureUsers = [ids.ryan, ids.marina, ids.homonym];
const fixtureTeams = [ids.team, ids.secondTeam];
let stage = 'configuração';

async function cleanup(prisma) {
  await prisma.$transaction(async tx => {
    const projects = await tx.project.findMany({ where: { teamId: { in: fixtureTeams }, createdBy: ids.ryan }, select: { id: true } });
    const projectIds = projects.map(project => project.id);
    await tx.checkIn.deleteMany({ where: { userId: { in: fixtureUsers }, projectId: { in: projectIds } } });
    await tx.conversation.deleteMany({ where: { userId: { in: fixtureUsers } } });
    await tx.projectMember.deleteMany({ where: { projectId: { in: projectIds } } });
    await tx.project.deleteMany({ where: { id: { in: projectIds } } });
    await tx.teamMember.deleteMany({ where: { teamId: { in: fixtureTeams }, userId: { in: fixtureUsers } } });
    await tx.team.deleteMany({ where: { id: { in: fixtureTeams } } });
    await tx.user.deleteMany({ where: { id: { in: fixtureUsers } } });
  });
  assert.equal(await prisma.project.count({ where: { teamId: { in: fixtureTeams } } }), 0);
  assert.equal(await prisma.user.count({ where: { id: { in: fixtureUsers } } }), 0);
  console.log('Limpeza confirmada: somente fixtures desta execução removidas.');
}

async function main() {
  const app = await NestFactory.create(AppModule, { logger: false, abortOnError: false });
  const prisma = app.get(PrismaService);
  try {
    await app.listen(0, '127.0.0.1');
    await prisma.user.createMany({ data: [
      { id: ids.ryan, name: 'Ryan Teste', email: `${ids.ryan}@example.invalid`, role: 'MEMBER' },
      { id: ids.marina, name: 'Marina Teste', email: `${ids.marina}@example.invalid`, role: 'LEADER' },
    ] });
    await prisma.team.create({ data: { id: ids.team, name: 'Automação & Integrações',
      members: { create: [ids.ryan, ids.marina].map(userId => ({ userId })) } } });
    const ai = app.get(OpenAIService);
    const extract = ai.extractProjectContexts.bind(ai);
    let calls = 0;
    ai.extractProjectContexts = async (...args) => { calls++; return extract(...args); };
    async function request(userId, path, message) {
      const token = jwt.sign({ sub: userId }, process.env.JWT_SECRET, { expiresIn: '10m' });
      const response = await fetch(`${await app.getUrl()}/api/v1/${path}`, {
        method: message === undefined ? 'GET' : 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        ...(message === undefined ? {} : { body: JSON.stringify({ message }) }), signal: AbortSignal.timeout(60_000),
      });
      assert.equal(response.status, message === undefined ? 200 : 201, `HTTP ${response.status} na etapa ${stage}`);
      const result = await response.json();
      if (message !== undefined) console.log(JSON.stringify({ stage, message, response: result.assistantMessage.content }));
      return result;
    }
    const send = (id, message) => request(id, 'conversations/message', message);
    stage = 'criação real em uma mensagem';
    const creation = 'Cria um projeto chamado Projeto Demo Chat, para validar a criação de projetos pelo Nexo, e coloca a Marina como líder.';
    const result = await send(ids.ryan, creation);
    assert.equal(calls, 1, 'Não deve haver uma segunda chamada de IA para criar.');
    assert.deepEqual(result.projects, []);
    const project = await prisma.project.findFirst({ where: { teamId: ids.team, name: 'Projeto Demo Chat' }, include: { members: true } });
    assert.ok(project, 'Projeto não persistido.');
    assert.equal(project.createdBy, ids.ryan); assert.equal(project.responsibleUserId, ids.ryan);
    assert.equal(project.leaderId, ids.marina); assert.equal(project.status, 'ACTIVE');
    assert.deepEqual(project.members.map(member => ({ userId: member.userId, role: member.role })).sort((a, b) => a.role.localeCompare(b.role)),
      [{ userId: ids.ryan, role: 'MEMBER' }, { userId: ids.marina, role: 'OWNER' }]);
    for (const id of [ids.ryan, ids.marina]) {
      assert.ok((await request(id, 'projects')).some(item => item.id === project.id), 'Projeto não aparece na lista autorizada.');
    }
    assert.equal((await prisma.user.findUnique({ where: { id: ids.ryan } })).role, 'MEMBER');
    stage = 'CheckIn posterior no projeto criado';
    const update = await send(ids.ryan, 'Hoje iniciei a configuração do Projeto Demo Chat.');
    assert.equal(update.projects[0]?.projectId, project.id);
    const checkIn = await prisma.checkIn.findFirst({ where: { projectId: project.id, userId: ids.ryan }, include: { messages: true } });
    assert.ok(checkIn); assert.ok(checkIn.messages.some(link => link.messageId === update.messageId));
    stage = 'Marina consulta seus projetos';
    const leader = await send(ids.marina, 'quais projetos eu lidero?');
    assert.deepEqual(leader.projects, []); assert.ok(leader.assistantMessage.content.includes(project.name));
    stage = 'pedido duplicado';
    const duplicate = await send(ids.ryan, creation);
    assert.match(duplicate.assistantMessage.content, /Já existe/);
    assert.equal(await prisma.project.count({ where: { teamId: ids.team } }), 1);
    stage = 'pedido hipotético não cria';
    await send(ids.ryan, 'Talvez futuramente a gente possa criar um projeto de cobrança.');
    assert.equal(await prisma.project.count({ where: { teamId: ids.team } }), 1);
    stage = 'criação multi-turno: intenção sem dados';
    await send(ids.ryan, 'Quero criar um projeto novo.');
    assert.equal(await prisma.project.count({ where: { teamId: ids.team } }), 1);
    stage = 'criação multi-turno: nome';
    await send(ids.ryan, 'Projeto Demo Multi Chat.');
    assert.equal(await prisma.project.count({ where: { teamId: ids.team } }), 1);
    stage = 'criação multi-turno: líder em resposta curta';
    await send(ids.ryan, 'a Marina');
    assert.ok(await prisma.project.findFirst({ where: { teamId: ids.team, name: 'Projeto Demo Multi Chat', leaderId: ids.marina } }));
    stage = 'duas equipes em comum: pergunta time';
    await prisma.team.create({ data: { id: ids.secondTeam, name: 'Engenharia de Teste',
      members: { create: [ids.ryan, ids.marina].map(userId => ({ userId })) } } });
    const askTeam = await send(ids.ryan, 'Cria um projeto chamado Projeto Demo Time e coloca Marina como líder.');
    assert.match(askTeam.assistantMessage.content, /em qual time/);
    assert.equal(await prisma.project.count({ where: { teamId: ids.secondTeam } }), 0);
    stage = 'resposta curta seleciona equipe';
    await send(ids.ryan, 'Engenharia de Teste');
    assert.ok(await prisma.project.findFirst({ where: { teamId: ids.secondTeam, name: 'Projeto Demo Time', leaderId: ids.marina } }));
    stage = 'homônimos: não escolher automaticamente';
    await prisma.user.create({ data: { id: ids.homonym, name: 'Marina Outra', email: `${ids.homonym}@example.invalid`, role: 'LEADER',
      teams: { create: { teamId: ids.team } } } });
    const askLeader = await send(ids.ryan, 'Cria um projeto chamado Projeto Demo Homônimo com Marina como líder.');
    assert.match(askLeader.assistantMessage.content, /Marina Teste ou Marina Outra/);
    assert.equal(await prisma.project.count({ where: { teamId: ids.team, name: 'Projeto Demo Homônimo' } }), 0);
    stage = 'nome completo resolve homônimo';
    await send(ids.ryan, 'Marina Outra');
    assert.ok(await prisma.project.findFirst({ where: { teamId: ids.team, name: 'Projeto Demo Homônimo', leaderId: ids.homonym } }));
    console.log(JSON.stringify({ result: 'OK', projectId: project.id, status: project.status,
      creator: project.createdBy, responsible: project.responsibleUserId, leader: project.leaderId,
      memberList: true, leaderList: true, leaderChat: true, checkInMessage: true, multiTurn: true, teamSelection: true, homonyms: true, duplicateBlocked: true }));
  } catch (error) {
    console.error(`Falhou em: ${stage}. ${error.name === 'AssertionError' ? error.message : error.name}`);
    process.exitCode = 1;
  } finally {
    try { await cleanup(prisma); } finally { await app.close(); }
  }
}
main().catch(error => { console.error(`Falha de inicialização/limpeza: ${error.name}`); process.exitCode = 1; });
