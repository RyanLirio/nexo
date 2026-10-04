interface NamedProject {
  id: string;
  name: string;
}

function normalizeName(text: string): string {
  return text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
}

// Trava conservadora de prefixos, não um resolvedor fuzzy de projetos.
// Nomes completos explícitos prevalecem; contexto implícito continua na IA.
export function findAmbiguousProjectNames(
  message: string,
  projects: NamedProject[],
): NamedProject[] {
  const text = ` ${normalizeName(message)} `;
  const words = text.trim().split(/\s+/);
  const names = projects.map(project => ({ project, words: normalizeName(project.name).split(/\s+/) }));

  for (let index = 0; index < words.length - 1; index += 1) {
    const first = words[index];
    const second = words[index + 1];
    if (first.length < 3 || second.length < 2) continue;
    let candidates = names.filter(name => name.words.length >= 2
      && name.words[0].startsWith(first) && name.words[1].startsWith(second));
    if (candidates.length < 2) continue;
    const explicit = candidates.filter(name => text.includes(` ${name.words.join(' ')} `));
    if (explicit.length > 0) continue;
    for (let offset = 2; index + offset < words.length && candidates.length > 1; offset += 1) {
      const qualified = candidates.filter(name => name.words[offset]?.startsWith(words[index + offset]));
      if (qualified.length === 0) break;
      candidates = qualified;
    }
    if (candidates.length < 2) continue;
    return candidates.map(candidate => candidate.project);
  }
  return [];
}
