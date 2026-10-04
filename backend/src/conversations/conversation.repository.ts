export interface ConversationRecord {
  id: string;
  userId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface MessageRecord {
  id: string;
  conversationId: string;
  senderId?: string | null;
  role: 'USER' | 'ASSISTANT';
  content: string;
  createdAt: Date;
}

export interface PendingSolutionSuggestionRecord {
  id: string;
  conversationId: string;
  userId: string;
  projectId: string;
  technicalProblemId: string;
  similarity: number;
  status: 'PENDING' | 'ACCEPTED' | 'DECLINED';
  createdAt: Date;
  updatedAt: Date;
}

export type PendingSolutionSuggestionInput = Pick<PendingSolutionSuggestionRecord,
  'conversationId' | 'userId' | 'projectId' | 'technicalProblemId' | 'similarity'>;

export interface PendingSolutionSuggestionWithProject extends PendingSolutionSuggestionRecord {
  projectName: string;
}

export abstract class ConversationRepository {
  abstract findConversationMessages(conversationId: string, userId: string, limit?: number): Promise<MessageRecord[]>;
  abstract findDailyConversation(
    userId: string,
    startOfDay: Date,
    endOfDay: Date,
  ): Promise<ConversationRecord | null>;

  abstract createConversation(
    userId: string,
  ): Promise<ConversationRecord>;

  abstract createMessage(data: {
    conversationId: string;
    senderId?: string | null;
    role?: MessageRecord['role'];
    content: string;
  }): Promise<MessageRecord>;

  abstract linkProject(
    conversationId: string,
    projectId: string,
  ): Promise<void>;

  abstract findRecentMessages(
    userId: string,
    limit?: number,
  ): Promise<MessageRecord[]>;

  abstract savePendingSuggestion(data: PendingSolutionSuggestionInput): Promise<PendingSolutionSuggestionRecord>;
  abstract findPendingSuggestions(userId: string, conversationId: string): Promise<PendingSolutionSuggestionWithProject[]>;
  abstract completeSuggestion(
    suggestion: PendingSolutionSuggestionRecord,
    status: 'ACCEPTED' | 'DECLINED',
    assistantContent: string,
  ): Promise<MessageRecord | null>;
}
