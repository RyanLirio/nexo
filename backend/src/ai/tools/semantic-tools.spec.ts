import 'reflect-metadata';
import assert from 'node:assert/strict';
import test from 'node:test';
import { BadRequestException } from '@nestjs/common';
import { OpenAIService } from '../openai.service';
import { AccessControlService } from '../../common/auth/access-control.service';
import { ProjectsService } from '../../projects/projects.service';
import { CheckInsService } from '../../check-ins/check-ins.service';
import { ConversationRepository } from '../../conversations/conversation.repository';
import { SimilarTechnicalProblem, TechnicalProblemRepository } from '../../technical-problems/technical-problem.repository';
import { TechnicalProblemService } from '../../technical-problems/technical-problem.service';
import { AiToolsService } from './ai-tools.service';

function harness() {
  const candidate: SimilarTechnicalProblem = {
    id: 'known-1', projectId: 'other-project', problem: 'Token OAuth expira.',
    solution: 'Renovar token.', technology: 'OAuth', author: { id: 'author', name: 'Colega' }, similarity: 0.86,
  };
  const inputs: string[] = [];
  const searches: Array<{ userId: string; limit?: number; threshold?: number }> = [];
  const savedVectors: string[] = [];
  let present = false;
  let textualViewer: string | undefined;
  let resolved: string | undefined;
  const repo = {
    searchSimilar: async (userId: string, embedding: number[], limit?: number, threshold?: number) => {
      assert.equal(embedding.length, 1536);
      searches.push({ userId, limit, threshold });
      return userId === 'member' ? [candidate] : [];
    },
    list: async (_q: string, _p: string, _filter: unknown, viewer: { userId: string }) => {
      textualViewer = viewer.userId; return [candidate];
    },
    projectExists: async () => true,
    isProjectMember: async () => true,
    findProjectTeamId: async () => 'team-1',
    findById: async () => ({ id: 'created-1', projectId: 'p1', authorId: 'member', problem: 'Token OAuth expira.' }),
    create: async () => ({ id: 'created-1' }),
    updateSolution: async (_id: string, solution: string) => { resolved = solution; return { id: 'created-1' }; },
    hasProblemEmbedding: async () => present,
    setProblemEmbedding: async (id: string) => { savedVectors.push(id); present = true; return true; },
  } as unknown as TechnicalProblemRepository;
  const ai = {
    generateEmbedding: async (text: string) => { inputs.push(text); return Array(1536).fill(0.01); },
  } as unknown as OpenAIService;
  const access = { isAdmin: async () => false, isTeamMember: async () => true } as unknown as AccessControlService;
  const domain = new TechnicalProblemService(repo, ai, access);
  const tools = new AiToolsService(
    { isMember: async () => true } as unknown as ProjectsService,
    {} as CheckInsService, domain, {} as ConversationRepository,
  );
  return { tools, inputs, searches, candidate, savedVectors, setPresent: (value: boolean) => { present = value; }, textualViewer: () => textualViewer, resolved: () => resolved };
}

test('tool semântica aparece no catálogo e converte problem em um único embedding com userId', async () => {
  const h = harness();
  const definition = h.tools.getToolDefinitions().find(item => item.function.name === 'search_similar_technical_problems');
  assert.ok(definition);
  assert.deepEqual(definition.function.parameters.required, ['problem']);
  const result = await h.tools.executeTool('search_similar_technical_problems', { problem: '  Token OAuth expira.  ' }, 'member');
  assert.deepEqual(h.inputs, ['Token OAuth expira.']);
  assert.deepEqual(h.searches, [{ userId: 'member', limit: 5, threshold: 0.78 }]);
  assert.deepEqual(result, [h.candidate]);
  assert.doesNotMatch(JSON.stringify(result), /problemEmbedding/);
});

test('tool semântica devolve somente resultados autorizados fornecidos pelo repositório', async () => {
  const h = harness();
  assert.deepEqual(await h.tools.executeTool('search_similar_technical_problems', { problem: 'Token OAuth expira.' }, 'outsider'), []);
  assert.equal(h.searches[0].userId, 'outsider');
});

test('tool semântica rejeita argumentos inválidos antes de chamar IA', async () => {
  const h = harness();
  for (const value of [undefined, null, '', ' ', 42, 'a'.repeat(2001)]) {
    await assert.rejects(h.tools.executeTool('search_similar_technical_problems', { problem: value }, 'member'), BadRequestException);
  }
  assert.equal(h.inputs.length, 0);
});

test('tool textual continua delegando listagem textual com usuário autenticado', async () => {
  const h = harness();
  assert.deepEqual(await h.tools.executeTool('search_knowledge_base', { query: 'token' }, 'member'), [h.candidate]);
  assert.equal(h.textualViewer(), 'member');
  assert.equal(h.inputs.length, 0);
});

test('manage_technical_problem create usa lifecycle do domínio sem embedding separado na tool', async () => {
  const h = harness();
  await h.tools.executeTool('manage_technical_problem', { action: 'create', projectId: 'p1', title: 'Token', problem: 'Token OAuth expira.' }, 'member');
  assert.deepEqual(h.inputs, ['Token OAuth expira.']);
  assert.deepEqual(h.savedVectors, ['created-1']);
});

test('manage_technical_problem resolve enriquece ausente e preserva existente', async () => {
  const h = harness();
  const args = { action: 'resolve', projectId: 'p1', problemId: 'created-1', solution: 'Renovar token.' };
  await h.tools.executeTool('manage_technical_problem', args, 'member');
  await h.tools.executeTool('manage_technical_problem', args, 'member');
  assert.deepEqual(h.inputs, ['Token OAuth expira.']);
  assert.deepEqual(h.savedVectors, ['created-1']);
  assert.equal(h.resolved(), 'Renovar token.');
});
