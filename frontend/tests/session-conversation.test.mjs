import test from 'node:test';
import assert from 'node:assert/strict';
import { isAuthSession, dashboardFor, navigationFor, readAuthSession, saveAuthSession, clearAuthSession, SESSION_CHANGED } from '../lib/auth-session.ts';
import { conversationWelcome, isConversationResponse, parseHistory, requestError } from '../lib/conversation-data.ts';
const token = (exp = Math.floor(Date.now() / 1000) + 3600) => `header.${Buffer.from(JSON.stringify({ exp })).toString('base64url')}.signature`;
const session = (role = 'MEMBER') => ({ accessToken: token(), user: { id: 'fixture', name: 'Pessoa fictícia', email: 'fixture@example.invalid', role } });
test('welcome MEMBER convida ao registro do próprio trabalho', () => {
  const welcome = conversationWelcome('MEMBER');
  assert.equal(welcome.author, 'nexo');
  assert.match(welcome.text, /trabalho hoje/);
  for (const field of ['avanços', 'dificuldades', 'próximos passos']) assert.ok(welcome.text.includes(field));
});
for (const role of ['LEADER', 'ADMIN']) {
  test(`welcome ${role} convida a consultas sem pedir registro pessoal`, () => {
    const welcome = conversationWelcome(role);
    assert.match(welcome.text, /consultar projetos, colaboradores/);
    assert.ok(!welcome.text.includes('Conte como foi seu trabalho'));
    if (role === 'ADMIN') assert.match(welcome.text, /escopo administrativo/);
  });
}
test('sessão malformada, papel desconhecido e JWT expirado não quebram rotas protegidas', () => {
  for (const value of [null, {}, { accessToken: 'x', user: {} }, session('ROOT'), { ...session(), accessToken: token(1) }]) assert.equal(isAuthSession(value), false);
  assert.equal(isAuthSession(session()), true);
});
test('MEMBER vê projetos/conversa; LEADER/ADMIN têm visão da equipe', () => {
  assert.deepEqual(navigationFor('MEMBER').map(link => link.href), ['/colaborador', '/colaborador/conversa']);
  for (const role of ['LEADER', 'ADMIN']) assert.ok(navigationFor(role).some(link => link.href === '/lider'));
  assert.deepEqual(navigationFor(), []);
});
test('entrada e logo levam ao painel correspondente ao papel', () => {
  assert.equal(dashboardFor('MEMBER'), '/colaborador');
  assert.equal(dashboardFor('LEADER'), '/lider'); assert.equal(dashboardFor('ADMIN'), '/lider');
});
test('salvar e sair notificam o cabeçalho sem depender de mudança de rota', () => {
  const storage = new Map(); const events = [];
  globalThis.window = { sessionStorage: { setItem: (key, value) => storage.set(key, value), getItem: key => storage.get(key), removeItem: key => storage.delete(key) }, dispatchEvent: event => events.push(event.type) };
  saveAuthSession(session()); assert.equal(readAuthSession().user.id, 'fixture');
  clearAuthSession(); assert.equal(readAuthSession(), null);
  assert.deepEqual(events, [SESSION_CHANGED, SESSION_CHANGED]);
  storage.set('nexo.auth.session', '{}'); assert.equal(readAuthSession(), null); assert.equal(storage.size, 0);
  delete globalThis.window;
});
test('storage indisponível não derruba a leitura da sessão', () => {
  globalThis.window = { sessionStorage: { getItem: () => { throw new Error('blocked'); }, removeItem: () => { throw new Error('blocked'); } } };
  assert.equal(readAuthSession(), null); delete globalThis.window;
});
test('histórico mantém ordem USER/ASSISTANT e remove IDs duplicados', () => {
  const user = { id: 'u', role: 'USER', content: 'Avancei.' }; const assistant = { id: 'a', role: 'ASSISTANT', content: 'Ótimo.' };
  assert.deepEqual(parseHistory({ conversationId: 'today', messages: [user, assistant, assistant] }), [
    { id: 'u', author: 'user', text: 'Avancei.' }, { id: 'a', author: 'nexo', text: 'Ótimo.' },
  ]);
  assert.deepEqual(parseHistory({ conversationId: null, messages: [] }), []);
});
test('histórico inválido é erro controlado em vez de crash no map', () => {
  for (const value of [null, {}, { conversationId: 'x', messages: {} }, { conversationId: 'x', messages: [{ role: 'SYSTEM' }] }]) assert.throws(() => parseHistory(value), /mensagens anteriores/);
});
test('resposta exige mensagem persistida e ASSISTANT não vazio', () => {
  const response = { messageId: 'u', assistantMessage: { id: 'a', role: 'ASSISTANT', content: 'Tudo certo.' } };
  assert.equal(isConversationResponse(response), true);
  for (const value of [null, {}, { ...response, messageId: '' }, { ...response, assistantMessage: { ...response.assistantMessage, content: '' } }]) assert.equal(isConversationResponse(value), false);
});
test('erros HTTP exibem texto de produto sem stack/JSON do backend', () => {
  for (const status of [400, 403, 404, 500, 503]) assert.ok(requestError(status).length > 10);
  assert.match(requestError(403), /acesso/); assert.match(requestError(500), /Tente novamente/);
});
