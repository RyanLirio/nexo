'use client';

import { FormEvent, useEffect, useState } from 'react';
import { AuthSession, readAuthSession } from '../../../lib/auth-session';

const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:3001';

interface ConversationResponse {
  projects: Array<{
    projectId: string;
    summary: string;
  }>;
}

type ChatMessage =
  | { id: string; author: 'user'; text: string }
  | { id: string; author: 'nexo'; text: string }
  | { id: string; author: 'nexo'; response: ConversationResponse };

function isConversationResponse(value: unknown): value is ConversationResponse {
  if (!value || typeof value !== 'object' || !('projects' in value)) return false;

  const projects = (value as { projects?: unknown }).projects;
  return Array.isArray(projects) && projects.every((project) => (
    project !== null
    && typeof project === 'object'
    && typeof (project as { projectId?: unknown }).projectId === 'string'
    && typeof (project as { summary?: unknown }).summary === 'string'
  ));
}

function errorMessage(body: unknown): string {
  if (body && typeof body === 'object' && 'message' in body) {
    const message = (body as { message?: unknown }).message;
    if (typeof message === 'string') return message;
    if (Array.isArray(message)) return message.join(' ');
  }

  return 'Não foi possível analisar a mensagem. Tente novamente.';
}

export default function ConversationPage() {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      author: 'nexo',
      text: 'Conte como foi seu trabalho. Você pode falar de mais de um projeto na mesma mensagem.',
    },
  ]);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setSession(readAuthSession());
  }, []);

  async function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const message = text.trim();
    if (!message || loading) return;

    const currentSession = readAuthSession();
    const messageId = Date.now().toString();

    setMessages((current) => [
      ...current,
      { id: `${messageId}-user`, author: 'user', text: message },
    ]);
    setText('');
    setError(null);
    setLoading(true);

    if (!currentSession) {
      setError('Sua sessão não está disponível. Entre novamente para continuar.');
      setLoading(false);
      return;
    }

    try {
      const response = await fetch(`${apiBaseUrl}/api/v1/conversations/message`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${currentSession.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ message }),
      });
      const body: unknown = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(errorMessage(body));
      }

      if (!isConversationResponse(body)) {
        throw new Error('O backend retornou uma resposta em formato inesperado.');
      }

      setMessages((current) => [
        ...current,
        { id: `${messageId}-nexo`, author: 'nexo', response: body },
      ]);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível analisar a mensagem. Tente novamente.');
    } finally {
      setLoading(false);
    }
  }

  const userName = session?.user.name.split(' ')[0] || 'Você';
  const userInitial = userName.charAt(0).toUpperCase() || 'V';

  return (
    <main id="main-content" tabIndex={-1} className="content conversation-page">
      <header className="conversation-heading">
        <span className="eyebrow"><span className="eyebrow-line" /> Contexto geral do trabalho</span>
        <h1>Conversa com o Nexo</h1>
        <p>Conte seus avanços e dificuldades. O Nexo separa o contexto entre os projetos identificados.</p>
      </header>

      <section className="chat card conversation-chat" aria-labelledby="conversation-panel-title">
        <div className="panel-heading">
          <div>
            <span className="chat-symbol" aria-hidden="true">✳</span>
            <span>
              <strong id="conversation-panel-title">Nexo</strong>
              <small>Conversa geral · resposta real do backend</small>
            </span>
          </div>
          <span className="panel-badge"><span className="live-dot" /> IA conectada</span>
        </div>

        <div className="chat-messages" aria-live="polite">
          {messages.map((message) => {
            const isUser = message.author === 'user';
            return (
              <div className={`message-row ${isUser ? 'message-row-user' : ''}`} key={message.id}>
                <span className={`message-avatar ${isUser ? 'message-avatar-user' : ''}`} aria-hidden="true">
                  {isUser ? userInitial : '✳'}
                </span>
                <div className={`message ${'response' in message ? 'message-response' : ''}`}>
                  <strong>{isUser ? userName : 'Nexo'}</strong>
                  {'text' in message && <p>{message.text}</p>}
                  {'response' in message && <pre>{JSON.stringify(message.response, null, 2)}</pre>}
                </div>
              </div>
            );
          })}

          {loading && (
            <div className="message-row" role="status">
              <span className="message-avatar" aria-hidden="true">✳</span>
              <div className="message message-loading"><strong>Nexo</strong><p>Analisando a mensagem por projeto…</p></div>
            </div>
          )}
        </div>

        {error && <p className="conversation-error" role="alert">{error}</p>}

        <label className="chat-label" htmlFor="conversation-message">Sua mensagem</label>
        <form className="chat-form" onSubmit={send}>
          <input
            id="conversation-message"
            value={text}
            onChange={(event) => setText(event.target.value)}
            placeholder="Ex.: Hoje finalizei a integração bancária e comecei a revisar o Portal..."
            disabled={loading}
            autoComplete="off"
          />
          <button className="button" type="submit" disabled={!text.trim() || loading}>
            {loading ? 'Enviando…' : 'Enviar'} <span aria-hidden="true">↗</span>
          </button>
        </form>
        <p className="chat-note">Esta integração não salva histórico. Cada resposta abaixo vem diretamente do endpoint de conversa.</p>
      </section>
    </main>
  );
}
