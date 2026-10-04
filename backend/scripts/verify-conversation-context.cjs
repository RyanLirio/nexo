// Opt-in: PostgreSQL e OpenAI reais, somente fixtures fictícias com limpeza por IDs.
require('dotenv/config');
require('reflect-metadata');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const jwt = require('jsonwebtoken');
const { NestFactory } = require('@nestjs/core');
const { AppModule } = require('../dist/app.module');
const { PrismaService } = require('../dist/prisma.service');
const { OpenAIService } = require('../dist/ai/openai.service');
const { TechnicalProblemService } = require('../dist/technical-problems/technical-problem.service');

const runId = `context-test-${randomUUID()}`;
const ids = { user: `${runId}-user`, secondUser: `${runId}-second-user`, team: `${runId}-team`,
  finance: `${runId}-finance`, portal: `${runId}-portal` };
const users = [ids.user, ids.secondUser];
const projects = [{ id: ids.finance, name: 'Automação Financeira', description: 'Fluxos financeiros e bancários.' },
  { id: ids.portal, name: 'Portal de Notas', description: 'Importação de notas fiscais.' }];
const user = content => ({ role: 'USER', content });
const assistant = content => ({ role: 'ASSISTANT', content });
const advance = 'Hoje finalizei os testes da Automação Financeira.';
const difficulty = 'Estou com dificuldade na autenticação do Protheus, mas ainda não sei a causa.';
const technical = 'Descobri que o token OAuth está expirando antes da chamada chegar ao Protheus.';
const both = 'Na Automação Financeira finalizei os testes. No Portal de Notas estou com dificuldade na importação.';
let stage = 'configuração';

async function cleanup(prisma) {
  await prisma.$transaction(async tx => {
    await tx.technicalProblem.deleteMany({ where: { projectId: { in: projects.map(p => p.id) } } });
    await tx.checkIn.deleteMany({ where: { userId: { in: users } } });
    await tx.conversation.deleteMany({ where: { userId: { in: users } } });
    await tx.projectMember.deleteMany({ where: { userId: { in: users } } });
    await tx.project.deleteMany({ where: { id: { in: projects.map(p => p.id) } } });
    await tx.teamMember.deleteMany({ where: { teamId: ids.team } });
    await tx.team.deleteMany({ where: { id: ids.team } });
    await tx.user.deleteMany({ where: { id: { in: users } } });
  });
  assert.equal(await prisma.user.count({ where: { id: { in: users } } }), 0);
  assert.equal(await prisma.project.count({ where: { id: { in: projects.map(p => p.id) } } }), 0);
  console.log('Limpeza confirmada: somente dados fictícios desta execução removidos.');
}

