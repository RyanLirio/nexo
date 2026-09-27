export type UserRole = 'ADMIN' | 'LEADER' | 'MEMBER';

export interface AuthenticatedUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  avatarUrl?: string | null;
}

export interface AuthSession {
  accessToken: string;
  user: AuthenticatedUser;
}

const SESSION_KEY = 'nexo.auth.session';

export function saveAuthSession(session: AuthSession): void {
  window.sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

export function readAuthSession(): AuthSession | null {
  const value = window.sessionStorage.getItem(SESSION_KEY);
  if (!value) return null;

  try {
    return JSON.parse(value) as AuthSession;
  } catch {
    window.sessionStorage.removeItem(SESSION_KEY);
    return null;
  }
}

export function clearAuthSession(): void {
  window.sessionStorage.removeItem(SESSION_KEY);
}

export function dashboardFor(role: UserRole): '/lider' | '/colaborador' {
  return role === 'ADMIN' || role === 'LEADER' ? '/lider' : '/colaborador';
}
