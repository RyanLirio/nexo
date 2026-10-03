const ACCEPT = new Set(['sim', 'sim mostra', 'mostra', 'pode mostrar', 'quero ver', 'quero a solucao', 'manda', 'pode mandar']);
const DECLINE = new Set(['nao', 'agora nao', 'nao precisa', 'deixa pra la']);

export function parseSolutionReply(message: string): 'ACCEPTED' | 'DECLINED' | null {
  const normalized = message.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[\p{P}\p{S}]/gu, ' ').replace(/\s+/g, ' ').trim();
  if (ACCEPT.has(normalized)) return 'ACCEPTED';
  if (DECLINE.has(normalized)) return 'DECLINED';
  return null;
}
