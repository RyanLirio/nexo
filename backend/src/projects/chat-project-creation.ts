export interface ChatProjectCreation {
  name: string | null;
  description: string | null;
  leaderName: string | null;
  teamName: string | null;
}

export interface ProjectCreationTeam {
  id: string;
  name: string;
  leaders: Array<{ id: string; name: string; role: 'LEADER' | 'ADMIN' }>;
}

export function normalizedProjectName(value: string): string {
  return value.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/\s+/g, ' ').trim();
}

export function isProjectCreationTurn(message: string, history: Array<{ role: string; content: string }>): boolean {
  const text = normalizedProjectName(message);
  if (/\b(talvez|futuramente|pensando|poderia|poderiamos|se|quando|nao quero|nao crie|nao cria|cancela|cancelar)\b/.test(text)) return false;
  if (!/\bprojeto\b/.test(text) && /\b(codigo|funcao|script|redacao|viagem)\b/.test(text)) return false;
  const explicit = /\b(quero|vamos|preciso|pode|gostaria de) criar\b|^(por favor,? )?(cria|crie)\b/.test(text)
    && !/^(como|se)\b|\bexemplo\b/.test(text);
  const previous = history.at(-1);
  const workUpdate = /^(hoje|agora|estou|terminei|finalizei|conclui|iniciei|comecei|na |no )\b/.test(text);
  return explicit || Boolean(!workUpdate && previous?.role === 'ASSISTANT' && previous.content.startsWith('Para criar o projeto, '));
}

export function matchesCreationName(name: string, requested: string): boolean {
  const actual = normalizedProjectName(name);
  const query = normalizedProjectName(requested).replace(/^(o|a) /, '');
  return actual === query || (` ${actual} `).includes(` ${query} `);
}
