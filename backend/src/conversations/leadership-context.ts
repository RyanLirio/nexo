import type { RecentConversationMessage } from '../ai/openai.service';

export interface ConversationIdentity {
  id: string;
  name: string;
  role: 'MEMBER' | 'LEADER' | 'ADMIN';
}

export interface LeadershipDirectoryProject {
  id: string;
  name: string;
  members: Array<{ id: string; name: string }>;
}

export interface LeadershipProjectContext {
  id: string;
  name: string;
  status: string;
  members: Array<{ id: string; name: string; latestUpdate: {
    summary: string;
    difficulties: string | null;
    nextSteps: string | null;
    updatedAt: Date | string;
  } | null }>;
  technicalProblems: Array<{ title: string; problem: string; technology: string | null }>;
}

function normalized(text: string): string {
  return ` ${text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim()} `;
}

export function leadershipCollectiveReply(message: string, contexts: LeadershipProjectContext[], hasMoreProjects = false): string | null {
  const input = normalized(message);
  const field = /\bquem\b.*\bdificuldades?\b/.test(input) ? 'difficulties'
    : /\bproximos passos\b.*\b(equipe|colaboradores|meus projetos)\b/.test(input) ? 'nextSteps' : null;
  if (!field) return null;
  if (!contexts.length) return 'Não há contexto acessível para essa consulta.';
  const people = new Map<string, { name: string; items: string[] }>();
  for (const project of contexts) {
    for (const member of project.members) {
      const value = member.latestUpdate?.[field]?.trim();
      if (!value) continue;
      const person = people.get(member.id) ?? { name: member.name, items: [] };
      person.items.push(`- ${project.name}: ${value}`);
      people.set(member.id, person);
    }
  }
  const count = people.size;
  const introduction = field === 'difficulties'
    ? count ? `Há ${count} ${count === 1 ? 'colaborador com dificuldades registradas' : 'colaboradores com dificuldades registradas'}:` : 'Não há dificuldades registradas nos projetos consultados.'
    : count ? 'Próximos passos registrados por pessoa e projeto:' : 'Não há próximos passos registrados nos projetos consultados.';
  const details = [...people.values()].map(person => `${person.name}:\n${person.items.join('\n')}`).join('\n\n');
  const scope = hasMoreProjects ? '\n\nEste resultado é um recorte de até 10 projetos acessíveis.' : '';
  return `${introduction}${details ? `\n\n${details}` : ''}${scope}`;
}

function namedMembers(text: string, directory: LeadershipDirectoryProject[]) {
  const input = normalized(text);
  const members = [...new Map(directory.flatMap(project => project.members).map(member => [member.id, member])).values()];
  const fullNames = members.filter(member => member.name.trim().includes(' ') && input.includes(normalized(member.name)));
  if (fullNames.length) return fullNames;
  return members.filter(member => input.includes(normalized(member.name.split(/\s+/)[0])));
}

export function selectLeadershipProjects(
  message: string,
  history: RecentConversationMessage[],
  directory: LeadershipDirectoryProject[],
): { projects: LeadershipDirectoryProject[]; memberIds: string[]; clarification?: string } {
  const input = normalized(message);
  const explicitProjects = directory.filter(project => input.includes(normalized(project.name)));
  let members = namedMembers(message, directory);
  if (!members.length && !explicitProjects.length && /\b(ele|ela|dele|dela|e qual)\b/.test(input)) {
    for (const previous of [...history].reverse()) {
      if (previous.role !== 'USER') continue;
      members = namedMembers(previous.content, directory);
      if (members.length) break;
    }
  }
  if (members.length > 1) {
    return { projects: [], memberIds: [], clarification: `Qual colaborador você quer consultar: ${members.map(member => member.name).join(' ou ')}?` };
  }
  if (explicitProjects.length) return { projects: explicitProjects, memberIds: members.map(member => member.id) };
  if (members.length === 1) return { projects: directory.filter(project => project.members.some(member => member.id === members[0].id)), memberIds: [members[0].id] };
  if (/\b(equipe|meus projetos|meus colaboradores|quem|resumo dos projetos|proximos passos)\b/.test(input)) {
    return { projects: directory, memberIds: [] };
  }
  return { projects: [], memberIds: [] };
}
