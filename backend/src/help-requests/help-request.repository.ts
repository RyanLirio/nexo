export interface HelpRequestRecord {
  id: string;
  projectId: string;
  requesterId: string;
  helperId?: string | null;
  problem: string;
  status: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED';
  createdAt: Date;
  updatedAt: Date;
  resolvedAt?: Date | null;
  requester?: { id: string; name: string };
  helper?: { id: string; name: string };
}

export abstract class HelpRequestRepository {
  abstract list(projectId?: string, status?: string): Promise<HelpRequestRecord[]>;
  abstract findById(id: string): Promise<HelpRequestRecord | null>;
  abstract create(data: {
    projectId: string;
    requesterId: string;
    problem: string;
    helperId?: string | null;
  }): Promise<HelpRequestRecord>;
  abstract updateStatus(
    id: string,
    status: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED',
    resolvedAt: Date | null,
  ): Promise<HelpRequestRecord>;
  abstract projectExists(projectId: string): Promise<boolean>;
  abstract isProjectMember(projectId: string, userId: string): Promise<boolean>;
}
