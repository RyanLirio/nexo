// Opt-in: HTTP e PostgreSQL reais, somente fixtures próprias; não chama OpenAI.
require('reflect-metadata');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const jwt = require('jsonwebtoken');
const { NestFactory } = require('@nestjs/core');
const { AppModule } = require('../dist/app.module');
const { PrismaService } = require('../dist/prisma.service');
const { OpenAIService } = require('../dist/ai/openai.service');
const { ConversationRepository } = require('../dist/conversations/conversation.repository');

async function main() {
  const app = await NestFactory.create(AppModule, { logger: false });
  const db = app.get(PrismaService);
  const prefix = `audit-${randomUUID()}`;
  const id = (suffix) => `${prefix}-${suffix}`;
  const users = ['member', 'leader', 'admin', 'outsider'].map(id);
  const teams = ['team', 'foreign-team'].map(id);
  const projects = ['project', 'foreign-project'].map(id);
  const observed = [];
  try {
    await db.user.createMany({ data: users.map((userId, index) => ({ id: userId,
      name: `Auditoria ${['Member', 'Leader', 'Admin', 'Externo'][index]}`,
      email: `${userId}@example.invalid`, role: ['MEMBER', 'LEADER', 'ADMIN', 'MEMBER'][index] })) });
    await db.team.createMany({ data: teams.map((teamId) => ({ id: teamId, name: teamId })) });
    await db.teamMember.createMany({ data: [0, 1, 3].map((index) => ({
      userId: users[index], teamId: teams[index === 3 ? 1 : 0] })) });
    await db.project.createMany({ data: projects.map((projectId, index) => ({ id: projectId,
      teamId: teams[index], name: index ? 'Projeto externo fictício' : 'Projeto da auditoria' })) });
    await db.projectMember.createMany({ data: [0, 1, 3].map((index) => ({
      userId: users[index], projectId: projects[index === 3 ? 1 : 0] })) });
    await db.helpRequest.create({ data: { id: id('help'), projectId: projects[1], requesterId: users[3], problem: 'Pedido privado fictício.' } });
    await db.conversation.create({ data: { id: id('conversation'), userId: users[3], messages: {
      create: { id: id('message'), senderId: users[3], content: 'Mensagem privada fictícia.' } } } });
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const yesterday = new Date(today); yesterday.setDate(yesterday.getDate() - 1);
    await db.conversation.create({ data: { id: id('own-conversation'), userId: users[0], messages: { create: [
      { id: id('own-user'), senderId: users[0], role: 'USER', content: 'Avanço fictício de hoje.', createdAt: new Date(today.getTime() + 1000) },
      { id: id('own-assistant'), role: 'ASSISTANT', content: 'Resposta fictícia de hoje.', createdAt: new Date(today.getTime() + 2000) },
    ] } } });
    await db.conversation.create({ data: { id: id('yesterday'), userId: users[0], createdAt: yesterday, messages: {
      create: { id: id('old-message'), senderId: users[0], content: 'Mensagem fictícia de ontem.' } } } });
    await db.technicalProblem.create({ data: { id: id('problem'), projectId: projects[1], authorId: users[3],
      title: 'Problema externo fictício', problem: 'Erro técnico fictício.', solution: 'Solução privada de teste.',
      sharingAuthorizedAt: new Date(), sharingAuthorizedBy: users[3] } });
    await db.pendingTechnicalSolutionSuggestion.create({ data: { id: id('pending'), userId: users[3],
      conversationId: id('conversation'), projectId: projects[1], technicalProblemId: id('problem'), similarity: 0.9 } });
    // Apenas a fronteira de IA é stubada nesta auditoria P0; HTTP, JWT e banco são reais.
    app.get(OpenAIService).extractProjectContexts = async () => ({ assistantResponse: 'Conte sobre seu trabalho.', projects: [] });
    await app.listen(0, '127.0.0.1');
    const base = await app.getUrl();
    async function request(label, path, userId, method = 'GET', body, expected = 403) {
      const response = await fetch(base + path, { method,
        headers: { Authorization: `Bearer ${jwt.sign({ sub: userId }, process.env.JWT_SECRET, { expiresIn: '5m' })}`,
          ...(body ? { 'Content-Type': 'application/json' } : {}) },
        ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(10_000) });
      const data = await response.json();
      observed.push({ label, status: response.status, expected });
      console.log(`${label}: ${response.status} (esperado ${expected})`);
      if (!process.argv.includes('--diagnose')) assert.equal(response.status, expected, label);
      return data;
    }
    await request('Status de outro time', `/api/v1/projects/${projects[1]}/status`, users[0], 'PATCH', { status: 'PAUSED' });
    await request('Adicionar membro em outro time', `/api/v1/projects/${projects[1]}/members`, users[0], 'POST', { userId: users[0] });
    const created = await request('Criar projeto em outro time', '/api/v1/projects', users[0], 'POST', { teamId: teams[1], name: 'Tentativa fictícia' });
    if (created.id) projects.push(created.id); // Limpeza exata também da escrita indevidamente permitida.
    await request('Forjar CheckIn de colega', `/api/v1/projects/${projects[0]}/check-ins`, users[0], 'POST', { userId: users[1], summary: 'Atualização forjada fictícia.' });
    await request('Vincular Message privada de outro usuário', `/api/v1/projects/${projects[0]}/check-ins`, users[0], 'POST', { summary: 'Teste de vínculo.', messageIds: [id('message')] });
    await request('Ler HelpRequest externo', `/api/v1/help-requests/${id('help')}`, users[0]);
    await request('Alterar HelpRequest externo', `/api/v1/help-requests/${id('help')}/status`, users[0], 'PATCH', { status: 'IN_PROGRESS' });
    const targetProjects = await request('Projetos de usuário externo', `/api/v1/users/${users[3]}/projects`, users[0], 'GET', undefined, 200);
    console.log(`Projetos externos expostos: ${targetProjects.length}`);
    if (!process.argv.includes('--diagnose')) assert.deepEqual(targetProjects, []);
    await request('Membros de equipe externa', `/api/v1/teams/${teams[1]}/members`, users[0]);
    await request('ADMIN consulta equipe externa', `/api/v1/projects/${projects[1]}`, users[2], 'GET', undefined, 200);
    await request('LEADER consulta própria equipe', `/api/v1/projects/${projects[0]}/leader-view`, users[1], 'GET', undefined, 200);
    await request('MEMBER não acessa leader-view', `/api/v1/projects/${projects[0]}/leader-view`, users[0]);
    if (!process.argv.includes('--diagnose')) {
      const helpList = await request('Lista de ajuda filtrada', '/api/v1/help-requests', users[0], 'GET', undefined, 200);
      assert.ok(!helpList.some((item) => item.id === id('help')));
      await request('Data inválida gera 400', `/api/v1/projects/${projects[0]}/check-ins?startDate=invalid`, users[0], 'GET', undefined, 400);
      const ownHistory = await request('Histórico diário ignora identidade/Conversation alheia',
        `/api/v1/conversations/current?userId=${users[3]}&conversationId=${id('conversation')}`, users[0], 'GET', undefined, 200);
      assert.equal(ownHistory.conversationId, id('own-conversation'));
      assert.deepEqual(ownHistory.messages.map(message => message.id), [id('own-user'), id('own-assistant')]);
      const reload = await request('Reload mantém histórico ordenado sem duplicação', '/api/v1/conversations/current', users[0], 'GET', undefined, 200);
      assert.deepEqual(reload, ownHistory);
      const repository = app.get(ConversationRepository);
      assert.deepEqual(await repository.findConversationMessages(id('conversation'), users[0]), []);
      assert.deepEqual(await repository.findPendingSuggestions(users[0], id('conversation')), []);
      const attemptedAcceptance = await request('Aceite não rouba pending suggestion alheia', '/api/v1/conversations/message', users[0], 'POST', {
        message: 'sim', userId: users[3], conversationId: id('conversation'), suggestionId: id('pending'),
      }, 201);
      assert.ok(!attemptedAcceptance.acceptedSolution);
      assert.ok(!JSON.stringify(attemptedAcceptance).includes('Solução privada de teste.'));
      assert.equal((await db.pendingTechnicalSolutionSuggestion.findUnique({ where: { id: id('pending') } })).status, 'PENDING');
      await request('TechnicalProblem de equipe externa bloqueado', `/api/v1/technical-problems/${id('problem')}`, users[0], 'GET', undefined, 404);
      await request('ADMIN mantém leitura global autorizada', `/api/v1/technical-problems/${id('problem')}`, users[2], 'GET', undefined, 200);
    }
    console.log(JSON.stringify({ runId: prefix, checks: observed.length, success: !process.argv.includes('--diagnose') }));
  } finally {
    await db.$transaction(async (tx) => {
      await tx.technicalProblem.deleteMany({ where: { id: id('problem') } });
      await tx.checkIn.deleteMany({ where: { projectId: { in: projects } } });
      await tx.helpRequest.deleteMany({ where: { projectId: { in: projects } } });
      await tx.conversation.deleteMany({ where: { userId: { in: users } } });
      await tx.projectMember.deleteMany({ where: { projectId: { in: projects } } });
      await tx.project.deleteMany({ where: { id: { in: projects } } });
      await tx.teamMember.deleteMany({ where: { teamId: { in: teams } } });
      await tx.team.deleteMany({ where: { id: { in: teams } } });
      await tx.user.deleteMany({ where: { id: { in: users } } });
    });
    assert.equal(await db.user.count({ where: { id: { in: users } } }), 0);
    console.log('Fixtures próprias removidas; dados reais preservados.');
    await app.close();
  }
}
main().catch((error) => { console.error(error instanceof assert.AssertionError ? error.message : 'Auditoria falhou; consulte a etapa indicada, sem imprimir credenciais.'); process.exitCode = 1; });
