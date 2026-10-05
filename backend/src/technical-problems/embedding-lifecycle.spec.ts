import 'reflect-metadata';
import assert from 'node:assert/strict';
import test from 'node:test';
import { Logger } from '@nestjs/common';
import { OpenAIService } from '../ai/openai.service';
import { TechnicalProblemService } from './technical-problem.service';
import { TechnicalProblemRepository } from './technical-problem.repository';
import { AccessControlService } from '../common/auth/access-control.service';

function harness(options: { present?: boolean; fail?: boolean } = {}) {
  let present = options.present ?? false;
  let stored: number[] | null = present ? Array(1536).fill(0.02) : null;
  const inputs: string[] = [];
  const savedIds: string[] = [];
  const warnings: string[] = [];
  const events: string[] = [];
  const record = {
    id: 'problem-1', projectId: 'project-1', authorId: 'user-1',
    title: 'Token expirado', problem: 'Token OAuth expira antes da requisição.',
    solution: null as string | null, createdAt: new Date(), updatedAt: new Date(),
  };
  const repo = {
    projectExists: async () => true,
    isProjectMember: async () => true,
    create: async (data: object) => { events.push('create'); return { ...record, ...data }; },
    findById: async () => record,
    hasProblemEmbedding: async () => present,
    setProblemEmbedding: async (id: string, embedding: number[]) => {
      savedIds.push(id); stored = embedding; present = true; return true;
    },
    updateSolution: async (_id: string, solution: string) => {
      record.solution = solution; return record;
    },
  } as unknown as TechnicalProblemRepository;
  const ai = {
    generateEmbedding: async (input: string) => {
      events.push('embedding'); inputs.push(input);
      if (options.fail) throw new Error('secret provider text must not be logged');
      return Array(1536).fill(0.01);
    },
  } as unknown as OpenAIService;
  const access = { isAdmin: async () => true } as unknown as AccessControlService;
  const service = new TechnicalProblemService(repo, ai, access);
  const logger = { warn: (message: string) => warnings.push(message) } as unknown as Logger;
  Object.assign(service, { logger });
  return { service, record, inputs, savedIds, warnings, events, stored: () => stored };
}

test('create gera embedding exclusivamente de problem antes de criar e associa vetor ao ID', async () => {
  const h = harness();
  const result = await h.service.create({
    projectId: 'project-1', title: h.record.title, problem: h.record.problem,
    solution: 'Renovar token antes da chamada.',
  }, 'user-1');
  assert.equal(result.id, 'problem-1');
  assert.deepEqual(h.events, ['embedding', 'create']);
  assert.deepEqual(h.inputs, [h.record.problem]);
  assert.deepEqual(h.savedIds, ['problem-1']);
  assert.equal(h.stored()?.length, 1536);
});

test('falha da OpenAI não impede create e deixa vetor null com warning sem segredo', async () => {
  const h = harness({ fail: true });
  const result = await h.service.create({
    projectId: 'project-1', title: h.record.title, problem: h.record.problem,
  }, 'user-1');
  assert.equal(result.id, 'problem-1');
  assert.equal(h.stored(), null);
  assert.equal(h.warnings.length, 1);
  assert.doesNotMatch(h.warnings[0], /secret provider text/);
});

test('updateSolution preserva vetor existente sem chamada à IA', async () => {
  const h = harness({ present: true });
  const before = h.stored();
  await h.service.updateSolution('problem-1', '  Solução registrada  ', 'user-1');
  assert.equal(h.record.solution, 'Solução registrada');
  assert.deepEqual(h.inputs, []);
  assert.equal(h.stored(), before);
});

test('updateSolution enriquece vetor ausente usando problem armazenado e nunca solution', async () => {
  const h = harness();
  await h.service.updateSolution('problem-1', 'Renovar o token.', 'user-1');
  assert.equal(h.record.solution, 'Renovar o token.');
  assert.deepEqual(h.inputs, [h.record.problem]);
  assert.deepEqual(h.savedIds, ['problem-1']);
  assert.equal(h.stored()?.length, 1536);
});

test('falha de embedding durante resolve mantém solution salva e vetor null', async () => {
  const h = harness({ fail: true });
  await h.service.updateSolution('problem-1', 'Renovar o token.', 'user-1');
  assert.equal(h.record.solution, 'Renovar o token.');
  assert.equal(h.stored(), null);
  assert.equal(h.warnings.length, 1);
});

test('enriquecimento usado no backfill é idempotente', async () => {
  const h = harness();
  assert.equal(await h.service.ensureProblemEmbedding('problem-1', h.record.problem), true);
  assert.equal(await h.service.ensureProblemEmbedding('problem-1', h.record.problem), false);
  assert.equal(h.inputs.length, 1);
});