async function verifyReferences(ai) {
  const active = [user(advance), assistant('Boa, os testes da Automação Financeira foram concluídos.')];
  const unknown = [user('Estou com dificuldade na importação.'), assistant('Em qual projeto isso aconteceu?')];
  const cases = [
    { name: 'próximo passo implícito', text: 'Agora meu próximo passo é validar o retorno bancário.', history: active, id: ids.finance, classification: 'NO_PROBLEM' },
    { name: 'dificuldade implícita', text: difficulty, history: active, id: ids.finance, classification: 'DIFFICULTY' },
    { name: 'follow-up técnico', text: technical, history: [...active, user(difficulty), assistant('Você identificou a causa?')], id: ids.finance, classification: 'TECHNICAL_PROBLEM' },
    { name: 'ao financeiro', text: 'ao financeiro', history: unknown, id: ids.finance, classification: 'DIFFICULTY' },
    { name: 'isso', text: 'isso', history: [user('Na Automação Financeira meu próximo passo é validar o retorno bancário.'), assistant('Você vai validar o retorno bancário nesse projeto?')], id: ids.finance, classification: 'NO_PROBLEM' },
    { name: 'acabei de falar acima', text: 'acabei de falar acima', history: [...active, user(difficulty), assistant('Em qual projeto isso aconteceu?')], id: ids.finance, classification: 'DIFFICULTY' },
    { name: 'typo', text: 'na automação financeir', history: unknown, id: ids.finance, classification: 'DIFFICULTY' },
    { name: 'ambiguidade real', text: 'Agora vou validar o retorno.', history: [user('Na Automação Financeira e no Portal de Notas estou testando o retorno.'), assistant('Entendi os testes nos dois projetos.')], id: null },
    { name: 'nesse segundo', text: 'nesse segundo ainda não sei a causa.', history: [user(both), assistant('Entendi os testes e a dificuldade na importação.')], id: ids.portal, classification: 'DIFFICULTY' },
    { name: 'troca explícita financeiro', text: 'no financeiro meu próximo passo é validar o retorno.', history: [user(both), assistant('A dificuldade na importação é no Portal de Notas.'), user('nesse segundo ainda não sei a causa.'), assistant('Entendi que ainda está investigando no Portal de Notas.')], id: ids.finance, classification: 'NO_PROBLEM' },
    { name: 'avanço não herda problema antigo', text: 'Agora concluí a revisão da documentação.', history: [...active, user(difficulty), assistant('Entendi a dificuldade.')], id: ids.finance, classification: 'NO_PROBLEM' },
    { name: 'pergunta do assistente não vira fato', text: 'Finalizei os testes.', history: [user(advance), assistant('Seu próximo passo é implantar amanhã?')], id: ids.finance, classification: 'NO_PROBLEM', noNextSteps: true },
    { name: 'typo ambíguo', text: 'na automação financeir', history: unknown, id: null,
      knownProjects: [{ id: ids.finance, name: 'Automação Financeira A' }, { id: ids.portal, name: 'Automação Financeira B' }] },
  ];
  for (const item of cases) {
    stage = `referência real: ${item.name}`;
    const result = await ai.extractProjectContexts(item.text, item.knownProjects ?? projects, item.history);
    if (!item.id) {
      assert.deepEqual(result.projects, [], `${item.name}: escolheu projeto arbitrariamente.`);
      assert.ok(result.assistantResponse.includes('?'), 'Ambiguidade não pediu esclarecimento.');
    } else {
      assert.deepEqual(result.projects.map(p => p.projectId), [item.id], `${item.name}: projeto incorreto.`);
      assert.equal(result.projects[0].classification, item.classification, `${item.name}: classificação incorreta.`);
      if (item.noNextSteps) assert.equal(result.projects[0].nextSteps, null, 'Sugestão ASSISTANT virou fato.');
      if (item.classification === 'TECHNICAL_PROBLEM') assert.ok(result.projects[0].normalizedProblem?.trim());
    }
    console.log(`Referência ${item.name}: OK; ${JSON.stringify(result.projects)}; resposta=${result.assistantResponse}`);
  }
}

async function verifyConversation(app, prisma, knownId) {
  const baseUrl = await app.getUrl();
  async function send(userId, message) {
    const token = jwt.sign({ sub: userId }, process.env.JWT_SECRET, { expiresIn: '5m' });
    const response = await fetch(`${baseUrl}/api/v1/conversations/message`, {
      method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ message }), signal: AbortSignal.timeout(90_000),
    });
    const result = await response.json();
    assert.equal(response.status, 201, `HTTP: ${JSON.stringify(result)}`);
    console.log(`HTTP mensagem=${message}; resultado=${JSON.stringify(result)}`);
    return result;
  }
  const sequence = [advance, 'Agora meu próximo passo é validar o retorno bancário.', difficulty, technical];
  let conversationId;
  for (let index = 0; index < sequence.length; index += 1) {
    stage = `sequência HTTP real: turno ${index + 1}`;
    const result = await send(ids.user, sequence[index]);
    conversationId ??= result.conversationId;
    assert.equal(result.conversationId, conversationId);
    assert.deepEqual(result.projects.map(p => p.projectId), [ids.finance]);
    assert.equal(result.projects[0].classification, index === 2 ? 'DIFFICULTY' : index === 3 ? 'TECHNICAL_PROBLEM' : 'NO_PROBLEM');
    assert.ok(!/em qual projeto|qual é o projeto/i.test(result.assistantMessage.content));
    if (index === 3) {
      const context = result.projects[0];
      assert.ok(context.normalizedProblem);
      assert.equal(context.solutionSuggestion?.technicalProblemId, knownId);
      assert.ok(context.solutionSuggestion.similarity >= 0.78);
      assert.equal(result.assistantMessage.content, 'Encontrei um problema parecido. Quer ver a solução?');
      const checkIn = await prisma.checkIn.findFirst({ where: { userId: ids.user, projectId: ids.finance }, include: { messages: true } });
      assert.equal(checkIn.messages.length, 4);
      assert.match(checkIn.nextSteps, /retorno bancário/i);
    }
  }
  stage = 'aceite preservado';
  assert.equal((await send(ids.user, 'sim')).acceptedSolution?.technicalProblemId, knownId);
  stage = 'isolamento multi-projeto real';
  const initial = await send(ids.secondUser, both);
  assert.equal(initial.projects.length, 2);
  const second = await send(ids.secondUser, 'nesse segundo ainda não sei a causa.');
  assert.deepEqual(second.projects.map(p => p.projectId), [ids.portal]);
  assert.equal(second.projects[0].classification, 'DIFFICULTY');
  const finance = await send(ids.secondUser, 'no financeiro meu próximo passo é validar o retorno.');
  assert.deepEqual(finance.projects.map(p => p.projectId), [ids.finance]);
  const checkIns = await prisma.checkIn.findMany({ where: { userId: ids.secondUser }, include: { messages: true } });
  assert.equal(checkIns.length, 2);
  assert.equal(checkIns.find(c => c.projectId === ids.finance).difficulties, null);
  assert.equal(checkIns.find(c => c.projectId === ids.portal).nextSteps, null);
  assert.ok(checkIns.find(c => c.projectId === ids.finance).messages.some(m => m.messageId === finance.messageId));
  assert.ok(!checkIns.find(c => c.projectId === ids.portal).messages.some(m => m.messageId === finance.messageId));
  stage = 'typo via HTTP real';
  const typo = await send(ids.secondUser, 'na automação financeir');
  assert.ok(typo.projects.every(p => p.projectId === ids.finance));
  assert.match(typo.assistantMessage.content, /Automa[çc][aã]o Financeira/i);
}

