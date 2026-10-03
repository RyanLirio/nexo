import assert from 'node:assert/strict';
import test from 'node:test';
import { PrismaService } from '../prisma.service';
import { PrismaConversationRepository } from './prisma-conversation.repository';
import { PendingSolutionSuggestionRecord } from './conversation.repository';

const snapshot: PendingSolutionSuggestionRecord = {
  id: 'pending-1', userId: 'user-1', conversationId: 'conversation-1',
  projectId: 'project-1', technicalProblemId: 'problem-1', similarity: 0.86,
  status: 'PENDING', createdAt: new Date(0), updatedAt: new Date(1000),
};

test('repository persiste role ASSISTANT e preserva default USER nas chamadas antigas', async () => {
  const calls: unknown[] = [];
  const repository = new PrismaConversationRepository({ message: {
    create: async (args: unknown) => { calls.push(args); return {}; },
  } } as unknown as PrismaService);
  await repository.createMessage({ conversationId: 'conversation-1', content: 'Pergunta', role: 'ASSISTANT' });
  await repository.createMessage({ conversationId: 'conversation-1', content: 'Relato', senderId: 'user-1' });
  assert.deepEqual(calls, [
    { data: { conversationId: 'conversation-1', content: 'Pergunta', senderId: undefined, role: 'ASSISTANT' } },
    { data: { conversationId: 'conversation-1', content: 'Relato', senderId: 'user-1', role: 'USER' } },
  ]);
});

test('repository localiza apenas PENDING do usuário e da conversa pertencente a ele', async () => {
  let captured: unknown;
  const repository = new PrismaConversationRepository({ pendingTechnicalSolutionSuggestion: {
    findMany: async (args: unknown) => { captured = args; return [{ ...snapshot, project: { name: 'Automação Financeira' } }]; },
  } } as unknown as PrismaService);
  const result = await repository.findPendingSuggestions('user-1', 'conversation-1');
  assert.deepEqual(captured, {
    where: { userId: 'user-1', conversationId: 'conversation-1', status: 'PENDING', conversation: { userId: 'user-1' } },
    orderBy: { createdAt: 'asc' },
    include: { project: { select: { name: true } } },
  });
  assert.deepEqual(result, [{ ...snapshot, projectName: 'Automação Financeira' }]);
});

test('repository substitui sugestão no slot user + conversation + project, sem copiar solução', async () => {
  let captured: unknown;
  const repository = new PrismaConversationRepository({ pendingTechnicalSolutionSuggestion: {
    upsert: async (args: unknown) => { captured = args; return snapshot; },
  } } as unknown as PrismaService);
  const input = { userId: snapshot.userId, conversationId: snapshot.conversationId,
    projectId: snapshot.projectId, technicalProblemId: snapshot.technicalProblemId, similarity: snapshot.similarity };
  await repository.savePendingSuggestion(input);
  assert.deepEqual(captured, {
    where: { userId_conversationId_projectId: { userId: snapshot.userId, conversationId: snapshot.conversationId, projectId: snapshot.projectId } },
    create: input, update: { technicalProblemId: snapshot.technicalProblemId, similarity: snapshot.similarity, status: 'PENDING' },
  });
});

for (const claimed of [true, false]) {
  test(`repository encerra e salva ASSISTANT na mesma transação; claim=${claimed}`, async () => {
    const writes: unknown[] = [];
    const messages: unknown[] = [];
    const tx = {
      pendingTechnicalSolutionSuggestion: { updateMany: async (args: unknown) => { writes.push(args); return { count: claimed ? 1 : 0 }; } },
      message: { create: async (args: unknown) => { messages.push(args); return { id: 'assistant-1', role: 'ASSISTANT' }; } },
    };
    let transactions = 0;
    const repository = new PrismaConversationRepository({
      $transaction: async (action: (client: typeof tx) => Promise<unknown>) => { transactions += 1; return action(tx); },
    } as unknown as PrismaService);
    const result = await repository.completeSuggestion(snapshot, 'ACCEPTED', 'Solução autorizada');
    assert.equal(transactions, 1);
    assert.deepEqual(writes[0], { where: {
      id: snapshot.id, userId: snapshot.userId, conversationId: snapshot.conversationId,
      technicalProblemId: snapshot.technicalProblemId, updatedAt: snapshot.updatedAt, status: 'PENDING',
      conversation: { userId: snapshot.userId },
    }, data: { status: 'ACCEPTED' } });
    assert.equal(messages.length, claimed ? 1 : 0);
    assert.equal(result !== null, claimed);
  });
}
