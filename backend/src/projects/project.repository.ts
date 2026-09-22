export interface ProjectRecord {
  id: string;
  name: string;
  description?: string | null;
  status: string;
  teamId: string;
  leaderId?: string | null;
  responsibleUserId?: string | null;
  createdBy?: string | null;
  createdAt: Date;
  updatedAt: Date;
  members?: ProjectMemberRecord[];
}

export interface ProjectMemberRecord {
  projectId: string;
  userId: string;
  role: 'OWNER' | 'MEMBER';
  joinedAt: Date;
  user?: {
    id: string;
    name: string;
    email?: string;
  };
}

export abstract class ProjectRepository {
  abstract findById(id: string): Promise<any | null>;
  abstract list(filter?: { teamId?: string; status?: string; userId?: string }): Promise<any[]>;
  abstract create(data: {
    teamId: string;
    name: string;
    description?: string | null;
    leaderId?: string | null;
    responsibleUserId?: string | null;
    createdBy?: string | null;
    members?: { userId: string; role: 'OWNER' | 'MEMBER' }[];
  }): Promise<ProjectRecord>;
  abstract update(id: string, data: { name?: string; description?: string | null }): Promise<ProjectRecord>;
  abstract updateStatus(
    id: string,
    newStatus: string,
    changedById: string,
    reason?: string | null,
    previousStatus?: string,
  ): Promise<ProjectRecord>;
  abstract listMembers(projectId: string): Promise<ProjectMemberRecord[]>;
  abstract findMember(projectId: string, userId: string): Promise<ProjectMemberRecord | null>;
  abstract addMember(projectId: string, userId: string, role?: 'OWNER' | 'MEMBER'): Promise<ProjectMemberRecord>;
  abstract removeMember(projectId: string, userId: string): Promise<void>;
  abstract findTeam(teamId: string): Promise<{ id: string } | null>;
  abstract findTeamMember(teamId: string, userId: string): Promise<{ userId: string; role: string } | null>;
}