async function main() {
  for (const key of ['DATABASE_URL', 'OPENAI_API_KEY', 'JWT_SECRET']) {
    if (!process.env[key]?.trim()) throw new Error(`Configure ${key}.`);
  }
  let app;
  let prisma;
  let fixturesStarted = false;
  try {
    stage = 'inicialização';
    app = await NestFactory.create(AppModule, { logger: false, abortOnError: false });
    await app.listen(0, '127.0.0.1');
    prisma = app.get(PrismaService);
    fixturesStarted = true;
    await prisma.$transaction(async tx => {
      await tx.user.createMany({ data: users.map(id => ({ id, name: 'Teste contexto fictício', email: `${id}@example.invalid`, role: 'MEMBER' })) });
      await tx.team.create({ data: { id: ids.team, name: runId } });
      await tx.teamMember.createMany({ data: users.map(userId => ({ userId, teamId: ids.team })) });
      await tx.project.createMany({ data: projects.map(project => ({ ...project, teamId: ids.team, status: 'ACTIVE' })) });
      await tx.projectMember.createMany({ data: users.flatMap(userId => projects.map(project => ({ userId, projectId: project.id }))) });
      const previousDay = new Date(Date.now() - 7 * 86400000);
      await tx.conversation.create({ data: { userId: ids.user, createdAt: previousDay,
        messages: { create: { senderId: ids.user, role: 'USER', content: 'No Portal de Notas o contexto antigo não deve entrar hoje.', createdAt: previousDay } } } });
    });
    stage = 'candidato técnico / embedding real';
    const technicalProblems = app.get(TechnicalProblemService);
    const known = await technicalProblems.create({ projectId: ids.portal, title: 'Controle fictício OAuth',
      problem: 'Token OAuth expira antes da requisição durante integração com o Protheus.',
      solution: 'Renovar o token OAuth antes de realizar a requisição ao Protheus.' }, ids.user);
    await technicalProblems.authorize(known.id, {}, ids.user);
    await verifyConversation(app, prisma, known.id);
    await verifyReferences(app.get(OpenAIService));
    console.log('P1: sequência real, busca pgvector, aceite, referências e isolamento validados.');
  } finally {
    try { if (fixturesStarted && prisma) await cleanup(prisma); }
    finally { if (app) await app.close(); }
  }
}

main().catch(error => {
  const detail = error.name === 'AssertionError' || stage === 'configuração' ? error.message : error.name;
  console.error(`Falha em ${stage}: ${detail}`);
  process.exitCode = 1;
});
