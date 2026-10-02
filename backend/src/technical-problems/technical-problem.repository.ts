export interface TechnicalProblemRecord {
  id: string;
  projectId: string;
  authorId: string;
  title: string;
  problem: string;
  problemEmbedding?: number[] | null;
  technology?: string | null;
  solution?: string | null;
  sharingAuthorizedBy?: string | null;
  sharingAuthorizedAt?: Date | null;
  sourceCheckInId?: string | null;
  sourceHelpRequestId?: string | null;
  createdAt: Date;
  updatedAt: Date;
  author?: { id: string; name: string };
  project?: { id: string; name: string };
}

export abstract class TechnicalProblemRepository {
  abstract list(
    query?: string,
    projectId?: string,
    filter?: { status?: string; technology?: string },
  ): Promise<any[]>;
  abstract findById(id: string): Promise<any | null>;

  abstract create(data: {
    projectId: string;
    authorId: string;
    title: string;
    problem: string;
    solution?: string | null;
    technology?: string | null;
    sourceCheckInId?: string | null;
    sourceHelpRequestId?: string | null;
  }): Promise<TechnicalProblemRecord>;
  abstract authorize(id: string, authorId: string, authorizedAt: Date): Promise<TechnicalProblemRecord>;
  abstract projectExists(projectId: string): Promise<boolean>;
  abstract isProjectMember(projectId: string, userId: string): Promise<boolean>;
  abstract findSourceCheckIn(id: string): Promise<{ projectId: string } | null>;
  abstract findSourceHelpRequest(id: string): Promise<{ projectId: string } | null>;
  abstract updateSolution(id: string, solution: string): Promise<TechnicalProblemRecord>;
}

