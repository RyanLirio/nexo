import assert from 'node:assert/strict';
import test from 'node:test';
import { PrismaService } from '../prisma.service';
import { PrismaTechnicalProblemRepository } from './prisma-technical-problem.repository';
import { SimilarTechnicalProblem } from './technical-problem.repository';

interface CapturedQuery {
  sql: string;
  values: unknown[];
}

function createRepository(result: SimilarTechnicalProblem[]) {
  let capturedQuery: CapturedQuery | undefined;
  const prisma = {
    $queryRaw: async (
      strings: TemplateStringsArray,
      ...values: unknown[]
    ) => {
      capturedQuery = {
        sql: strings.join('?').replace(/\s+/g, ' ').trim(),
        values,
      };
      return result;
    },
  } as unknown as PrismaService;

  return {
    repository: new PrismaTechnicalProblemRepository(prisma),
    capturedQuery: () => capturedQuery,
  };
}

test('busca pgvector aplica cosine similarity, threshold e top 5 no PostgreSQL', async () => {
  const candidate: SimilarTechnicalProblem = {
    id: 'problem-1',
    projectId: 'project-other',
    problem: 'Token OAuth expira antes da requisição.',
    solution: 'Renovar o token antes de enviar a requisição.',
    technology: 'OAuth',
    author: { id: 'user-2', name: 'Gustavo' },
    similarity: 0.82,
  };
  const harness = createRepository([candidate]);

  const result = await harness.repository.searchSimilar(
    'user-1',
    Array.from({ length: 1536 }, () => 0.01),
  );

  assert.deepEqual(result, [candidate]);
  const query = harness.capturedQuery();
  assert.ok(query);
  assert.match(query.sql, /"problemEmbedding" <=> query_embedding\.value/);
  assert.match(query.sql, />= \?/);
  assert.match(query.sql, /ORDER BY similarity DESC/);
  assert.match(query.sql, /LIMIT \?/);
  assert.equal(query.values[1], 'user-1');
  assert.equal(query.values[2], 0.78);
  assert.equal(query.values[3], 5);
});

test('busca pgvector exige autorização, solução e embedding no próprio SQL', async () => {
  const harness = createRepository([]);

  await harness.repository.searchSimilar(
    'user-1',
    Array.from({ length: 1536 }, () => 0.02),
  );

  const query = harness.capturedQuery();
  assert.ok(query);
  assert.match(query.sql, /"problemEmbedding" IS NOT NULL/);
  assert.match(query.sql, /"sharingAuthorizedAt" IS NOT NULL/);
  assert.match(query.sql, /problem\.solution IS NOT NULL/);
  assert.match(query.sql, /BTRIM\(problem\.solution\) <> ''/);
});

test('busca pgvector não restringe candidatos ao projeto atual', async () => {
  const harness = createRepository([]);

  await harness.repository.searchSimilar(
    'user-1',
    Array.from({ length: 1536 }, () => 0.03),
  );

  const query = harness.capturedQuery();
  assert.ok(query);
  assert.doesNotMatch(query.sql, /WHERE[^;]*problem\."projectId"\s*=/);
});

test('busca pgvector limita membros às equipes acessíveis e mantém ADMIN irrestrito', async () => {
  const harness = createRepository([]);

  await harness.repository.searchSimilar(
    'user-1',
    Array.from({ length: 1536 }, () => 0.04),
  );

  const query = harness.capturedQuery();
  assert.ok(query);
  assert.match(
    query.sql,
    /INNER JOIN "Project" AS project ON project\.id = problem\."projectId"/,
  );
  assert.match(query.sql, /viewer\.role = 'ADMIN'/);
  assert.match(query.sql, /FROM "TeamMember" AS membership/);
  assert.match(query.sql, /membership\."teamId" = project\."teamId"/);
  assert.match(query.sql, /membership\."userId" = viewer\.id/);
});

test('busca pgvector rejeita embedding com dimensão diferente de 1536', async () => {
  const harness = createRepository([]);

  await assert.rejects(
    harness.repository.searchSimilar('user-1', [0.1, 0.2]),
    /1536 valores numéricos/,
  );
  assert.equal(harness.capturedQuery(), undefined);
});
