// Opt-in: banco real e chamadas OpenAI pagas somente com textos fictícios.
require('dotenv/config');
require('reflect-metadata');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const jwt = require('jsonwebtoken');
const { NestFactory } = require('@nestjs/core');
const { AppModule } = require('../dist/app.module');
const { PrismaService } = require('../dist/prisma.service');
const { TechnicalProblemService } = require('../dist/technical-problems/technical-problem.service');
const { TechnicalProblemRepository } = require('../dist/technical-problems/technical-problem.repository');
const { AiToolsService } = require('../dist/ai/tools/ai-tools.service');
const { ConversationRepository } = require('../dist/conversations/conversation.repository');

const runId = `semantic-test-${randomUUID()}`;
const ids = {
  member: `${runId}-member`,
  leader: `${runId}-leader`,
  admin: `${runId}-admin`,
  outsider: `${runId}-outsider`,
  team: `${runId}-team`,
  foreignTeam: `${runId}-foreign-team`,
  finance: `${runId}-finance`,
  knowledge: `${runId}-knowledge`,
  foreignProject: `${runId}-foreign-project`,
  foreignProblem: `${runId}-foreign-problem`,
  privateProblem: `${runId}-private-problem`,
  emptySolution: `${runId}-empty-solution`,
  noSolution: `${runId}-no-solution`,
};
const userIds = [ids.member, ids.leader, ids.admin, ids.outsider];
const teamIds = [ids.team, ids.foreignTeam];
const projectIds = [ids.finance, ids.knowledge, ids.foreignProject];
const savedProblem = 'Token OAuth expira antes da requisição durante integração com o Protheus.';
const solution = 'Renovar o token OAuth antes de realizar a requisição ao Protheus.';
const paraphrase = 'A autenticação com o Protheus falha porque o token OAuth vence antes do envio da requisição.';
const unrelated = 'A API de boletos retorna erro 500 ao processar pagamentos.';
let stage = 'configuração';

async function createFixtures(prisma) {
  await prisma.$transaction(async (tx) => {
    await tx.user.createMany({ data: userIds.map((id) => ({
      id, name: 'Teste semântico fictício', email: `${id}@example.invalid`,
      role: id === ids.admin ? 'ADMIN' : id === ids.leader ? 'LEADER' : 'MEMBER',
    })) });
    await tx.team.createMany({ data: teamIds.map((id) => ({ id, name: id })) });
    await tx.teamMember.createMany({ data: [
      { teamId: ids.team, userId: ids.member },
      { teamId: ids.team, userId: ids.leader },
      { teamId: ids.foreignTeam, userId: ids.outsider },
    ] });
    await tx.project.createMany({ data: [
      { id: ids.finance, teamId: ids.team, name: `Automação Financeira ${runId}`, description: 'Integração financeira com o Protheus.', status: 'ACTIVE' },
      { id: ids.knowledge, teamId: ids.team, name: `Base Técnica ${runId}`, description: 'Histórico técnico para reaproveitamento entre projetos.', status: 'ACTIVE' },
      { id: ids.foreignProject, teamId: ids.foreignTeam, name: `Projeto externo ${runId}`, status: 'ACTIVE' },
    ] });
    await tx.projectMember.createMany({ data: [
      { projectId: ids.finance, userId: ids.member },
      { projectId: ids.knowledge, userId: ids.member },
      { projectId: ids.foreignProject, userId: ids.outsider },
    ] });
  });
}

