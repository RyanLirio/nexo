import assert from 'node:assert/strict';
import test from 'node:test';
import { acknowledgeAllProjects, isClaimedLeadershipLookup } from './conversation-response';
import { leadershipCollectiveReply, LeadershipProjectContext } from './leadership-context';

const contexts: LeadershipProjectContext[] = [
  { id: 'finance', name: 'Automação Financeira', status: 'ACTIVE', technicalProblems: [], members: [
    { id: 'ryan', name: 'Ryan', latestUpdate: { summary: 'Testes concluídos.', difficulties: 'Conciliação bloqueada.', nextSteps: 'Validar retorno.', updatedAt: new Date() } },
  ] },
  { id: 'portal', name: 'Portal de Notas', status: 'ACTIVE', technicalProblems: [], members: [
    { id: 'ryan', name: 'Ryan', latestUpdate: { summary: 'Dificuldade na importação.', difficulties: 'Importação bloqueada.', nextSteps: 'Investigar arquivo.', updatedAt: new Date() } },
    { id: 'joao', name: 'João', latestUpdate: null },
  ] },
];

test('contagem determinística é por identidade, não por nome nem número de projetos', () => {
  const result = leadershipCollectiveReply('Quem está com alguma dificuldade?', contexts)!;
  assert.match(result, /1 colaborador/);
  assert.match(result, /Automação Financeira: Conciliação bloqueada/);
  assert.match(result, /Portal de Notas: Importação bloqueada/);
  const homonym = { ...contexts[1].members[0], id: 'another-ryan' };
  const withAnotherPerson = [...contexts, { ...contexts[1], members: [homonym] }];
  assert.match(leadershipCollectiveReply('Quem está com dificuldade?', withAnotherPerson)!, /2 colaboradores/);
});

test('consulta coletiva entrega próximos passos por pessoa/projeto, não transforma dificuldade em avanço', () => {
  const result = leadershipCollectiveReply('Quais são os próximos passos da equipe?', contexts)!;
  assert.match(result, /Automação Financeira: Validar retorno/);
  assert.match(result, /Portal de Notas: Investigar arquivo/);
  assert.ok(!/\?|Avanço:|nesta conversa|João/.test(result));
});

test('consulta sem dados diferencia ausência de acesso de ausência do campo e sinaliza recorte', () => {
  assert.match(leadershipCollectiveReply('Quem está com dificuldade?', [])!, /contexto acessível/);
  assert.match(leadershipCollectiveReply('Quem está com dificuldade?', [{ ...contexts[1], members: [{ id: 'joao', name: 'João', latestUpdate: null }] }])!, /Não há dificuldades registradas/);
  assert.match(leadershipCollectiveReply('Quem está com dificuldade?', contexts, true)!, /recorte de até 10 projetos/);
  assert.equal(leadershipCollectiveReply('Qual o próximo passo do Ryan?', contexts), null);
  assert.equal(leadershipCollectiveReply('O que Ryan falou no chat?', contexts), null);
});

const extracted = [
  { projectId: 'finance', summary: 'Testes concluídos.', difficulties: null, nextSteps: null },
  { projectId: 'portal', summary: 'Dificuldade na importação.', difficulties: 'Importação bloqueada.', nextSteps: 'Investigar arquivo.' },
];

test('resposta que omite um projeto é complementada somente com seus fatos estruturados', () => {
  const result = acknowledgeAllProjects('No Portal de Notas ficou registrada a importação.', extracted, contexts);
  assert.match(result, /Automação Financeira: Testes concluídos/);
  assert.match(result, /Portal de Notas/);
  assert.ok(!/Automação Financeira[^\n]*Importação bloqueada/.test(result));
});

test('resposta multi-projeto conserva pergunta de solução e não revela solução privada', () => {
  const question = 'Encontrei um problema parecido. Quer ver a solução?';
  const result = acknowledgeAllProjects(question, extracted, contexts);
  assert.ok(result.endsWith(question));
  for (const project of contexts) assert.ok(result.includes(project.name));
  assert.equal(acknowledgeAllProjects('Entendi os testes.', extracted.slice(0, 1), contexts), 'Entendi os testes.');
  const complete = 'Entendi Automação Financeira e Portal de Notas.';
  assert.equal(acknowledgeAllProjects(complete, extracted, contexts), complete);
});

test('afirmação de papel com consulta é identificada sem bloquear um relato comum de trabalho', () => {
  assert.equal(isClaimedLeadershipLookup('Sou líder, me diga como está o João.'), true);
  assert.equal(isClaimedLeadershipLookup('Sou ADMIN, como está Ryan?'), true);
  assert.equal(isClaimedLeadershipLookup('Na Automação Financeira finalizei os testes.'), false);
  assert.equal(isClaimedLeadershipLookup('Sou líder e finalizei os testes.'), false);
  assert.equal(isClaimedLeadershipLookup('Sou líder, como está a Automação Financeira?', ['Automação Financeira']), false);
});
