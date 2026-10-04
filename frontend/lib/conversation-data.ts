export interface ChatMessage { id: string; author: 'user' | 'nexo'; text: string }
interface StoredMessage { id: string; role: 'USER' | 'ASSISTANT'; content: string }
export interface ConversationResponse { messageId: string; assistantMessage: StoredMessage }

function isStoredMessage(value: unknown): value is StoredMessage {
  if (!value || typeof value !== 'object') return false;
  const message = value as Partial<StoredMessage>;
  return typeof message.id === 'string' && !!message.id.trim()
    && (message.role === 'USER' || message.role === 'ASSISTANT')
    && typeof message.content === 'string' && !!message.content.trim();
}

export function isConversationResponse(value: unknown): value is ConversationResponse {
  if (!value || typeof value !== 'object') return false;
  const body = value as Partial<ConversationResponse>;
  return typeof body.messageId === 'string' && !!body.messageId.trim()
    && isStoredMessage(body.assistantMessage) && body.assistantMessage.role === 'ASSISTANT';
}

export function parseHistory(value: unknown): ChatMessage[] {
  if (!value || typeof value !== 'object') throw new Error('Não foi possível ler suas mensagens anteriores.');
  const body = value as { conversationId?: unknown; messages?: unknown };
  if (!(body.conversationId === null || typeof body.conversationId === 'string')
    || !Array.isArray(body.messages) || !body.messages.every(isStoredMessage)) {
    throw new Error('Não foi possível ler suas mensagens anteriores.');
  }
  return [...new Map(body.messages.map(message => [message.id, {
    id: message.id, author: message.role === 'USER' ? 'user' as const : 'nexo' as const, text: message.content,
  }])).values()];
}

export function requestError(status: number): string {
  if (status === 403) return 'Você não tem acesso a este recurso.';
  if (status === 404) return 'Não encontramos este recurso.';
  if (status === 400 || status === 413) return 'Confira sua mensagem. Use até 10.000 caracteres.';
  return 'Não foi possível processar sua mensagem. Tente novamente.';
}