async function createRestrictedCandidates(prisma, knownId) {
  // Mesmo vetor real do candidato de controle: testa acesso, consentimento e solução,
  // sem gerar embeddings extras de textos idênticos. Não sobrescreve dados reais.
  for (const candidate of [
    { id: ids.foreignProblem, projectId: ids.foreignProject, authorId: ids.outsider, authorized: true, solution },
    { id: ids.privateProblem, projectId: ids.knowledge, authorId: ids.member, authorized: false, solution },
    { id: ids.emptySolution, projectId: ids.knowledge, authorId: ids.member, authorized: true, solution: '   ' },
    { id: ids.noSolution, projectId: ids.knowledge, authorId: ids.member, authorized: true, solution: null },
  ]) {
    await prisma.technicalProblem.create({ data: {
      id: candidate.id, projectId: candidate.projectId, authorId: candidate.authorId,
      title: 'Controle fictício de fronteira', problem: savedProblem, technology: 'OAuth / Protheus',
      solution: candidate.solution,
      sharingAuthorizedAt: candidate.authorized ? new Date() : null,
      sharingAuthorizedBy: candidate.authorized ? candidate.authorId : null,
    } });
    await prisma.$executeRaw`
      UPDATE "TechnicalProblem" AS target
      SET "problemEmbedding" = source."problemEmbedding"
      FROM "TechnicalProblem" AS source
      WHERE target.id = ${candidate.id} AND source.id = ${knownId}
    `;
  }
}

async function cleanup(prisma) {
  // Apenas IDs exatos desta execução; as relações filhas possuem ON DELETE CASCADE.
  await prisma.$transaction(async (tx) => {
    await tx.technicalProblem.deleteMany({ where: { projectId: { in: projectIds } } });
    await tx.checkIn.deleteMany({ where: { projectId: { in: projectIds } } });
    await tx.conversation.deleteMany({ where: { userId: { in: userIds } } });
    await tx.projectMember.deleteMany({ where: { projectId: { in: projectIds } } });
    await tx.project.deleteMany({ where: { id: { in: projectIds } } });
    await tx.teamMember.deleteMany({ where: { teamId: { in: teamIds } } });
    await tx.team.deleteMany({ where: { id: { in: teamIds } } });
    await tx.user.deleteMany({ where: { id: { in: userIds } } });
  });
  assert.equal(await prisma.user.count({ where: { id: { in: userIds } } }), 0);
  assert.equal(await prisma.project.count({ where: { id: { in: projectIds } } }), 0);
  console.log('Limpeza confirmada: somente fixtures desta execução removidas.');
}

async function verifyTopFive(prisma, repository, knownId) {
  // Seis candidatos elegíveis para provar LIMIT 5, não apenas testar uma lista pequena.
  for (let index = 0; index < 5; index += 1) {
    const id = `${runId}-limit-${index}`;
    await prisma.technicalProblem.create({ data: {
      id, projectId: ids.knowledge, authorId: ids.member, title: 'Controle fictício de limite',
      problem: savedProblem, solution, sharingAuthorizedAt: new Date(), sharingAuthorizedBy: ids.member,
    } });
    await prisma.$executeRaw`
      UPDATE "TechnicalProblem" AS target
      SET "problemEmbedding" = source."problemEmbedding"
      FROM "TechnicalProblem" AS source
      WHERE target.id = ${id} AND source.id = ${knownId}
    `;
  }
  const vectors = await prisma.$queryRaw`SELECT "problemEmbedding"::text AS vector FROM "TechnicalProblem" WHERE id = ${knownId}`;
  const matches = await repository.searchSimilar(ids.member, JSON.parse(vectors[0].vector), 5, 0.78);
  assert.equal(matches.length, 5, 'LIMIT 5 não foi aplicado a seis candidatos elegíveis.');
  assert.ok(matches.every((candidate) => candidate.projectId === ids.knowledge));
  console.log('Top 5 real confirmado com seis candidatos autorizados e vetor persistido.');
}

