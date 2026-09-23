export interface CheckInRecord {
  id: string;
  projectId: string;
  userId: string;
  summary: string;
  difficulties?: string | null;
  nextSteps?: string | null;
  createdAt: Date;
  updatedAt: Date;
  user?: {
    id: string;
    name: string;
  };
  messages?: {
    messageId: string;
    message?: {
      id: string;
      content: string;
      role: string;
      createdAt: Date;
    };
  }[];
}

export abstract class CheckInRepository {
  abstract projectExists(projectId: string): Promise<boolean>;
  abstract isProjectMember(projectId: string, userId: string): Promise<boolean>;
  abstract listByProject(projectId: string): Promise<CheckInRecord[]>;
  abstract findById(id: string): Promise<CheckInRecord | null>;
  abstract create(data: {
    projectId: string;
    userId: string;
    summary: string;
    difficulties?: string | null;
    nextSteps?: string | null;
    messageIds?: string[];
  }): Promise<CheckInRecord>;
}
