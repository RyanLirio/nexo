interface AcknowledgedProject {
  projectId: string;
  summary: string;
  difficulties: string | null;
  nextSteps: string | null;
}

function normalize(text: string): string {
  return text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
}

export function isClaimedLeadershipLookup(message: string, ownProjectNames: string[] = []): boolean {
  const text = normalize(message);
  if (ownProjectNames.some(name => text.includes(normalize(name)))) return false;
  return /\bsou (?:o |a |um |uma )?(?:lider|admin|administrador|administradora)\b/.test(text)
    && /\bcomo (?:esta|ta|vai)\b|\bacompanhamento (?:de|dos?) (?:outros? )?colaboradores?\b/.test(text);
}

// Complementa apenas contextos extraídos/autorizados; não acrescenta fatos nem chama IA.
export function acknowledgeAllProjects(
  response: string,
  contexts: AcknowledgedProject[],
  directory: Array<{ id: string; name: string }>,
): string {
  if (contexts.length < 2) return response;
  const missing = contexts.flatMap(context => {
    const project = directory.find(item => item.id === context.projectId);
    if (!project || normalize(response).includes(normalize(project.name))) return [];
    return [[`${project.name}: ${context.summary}`,
      context.difficulties ? `Dificuldade: ${context.difficulties}` : '',
      context.nextSteps ? `Próximo passo: ${context.nextSteps}` : '',
    ].filter(Boolean).join(' ')];
  });
  return missing.length ? `${missing.join('\n\n')}\n\n${response}` : response;
}