function assertSharedMatches(results, knownId, allowForeign = false) {
  assert.ok(results.some((candidate) => candidate.id === knownId), 'Paráfrase não encontrou o candidato conhecido acima de 0.78.');
  assert.ok(results.length <= 5, 'Busca excedeu top 5.');
  assert.ok(results.every((candidate) => candidate.similarity >= 0.78));
  if (!allowForeign) assert.ok(!results.some((candidate) => candidate.id === ids.foreignProblem), 'Vazamento de outra equipe.');
  for (const id of [ids.privateProblem, ids.emptySolution, ids.noSolution]) {
    assert.ok(!results.some((candidate) => candidate.id === id), 'Busca semântica ignorou consentimento ou solução.');
  }
  assert.equal(results.find((candidate) => candidate.id === knownId).solution, solution);
  assert.ok(results.every((candidate) => !('problemEmbedding' in candidate)));
}

async function verifyHttp(app, knownId) {
  const prisma = app.get(PrismaService);
  const conversations = app.get(ConversationRepository);
  const baseUrl = await app.getUrl();
  async function request(path, userId, body) {
    const token = userId ? jwt.sign({ sub: userId }, process.env.JWT_SECRET, { expiresIn: '5m' }) : undefined;
    const response = await fetch(`${baseUrl}${path}`, {
      method: body ? 'POST' : 'GET',
      headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}),
      signal: AbortSignal.timeout(180_000),
    });
    return { status: response.status, body: await response.json() };
  }
  assert.equal((await request('/api/v1/technical-problems')).status, 401);
  const textual = await request('/api/v1/technical-problems?query=OAuth', ids.member);
  assert.equal(textual.status, 200);
  assert.ok(textual.body.some((candidate) => candidate.id === knownId));
  assert.ok(!textual.body.some((candidate) => [ids.foreignProblem, ids.privateProblem].includes(candidate.id)));
  assert.equal((await request(`/api/v1/technical-problems/${ids.foreignProblem}`, ids.member)).status, 404);
  assert.equal((await request(`/api/v1/technical-problems/${ids.foreignProblem}`, ids.admin)).status, 200);
  assert.equal((await request(`/api/v1/technical-problems/${ids.privateProblem}`, ids.admin)).status, 404);
  // Rota legada já existente; não corrige sua composição neste pacote.
  const projectProblems = await request(`/api/v1/technical-problems/api/v1/projects/${ids.foreignProject}/technical-problems`, ids.member);
  assert.equal(projectProblems.status, 200);
  assert.deepEqual(projectProblems.body, []);
  assert.equal((await request(`/api/v1/projects/${ids.foreignProject}`, ids.member)).status, 403);
  assert.deepEqual((await request(`/api/v1/projects?teamId=${ids.foreignTeam}`, ids.member)).body, []);
  assert.deepEqual((await request(`/api/v1/projects?userId=${ids.outsider}`, ids.member)).body, []);
  assert.equal((await request(`/api/v1/projects/${ids.foreignProject}/leader-view`, ids.leader)).status, 403);
  assert.equal((await request(`/api/v1/projects/${ids.foreignProject}/leader-view`, ids.admin)).status, 200);
  assert.equal((await request(`/api/v1/projects/${ids.finance}/leader-view`, ids.leader)).status, 200);

  stage = 'Conversation HTTP real / classificação / sugestão sem solução';
  const response = await request('/api/v1/conversations/message', ids.member, {
    message: `Na Automação Financeira ${runId}, a autenticação com o Protheus falha porque o token OAuth vence antes do envio da requisição.`,
  });
  assert.equal(response.status, 201, 'Conversation real não respondeu com sucesso.');
  const context = response.body.projects.find((project) => project.projectId === ids.finance);
  assert.ok(context, 'Extração não identificou o projeto mencionado.');
  assert.equal(context.classification, 'TECHNICAL_PROBLEM');
  assert.ok(context.normalizedProblem?.trim());
  assert.equal(context.solutionSuggestion?.technicalProblemId, knownId);
  assert.ok(context.solutionSuggestion.similarity >= 0.78);
  const json = JSON.stringify(response.body);
  assert.ok(!json.includes('"solution"') && !json.includes('similarProblems') && !json.includes(solution), 'Solução vazou no contrato externo.');
  console.log(`Conversation: classification=${context.classification}; normalizedProblem=${context.normalizedProblem}; similarity=${context.solutionSuggestion.similarity.toFixed(6)}; solução ausente do JSON.`);
  stage = 'Fase 4 / pendência / aceite / recusa / revalidação real';
  const pendingInput = {
    userId: ids.member, conversationId: response.body.conversationId, projectId: ids.finance,
    technicalProblemId: knownId, similarity: context.solutionSuggestion.similarity,
  };
  const pending = await conversations.findPendingSuggestions(ids.member, response.body.conversationId);
  assert.equal(pending.length, 1);
  assert.equal(pending[0].status, 'PENDING');
  assert.equal(pending[0].technicalProblemId, knownId);
  assert.ok(!('solution' in pending[0]) && !('problemEmbedding' in pending[0]));
  stage = 'Fase 4 / Message ASSISTANT da pergunta';
  const question = await prisma.message.findUnique({ where: { id: response.body.assistantMessage.id } });
  assert.equal(question.role, 'ASSISTANT');
  assert.equal(question.content, 'Encontrei um problema parecido. Quer ver a solução?');

  stage = 'Fase 4 / resposta de outro usuário';
  const foreignReply = await request('/api/v1/conversations/message', ids.outsider, { message: 'sim' });
  assert.equal(foreignReply.status, 201);
  assert.ok(!foreignReply.body.acceptedSolution && !JSON.stringify(foreignReply.body).includes(solution));
  assert.equal((await conversations.findPendingSuggestions(ids.member, response.body.conversationId)).length, 1);
  stage = 'Fase 4 / aceite HTTP e status ACCEPTED';
  const accepted = await request('/api/v1/conversations/message', ids.member, { message: 'sim, mostra' });
  assert.equal(accepted.status, 201);
  assert.equal(accepted.body.acceptedSolution.solution, solution);
  assert.equal(accepted.body.acceptedSolution.technicalProblemId, knownId);
  assert.equal(accepted.body.assistantMessage.content, solution);
  assert.equal((await prisma.pendingTechnicalSolutionSuggestion.findUnique({ where: { id: pending[0].id } })).status, 'ACCEPTED');
  assert.equal((await prisma.message.findUnique({ where: { id: accepted.body.assistantMessage.id } })).role, 'ASSISTANT');

  stage = 'Fase 4 / nova pendência e recusa';
  await conversations.savePendingSuggestion(pendingInput);
  const declined = await request('/api/v1/conversations/message', ids.member, { message: 'não' });
  assert.equal(declined.status, 201);
  assert.equal(declined.body.assistantMessage.content, 'Sem problema. Seguimos por aqui.');
  assert.ok(!declined.body.acceptedSolution && !JSON.stringify(declined.body).includes(solution));
  assert.equal((await prisma.pendingTechnicalSolutionSuggestion.findUnique({ where: { id: pending[0].id } })).status, 'DECLINED');

  await conversations.savePendingSuggestion(pendingInput);
  stage = 'Fase 4 / retirada de TeamMember e revalidação';
  await prisma.teamMember.delete({ where: { teamId_userId: { teamId: ids.team, userId: ids.member } } });
  const lostAccess = await request('/api/v1/conversations/message', ids.member, { message: 'mostra' });
  assert.equal(lostAccess.status, 201);
  assert.ok(!lostAccess.body.acceptedSolution && !JSON.stringify(lostAccess.body).includes(solution));
  await prisma.teamMember.create({ data: { teamId: ids.team, userId: ids.member } });

  await conversations.savePendingSuggestion(pendingInput);
  stage = 'Fase 4 / retirada do consentimento e revalidação';
  await prisma.$executeRaw`UPDATE "TechnicalProblem" SET "sharingAuthorizedAt" = NULL, "sharingAuthorizedBy" = NULL WHERE id = ${knownId}`;
  const revoked = await request('/api/v1/conversations/message', ids.member, { message: 'sim' });
  assert.equal(revoked.status, 201);
  assert.ok(!revoked.body.acceptedSolution && !JSON.stringify(revoked.body).includes(solution));
  await prisma.$executeRaw`UPDATE "TechnicalProblem" SET "sharingAuthorizedAt" = CURRENT_TIMESTAMP, "sharingAuthorizedBy" = ${ids.member} WHERE id = ${knownId}`;

  await conversations.savePendingSuggestion(pendingInput);
  stage = 'Fase 4 / retirada da solução e revalidação';
  await prisma.$executeRaw`UPDATE "TechnicalProblem" SET solution = NULL WHERE id = ${knownId}`;
  const removed = await request('/api/v1/conversations/message', ids.member, { message: 'sim' });
  assert.equal(removed.status, 201);
  assert.ok(!removed.body.acceptedSolution && !JSON.stringify(removed.body).includes(solution));
  await prisma.$executeRaw`UPDATE "TechnicalProblem" SET solution = ${solution} WHERE id = ${knownId}`;

  await conversations.savePendingSuggestion(pendingInput);
  stage = 'Fase 4 / coexistência de sugestões entre projetos';
  await conversations.savePendingSuggestion({ ...pendingInput, projectId: ids.knowledge });
  const multiple = await request('/api/v1/conversations/message', ids.member, { message: 'sim' });
  assert.equal(multiple.status, 201);
  assert.equal(multiple.body.assistantMessage.content, 'Tenho soluções sugeridas para mais de um projeto. Para qual projeto você quer ver a solução?');
  assert.ok(!multiple.body.acceptedSolution && !JSON.stringify(multiple.body).includes(solution));
  assert.equal((await conversations.findPendingSuggestions(ids.member, response.body.conversationId)).length, 2);
  console.log('Fase 4 real: PENDING, ASSISTANT, aceite, recusa, outro usuário, acesso/consentimento/solução revalidados e múltiplos projetos: OK.');
  return response.body;
}

