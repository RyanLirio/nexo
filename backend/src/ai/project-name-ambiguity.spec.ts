import assert from 'node:assert/strict';
import test from 'node:test';
import { findAmbiguousProjectNames } from './project-name-ambiguity';

const projects = [{ id: 'one', name: 'Automação Financeira A' },
  { id: 'two', name: 'Automação Financeira B' }];

test('caso 13: prefixo com typo identifica todos os candidatos, nunca escolhe um', () => {
  assert.deepEqual(findAmbiguousProjectNames('na automação financeir', projects), projects);
  assert.deepEqual(findAmbiguousProjectNames('NA AUTOMACAO FINANCEIR estou com dificuldade.', projects), projects);
});

test('correspondência única não é bloqueada', () => {
  assert.deepEqual(findAmbiguousProjectNames('na automação financeir', [{ id: 'one', name: 'Automação Financeira' }]), []);
});

test('nome completo explícito tem prioridade sobre prefixo compartilhado', () => {
  assert.deepEqual(findAmbiguousProjectNames('Na Automação Financeira B finalizei testes.', projects), []);
  assert.deepEqual(findAmbiguousProjectNames('Na Automação Financeira A e na Automação Financeira B finalizei testes.', projects), []);
  assert.deepEqual(findAmbiguousProjectNames('Na automação financeir B finalizei testes.', projects), []);
});

test('não bloqueia contexto implícito, referências ordinais ou respostas de solução', () => {
  for (const message of ['Agora vou validar o retorno.', 'nesse segundo ainda não sei a causa.',
    'sim', 'não', 'isso', 'acabei de falar acima']) {
    assert.deepEqual(findAmbiguousProjectNames(message, projects), []);
  }
});

test('não confunde palavras distintas com erro de edição nem usa IDs como pistas', () => {
  assert.deepEqual(findAmbiguousProjectNames('Na Automação Fiscal finalizei os testes.', projects), []);
  assert.deepEqual(findAmbiguousProjectNames('No Portal de Notas finalizei os testes.', projects), []);
});

test('três nomes plausíveis pedem desambiguação sem preferência por ordem', () => {
  const candidates = [...projects, { id: 'three', name: 'Automação Financeira C' }].reverse();
  assert.deepEqual(findAmbiguousProjectNames('na automação financeira', candidates), candidates);
});
