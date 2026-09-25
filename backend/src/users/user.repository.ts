export interface UserRecord {
  id: string;
  name: string;
  email: string;
  role: string;
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

export abstract class UserRepository {
  abstract findById(id: string): Promise<UserRecord | null>;
  abstract findByEmail(email: string): Promise<UserRecord | null>;
  abstract list(search?: string): Promise<UserRecord[]>;
  abstract findUserProjects(
    userId: string,
    relation?: 'member' | 'responsible' | 'leader',
    status?: string,
  ): Promise<UserProjectRecord[]>;
  abstract updateGoogleAuth(
    userId: string,
    data: { googleSubject?: string; avatarUrl?: string; name?: string },
  ): Promise<void>;
}
