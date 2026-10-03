import { clearAuthSession, readAuthSession } from './auth-session';

export interface Person { id: string; name: string }
export interface CheckInContext {
  id: string;
  userId?: string;
  user?: Person;
  summary: string;
  difficulties: string | null;
  nextSteps: string | null;
  createdAt: string;
  updatedAt: string;
}
export interface TechnicalProblemContext {
  id: string;
  title: string;
  problem: string;
  technology: string | null;
  solution?: string | null;
  sharingAuthorizedAt?: string | null;
}
export interface ProjectContext {
  id: string;
  name: string;
  description: string | null;
  status: string;
  priority: number | null;
  estimatedCompletionAt: string | null;
  team?: Person;
  leader?: Person | null;
  responsibleUser?: Person | null;
  _count?: { members: number };
  members?: { userId: string; user?: Person & { checkIns?: CheckInContext[] }; latestCheckIn?: CheckInContext | null }[];
  openTechnicalProblems?: TechnicalProblemContext[];
  technicalProblems?: TechnicalProblemContext[];
}

export async function getProjectData<T>(path: string, signal?: AbortSignal): Promise<T> {
  const session = readAuthSession();
  if (!session) throw new Error('Entre novamente para consultar seus projetos.');
  const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:3001';
  const response = await fetch(`${baseUrl}/api/v1${path}`, {
    headers: { Authorization: `Bearer ${session.accessToken}` }, cache: 'no-store', signal,
  });
  if (response.status === 401) {
    clearAuthSession();
    window.location.replace('/login');
    throw new Error('Sua sessão expirou. Entre novamente.');
  }
  if (response.status === 403 || response.status === 404) throw new Error('Este contexto não está disponível para sua conta.');
  if (!response.ok) throw new Error('Não foi possível carregar o contexto. Tente novamente.');
  return response.json() as Promise<T>;
}

export function projectStatus(status: string): string {
  return ({ PLANNING: 'Planejamento', ACTIVE: 'Ativo', PAUSED: 'Pausado', COMPLETED: 'Concluído' } as Record<string, string>)[status] ?? status;
}
export function contextDate(value: string | null | undefined, time = false): string {
  if (!value) return 'Não informada';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Não informada';
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', ...(time ? { timeStyle: 'short' as const } : {}) }).format(date);
}
