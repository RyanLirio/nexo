const ACCEPT = new Set(['sim', 'sim mostra', 'mostra', 'pode mostrar', 'quero ver', 'quero a solucao', 'manda', 'pode mandar']);
const DECLINE = new Set(['nao', 'agora nao', 'nao precisa', 'deixa pra la']);

const FILLER_WORDS = new Set([
  'a', 'o', 'as', 'os', 'da', 'de', 'do', 'das', 'dos', 'e', 'para', 'por', 'favor',
  'sim', 'nao', 'quero', 'queria', 'mostra', 'mostrar', 'mostre', 'manda', 'mandar',
  'pode', 'solucao', 'dispensa', 'precisa', 'ver',
]);

export interface PendingProjectOption {
  projectId: string;
  projectName: string;
}

export interface ProjectSelection {
  matches: PendingProjectOption[];
  isSelectionOnly: boolean;
}

export function normalizeSolutionReply(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[\p{P}\p{S}]/gu, ' ').replace(/\s+/g, ' ').trim();
}

export function parseSolutionReply(message: string): 'ACCEPTED' | 'DECLINED' | null {
  const normalized = normalizeSolutionReply(message);
  if (ACCEPT.has(normalized)) return 'ACCEPTED';
  if (DECLINE.has(normalized)) return 'DECLINED';
  if (/\bnao\b.*\b(quero|precisa|mostrar|mostre|manda|ver)\b/.test(normalized)
    || /\bdispensa\b/.test(normalized)) return 'DECLINED';
  if (/\bsim\b/.test(normalized) || /\b(mostra|mostrar|mostre|manda)\b/.test(normalized)
    || /\bquero\b.*\b(solucao|ver|da|do)\b/.test(normalized)) return 'ACCEPTED';
  return null;
}

export function isStandaloneSolutionReply(message: string): boolean {
  const normalized = normalizeSolutionReply(message);
  return ACCEPT.has(normalized) || DECLINE.has(normalized);
}

export function findPendingProjectSelection(
  message: string,
  projects: PendingProjectOption[],
): ProjectSelection {
  const normalized = normalizeSolutionReply(message);
  const messageWords = normalized.split(' ').filter(Boolean);
  const messageWordSet = new Set(messageWords);

  const exactMatches = projects.filter(({ projectName }) => {
    const normalizedName = normalizeSolutionReply(projectName);
    return ` ${normalized} `.includes(` ${normalizedName} `);
  });
  const mostSpecificExactMatches = exactMatches.filter(({ projectName }) => {
    const normalizedName = normalizeSolutionReply(projectName);
    return !exactMatches.some((other) => {
      const otherName = normalizeSolutionReply(other.projectName);
      return otherName !== normalizedName
        && ` ${otherName} `.includes(` ${normalizedName} `);
    });
  });

  const partialMatches = projects.filter(({ projectName }) => {
    const normalizedName = normalizeSolutionReply(projectName);
    const projectWords = normalizedName.split(' ').filter((word) => word.length >= 3 && !FILLER_WORDS.has(word));
    return projectWords.some((word) => messageWordSet.has(word));
  });
  const matches = mostSpecificExactMatches.length > 0 ? mostSpecificExactMatches : partialMatches;

  if (matches.length !== 1) return { matches, isSelectionOnly: false };

  const selectedWords = new Set(normalizeSolutionReply(matches[0].projectName).split(' '));
  const remainingWords = messageWords.filter((word) => !FILLER_WORDS.has(word));
  return {
    matches,
    isSelectionOnly: remainingWords.length > 0
      && remainingWords.every((word) => selectedWords.has(word)),
  };
}
