import { readAuthSession, UserRole } from './auth-session';

const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:3001';

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  isActive: boolean;
  avatarUrl?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AdminTeam {
  id: string;
  name: string;
  description?: string | null;
  createdAt: string;
  updatedAt: string;
  members?: Array<{ user: { id: string; name: string; email: string; role: UserRole } }>;
  projects?: Array<{ id: string; name: string; status: string }>;
  _count?: {
    members?: number;
    projects?: number;
  };
}

export interface AdminProject {
  id: string;
  name: string;
  description?: string | null;
  status: 'PLANNING' | 'ACTIVE' | 'PAUSED' | 'COMPLETED';
  teamId: string;
  team?: { id: string; name: string };
  leaderId?: string | null;
  leader?: { id: string; name: string; email: string } | null;
  responsibleUserId?: string | null;
  responsibleUser?: { id: string; name: string; email: string } | null;
  members?: Array<{ user: { id: string; name: string } }>;
  estimatedCompletionAt?: string | null;
  createdAt: string;
}

export interface AdminTechnicalProblem {
  id: string;
  title: string;
  problem: string;
  solution?: string | null;
  technology?: string | null;
  sharingAuthorizedAt?: string | null;
  createdAt: string;
  author?: { id: string; name: string; email: string };
  project?: { id: string; name: string };
}

export interface AdminHelpRequest {
  id: string;
  problem: string;
  status: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED';
  createdAt: string;
  resolvedAt?: string | null;
  requester?: { id: string; name: string; email: string };
  helper?: { id: string; name: string; email: string } | null;
  project?: { id: string; name: string };
}

async function authFetch<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const session = readAuthSession();
  const headers = new Headers(options.headers || {});
  headers.set('Content-Type', 'application/json');
  if (session?.accessToken) {
    headers.set('Authorization', `Bearer ${session.accessToken}`);
  }

  const res = await fetch(`${apiBaseUrl}${endpoint}`, {
    ...options,
    headers,
  });

  const body = await res.json().catch(() => null);

  if (!res.ok) {
    const errorMsg =
      (body && typeof body === 'object' && 'message' in body
        ? Array.isArray(body.message)
          ? body.message.join(', ')
          : String(body.message)
        : null) || `Erro na requisição (${res.status})`;
    throw new Error(errorMsg);
  }

  return body as T;
}

export const adminApi = {
  // Users
  getUsers: (search?: string, status?: string) => {
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    if (status) params.set('status', status);
    const query = params.toString() ? `?${params.toString()}` : '';
    return authFetch<AdminUser[]>(`/api/v1/users${query}`);
  },

  createUser: (data: { name: string; email: string; role: UserRole }) =>
    authFetch<AdminUser>('/api/v1/users', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  updateUser: (id: string, data: { name?: string; role?: UserRole; isActive?: boolean }) =>
    authFetch<AdminUser>(`/api/v1/users/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  // Teams
  getTeams: () => authFetch<AdminTeam[]>('/api/v1/teams'),

  createTeam: (data: { name: string; description?: string }) =>
    authFetch<AdminTeam>('/api/v1/teams', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  updateTeam: (id: string, data: { name?: string; description?: string }) =>
    authFetch<AdminTeam>(`/api/v1/teams/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  deleteTeam: (id: string) =>
    authFetch<{ ok: boolean }>(`/api/v1/teams/${id}`, {
      method: 'DELETE',
    }),

  getTeamMembers: (teamId: string) =>
    authFetch<Array<{ teamId: string; userId: string; user: AdminUser }>>(`/api/v1/teams/${teamId}/members`),

  addTeamMember: (teamId: string, userId: string) =>
    authFetch<{ teamId: string; userId: string }>(`/api/v1/teams/${teamId}/members`, {
      method: 'POST',
      body: JSON.stringify({ userId }),
    }),

  removeTeamMember: (teamId: string, userId: string) =>
    authFetch<{ ok: boolean }>(`/api/v1/teams/${teamId}/members/${userId}`, {
      method: 'DELETE',
    }),

  // Projects (Read-only)
  getProjects: (status?: string, teamId?: string) => {
    const params = new URLSearchParams();
    if (status) params.set('status', status);
    if (teamId) params.set('teamId', teamId);
    const query = params.toString() ? `?${params.toString()}` : '';
    return authFetch<AdminProject[]>(`/api/v1/projects${query}`);
  },

  // Technical Problems (Read-only)
  getTechnicalProblems: () => authFetch<AdminTechnicalProblem[]>('/api/v1/technical-problems'),

  // Help Requests (Read-only)
  getHelpRequests: (status?: string) => {
    const query = status ? `?status=${status}` : '';
    return authFetch<AdminHelpRequest[]>(`/api/v1/help-requests${query}`);
  },
};
