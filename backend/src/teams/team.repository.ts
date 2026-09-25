export interface TeamRecord {
  id: string;
  name: string;
  description?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface TeamMemberRecord {
  teamId: string;
  userId: string;
  joinedAt: Date;
  user?: {
    id: string;
    name: string;
    email?: string;
  };
}

export abstract class TeamRepository {
  abstract list(): Promise<TeamRecord[]>;
  abstract findById(id: string): Promise<TeamRecord | null>;
  abstract create(data: { name: string; description?: string | null }): Promise<TeamRecord>;
  abstract update(id: string, data: { name?: string; description?: string | null }): Promise<TeamRecord>;
  abstract listMembers(teamId: string): Promise<TeamMemberRecord[]>;
  abstract findMember(teamId: string, userId: string): Promise<TeamMemberRecord | null>;
  abstract addMember(teamId: string, userId: string): Promise<TeamMemberRecord>;
  abstract removeMember(teamId: string, userId: string): Promise<void>;
}
