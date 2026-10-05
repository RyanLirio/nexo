export interface UserRecord {
  id: string;
  name: string;
  email: string;
  role: string;
  isActive: boolean;
  avatarUrl?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserProjectRecord {
  id: string;
  name: string;
  description?: string | null;
  status: string;
  teamId: string;
  leaderId?: string | null;
  responsibleUserId?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ListUsersParams {
  search?: string;
  status?: 'active' | 'inactive' | 'all';
  role?: string;
}

export abstract class UserRepository {
  abstract findById(id: string): Promise<UserRecord | null>;
  abstract findByEmail(email: string): Promise<UserRecord | null>;
  abstract list(params?: ListUsersParams | string): Promise<UserRecord[]>;
  abstract create(data: { name: string; email: string; role: string }): Promise<UserRecord>;
  abstract update(
    id: string,
    data: { name?: string; role?: string; isActive?: boolean },
  ): Promise<UserRecord>;
  abstract countActiveAdmins(): Promise<number>;
  abstract findUserProjects(
    userId: string,
    relation?: 'member' | 'responsible' | 'leader',
    status?: string,
    viewerId?: string,
  ): Promise<UserProjectRecord[]>;
  abstract updateGoogleAuth(
    userId: string,
    data: { googleSubject?: string; avatarUrl?: string; name?: string },
  ): Promise<void>;
}
