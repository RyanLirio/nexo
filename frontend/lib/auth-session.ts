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
export const SESSION_CHANGED = 'nexo:session-changed';

export function isAuthSession(value: unknown): value is AuthSession {
  if (!value || typeof value !== 'object') return false;
  const session = value as Partial<AuthSession>;
  const user = session.user;
  if (typeof session.accessToken !== 'string' || !session.accessToken.trim()
    || !user || typeof user !== 'object'
    || !['id', 'name', 'email'].every(key => typeof user[key as 'id' | 'name' | 'email'] === 'string' && user[key as 'id' | 'name' | 'email'].trim())
    || !['ADMIN', 'LEADER', 'MEMBER'].includes(user.role)) return false;
  try {
    const payload = JSON.parse(atob(session.accessToken.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))) as { exp?: unknown };
    return typeof payload.exp === 'number' && payload.exp * 1000 > Date.now();
  } catch { return false; }
}

export function saveAuthSession(session: AuthSession): void {
  if (!isAuthSession(session)) throw new Error('Não foi possível validar sua sessão. Entre novamente.');
  window.sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
  window.dispatchEvent(new Event(SESSION_CHANGED));
}

export function readAuthSession(): AuthSession | null {
  try {
    const value = window.sessionStorage.getItem(SESSION_KEY);
    if (!value) return null;
    const session: unknown = JSON.parse(value);
    if (isAuthSession(session)) return session;
  } catch {
    // Storage bloqueado ou corrompido não deve derrubar a página.
  }
  try { window.sessionStorage.removeItem(SESSION_KEY); } catch { /* Storage indisponível. */ }
  return null;
}

export function clearAuthSession(): void {
  window.sessionStorage.removeItem(SESSION_KEY);
  window.dispatchEvent(new Event(SESSION_CHANGED));
}

export function navigationFor(role?: UserRole) {
  if (!role) return [];
  const links = [
    { href: '/colaborador', label: 'Meus projetos' },
    { href: '/colaborador/conversa', label: 'Conversa com o Nexo' },
  ];
  if (role !== 'MEMBER') links.push({ href: '/lider', label: 'Visão da equipe' });
  return links;
}

export function dashboardFor(role: UserRole): '/lider' | '/colaborador' {
  return role === 'ADMIN' || role === 'LEADER' ? '/lider' : '/colaborador';
}
