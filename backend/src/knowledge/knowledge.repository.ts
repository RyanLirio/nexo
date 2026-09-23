export interface KnowledgeEntryRecord {
  id: string;
  projectId: string;
  authorId: string;
  title: string;
  problem: string;
  technology?: string | null;
  solution: string;
  sharingAuthorizedBy?: string | null;
  sharingAuthorizedAt?: Date | null;
  sourceCheckInId?: string | null;
  sourceHelpRequestId?: string | null;
  createdAt: Date;
  updatedAt: Date;
  author?: { id: string; name: string };
  project?: { id: string; name: string };
}

export abstract class KnowledgeRepository {
  abstract list(query?: string, projectId?: string): Promise<any[]>;
  abstract findById(id: string): Promise<any | null>;
  abstract create(data: {
    projectId: string;
    authorId: string;
    title: string;
    problem: string;
    solution: string;
    technology?: string | null;
    sourceCheckInId?: string | null;
    sourceHelpRequestId?: string | null;
  }): Promise<KnowledgeEntryRecord>;
  abstract authorize(id: string, authorId: string, authorizedAt: Date): Promise<KnowledgeEntryRecord>;
  abstract projectExists(projectId: string): Promise<boolean>;
  abstract isProjectMember(projectId: string, userId: string): Promise<boolean>;
  abstract findSourceCheckIn(id: string): Promise<{ projectId: string } | null>;
  abstract findSourceHelpRequest(id: string): Promise<{ projectId: string } | null>;
}
