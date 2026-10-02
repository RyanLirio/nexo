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

export abstract class ConversationRepository {
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
    senderId: string;
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
}