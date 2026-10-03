import 'reflect-metadata';
import assert from 'node:assert/strict';
import test from 'node:test';
import { ForbiddenException } from '@nestjs/common';
import { CheckInsController } from './check-ins.controller';
import { CheckInsService } from './check-ins.service';
import { ProjectsService } from '../projects/projects.service';
import { TechnicalProblemController } from '../technical-problems/technical-problem.controller';
import { TechnicalProblemService } from '../technical-problems/technical-problem.service';

const privateCheckIn = {
  id: 'daily', projectId: 'project', userId: 'other-person', summary: 'Contexto autorizado',
  messages: [{ messageId: 'private-message', message: { content: 'Conversa privada com contexto de outra equipe' } }],
};

test('histórico de CheckIn bloqueia equipe externa antes da leitura', async () => {
  let read = false;
  const controller = new CheckInsController({ list: async () => { read = true; return []; } } as unknown as CheckInsService,
    { getById: async () => { throw new ForbiddenException(); } } as unknown as ProjectsService);
  await assert.rejects(controller.listByProject('foreign', { id: 'member' }), ForbiddenException);
  assert.equal(read, false);
});
test('histórico autorizado mantém filtros existentes de usuário e data', async () => {
  let args: unknown;
  const controller = new CheckInsController({ list: async (...values: unknown[]) => { args = values; return []; } } as unknown as CheckInsService,
    { getById: async () => ({ id: 'project' }) } as unknown as ProjectsService);
  await controller.listByProject('project', { id: 'leader' }, 'person', '2026-10-01', '2026-10-04');
  assert.deepEqual(args, ['project', { userId: 'person', startDate: '2026-10-01', endDate: '2026-10-04' }]);
});
test('ID de CheckIn não contorna autorização do projeto', async () => {
  const controller = new CheckInsController({ getById: async () => ({ id: 'daily', projectId: 'foreign' }) } as unknown as CheckInsService,
    { getById: async () => { throw new ForbiddenException(); } } as unknown as ProjectsService);
  await assert.rejects(controller.getById('daily', { id: 'member' }), ForbiddenException);
});
test('lista legada de problemas não desabilita autorização de compartilhamento', async () => {
  let filter: unknown;
  const controller = new TechnicalProblemController({
    list: async (_query: unknown, _project: string, value: unknown) => { filter = value; return []; },
  } as unknown as TechnicalProblemService);
  await controller.listByProject({ id: 'leader' }, 'project', 'RESOLVED');
  assert.deepEqual(filter, { status: 'RESOLVED', technology: undefined });
});

test('histórico da equipe não expõe Messages da Conversation privada de outro usuário', async () => {
  const controller = new CheckInsController({ list: async () => [privateCheckIn] } as unknown as CheckInsService,
    { getById: async () => ({ id: 'project' }) } as unknown as ProjectsService);
  const contexts = await controller.listByProject('project', { id: 'leader' });
  assert.equal(contexts[0].summary, 'Contexto autorizado');
  assert.ok(!('messages' in contexts[0]));
  assert.ok(!JSON.stringify(contexts).includes('Conversa privada'));
});
test('detalhe de CheckIn autorizado não expõe a mensagem original nem altera o registro', async () => {
  const controller = new CheckInsController({ getById: async () => privateCheckIn } as unknown as CheckInsService,
    { getById: async () => ({ id: 'project' }) } as unknown as ProjectsService);
  const context = await controller.getById('daily', { id: 'leader' });
  assert.ok(!('messages' in context));
  assert.equal(privateCheckIn.messages.length, 1);
});