async function main() {
  for (const key of ['DATABASE_URL', 'OPENAI_API_KEY']) {
    if (!process.env[key]?.trim()) throw new Error(`Configure ${key}; integração real indisponível.`);
  }
  let app;
  let prisma;
  let fixturesStarted = false;
  const previousJwtSecret = process.env.JWT_SECRET;
  // Sem credencial hardcoded: se faltar configuração, usa chave aleatória somente
  // neste processo de teste, compartilhada pelo Nest e pelos tokens das fixtures.
  if (!process.env.JWT_SECRET) process.env.JWT_SECRET = randomUUID();
  try {
    stage = 'inicialização NestJS / conexão PostgreSQL';
    app = await NestFactory.create(AppModule, { logger: false, abortOnError: false });
    await app.listen(0, '127.0.0.1');
    prisma = app.get(PrismaService);
    stage = 'extensão pgvector / migrations existentes';
    const extensions = await prisma.$queryRaw`SELECT extversion FROM pg_extension WHERE extname = 'vector'`;
    assert.equal(extensions.length, 1, 'Extensão vector não instalada; aplique as migrations existentes.');
    const columns = await prisma.$queryRaw`SELECT column_name FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'Project' AND column_name IN ('priority', 'estimatedCompletionAt')`;
    assert.equal(columns.length, 2, 'Migration existente de Project ainda pendente.');
    console.log(`Execução ${runId}; PostgreSQL conectado; pgvector ${extensions[0].extversion}.`);

    stage = 'criação controlada de fixtures';
    fixturesStarted = true;
    await createFixtures(prisma);
    const service = app.get(TechnicalProblemService);
    const tools = app.get(AiToolsService);
    stage = 'create / embedding real persistido';
    const known = await service.create({ projectId: ids.knowledge, title: 'Expiração OAuth — teste fictício', problem: savedProblem, solution, technology: 'OAuth / Protheus' }, ids.member);
    const dimensions = await prisma.$queryRaw`SELECT vector_dims("problemEmbedding") AS dimensions FROM "TechnicalProblem" WHERE id = ${known.id}`;
    assert.equal(dimensions[0].dimensions, 1536, 'create não persistiu embedding real de 1536 dimensões.');
    await service.authorize(known.id, {}, ids.member);
    await createRestrictedCandidates(prisma, known.id);

    stage = 'busca semântica / paráfrase / fronteiras por equipe';
    const matches = await tools.executeTool('search_similar_technical_problems', { problem: paraphrase }, ids.member);
    assertSharedMatches(matches, known.id);
    const match = matches.find((candidate) => candidate.id === known.id);
    console.log(`Paráfrase: id=${known.id}; similarity=${match.similarity.toFixed(6)}; dimensões=1536; top 5 e threshold=0.78 respeitados.`);
    const different = await service.searchSimilarByText(unrelated, ids.member);
    assert.ok(!different.some((candidate) => candidate.id === known.id), 'Caso diferente aceito indevidamente.');
    const adminMatches = await service.searchSimilarByText(paraphrase, ids.admin);
    assertSharedMatches(adminMatches, known.id, true);
    assert.ok(adminMatches.some((candidate) => candidate.id === ids.foreignProblem), 'ADMIN não teve acesso global.');
    const outsiderMatches = await service.searchSimilarByText(paraphrase, ids.outsider);
    assert.ok(!outsiderMatches.some((candidate) => candidate.id === known.id), 'Equipe externa recebeu candidato interno.');
    console.log('Caso diferente rejeitado; MEMBER restrito à equipe; ADMIN global; consentimento e solução exigidos no SQL.');

    stage = 'tool textual / leituras por ID';
    const textual = await tools.executeTool('search_knowledge_base', { query: 'OAuth' }, ids.member);
    assert.ok(textual.some((candidate) => candidate.id === known.id));
    assert.ok(!textual.some((candidate) => [ids.foreignProblem, ids.privateProblem].includes(candidate.id)));
    await assert.rejects(() => service.getById(ids.foreignProblem, ids.member), (error) => error.getStatus() === 404);
    assert.equal((await service.getById(known.id, ids.leader)).id, known.id);

    stage = 'endpoints HTTP autenticados / autorização';
    const response = await verifyHttp(app, known.id);
    stage = 'persistência CheckIn / vínculo com Message';
    const checkIn = await prisma.checkIn.findFirst({ where: { userId: ids.member, projectId: ids.finance }, include: { messages: true } });
    const context = response.projects.find((project) => project.projectId === ids.finance);
    assert.ok(checkIn, 'CheckIn não persistido.');
    assert.equal(checkIn.summary, context.summary);
    assert.equal(checkIn.difficulties, context.difficulties);
    assert.equal(checkIn.nextSteps, context.nextSteps);
    assert.ok(checkIn.messages.some((link) => link.messageId === response.messageId));
    console.log('HTTP, tools, Conversation, CheckIn e CheckInMessage reais: OK.');
    stage = 'top 5 real com seis candidatos autorizados';
    await verifyTopFive(prisma, app.get(TechnicalProblemRepository), known.id);
  } finally {
    try {
      if (fixturesStarted && prisma) await cleanup(prisma);
    } finally {
      try {
        if (app) await app.close();
      } finally {
        if (previousJwtSecret === undefined) delete process.env.JWT_SECRET;
        else process.env.JWT_SECRET = previousJwtSecret;
      }
    }
  }
}

main().catch((error) => {
  // Não imprimir stack/provider payload: podem conter SQL, URLs ou credenciais.
  const detail = stage === 'configuração' || error.name === 'AssertionError' ? error.message : error.name;
  const code = typeof error.code === 'string' && /^P\d{4}$/.test(error.code) ? ` (${error.code})` : '';
  console.error(`Falha na etapa "${stage}": ${detail}${code}. Verifique PostgreSQL, migrations e acesso à OpenAI.`);
  process.exitCode = 1;
});
