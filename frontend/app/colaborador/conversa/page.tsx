'use client';

import { useRouter } from 'next/navigation';
import { FormEvent, useEffect, useRef, useState } from 'react';
import { AuthSession, clearAuthSession, readAuthSession } from '../../../lib/auth-session';
import { ChatMessage, conversationWelcome, isConversationResponse, parseHistory, requestError } from '../../../lib/conversation-data';

const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:3001';

export default function ConversationPage() {
  const router = useRouter();
  const [session, setSession] = useState<AuthSession | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const sending = useRef(false);
  const messageEnd = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const current = readAuthSession();
    setSession(current);
    setMessages([conversationWelcome(current?.user.role)]);
    if (!current) { setHistoryLoading(false); return; }
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 15_000);
    let mounted = true;
    async function loadHistory() {
      try {
        const response = await fetch(`${apiBaseUrl}/api/v1/conversations/current`, {
          headers: { Authorization: `Bearer ${current!.accessToken}` }, signal: controller.signal,
        });
        if (response.status === 401) { clearAuthSession(); router.replace('/login'); return; }
        if (!response.ok) throw new Error('Não foi possível carregar suas mensagens anteriores. Recarregue para tentar novamente.');
        const history = parseHistory(await response.json());
        if (mounted && history.length) setMessages(history);
      } catch {
        if (mounted) setError('Não foi possível carregar suas mensagens anteriores. Recarregue para tentar novamente.');
      } finally { window.clearTimeout(timeout); if (mounted) setHistoryLoading(false); }
    }
    void loadHistory();
    return () => { mounted = false; window.clearTimeout(timeout); controller.abort(); };
  }, [router]);
  useEffect(() => { messageEnd.current?.scrollIntoView({ block: 'nearest' }); }, [messages, loading]);

  async function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const message = text.trim();
    if (!message || sending.current || historyLoading) return;
    sending.current = true;

    const currentSession = readAuthSession();
    const messageId = crypto.randomUUID();

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
      sending.current = false;
      router.replace('/login');
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
        signal: AbortSignal.timeout(120_000),
      });
      const body: unknown = await response.json().catch(() => null);

      if (response.status === 401) {
        clearAuthSession();
        setSession(null);
        router.replace('/login');
        return;
      }

      if (!response.ok) {
        throw new Error(requestError(response.status));
      }

      if (!isConversationResponse(body)) {
        throw new Error('Não foi possível ler a resposta do Nexo. Tente novamente.');
      }

      setMessages((current) => [
        ...current.filter((item) => item.id !== body.assistantMessage.id).map(item => item.id === `${messageId}-user` ? { ...item, id: body.messageId } : item),
        { id: body.assistantMessage.id, author: 'nexo', text: body.assistantMessage.content },
      ]);
    } catch (cause) {
      setError(cause instanceof DOMException && cause.name === 'TimeoutError'
        ? 'O Nexo demorou para responder. Recarregue para conferir se a mensagem foi registrada antes de reenviar.'
        : cause instanceof TypeError ? 'Não foi possível conectar ao Nexo. Tente novamente.' : cause instanceof Error ? cause.message : 'Não foi possível processar sua mensagem. Tente novamente.');
    } finally {
      setLoading(false);
      sending.current = false;
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
              <small>Seu contexto de trabalho</small>
            </span>
          </div>
          <span className="panel-badge">Conversa de hoje</span>
        </div>

        <div className="chat-messages" aria-live="polite">
          {historyLoading && <p role="status">Carregando suas mensagens de hoje…</p>}
          {messages.map((message) => {
            const isUser = message.author === 'user';
            return (
              <div className={`message-row ${isUser ? 'message-row-user' : ''}`} key={message.id}>
                <span className={`message-avatar ${isUser ? 'message-avatar-user' : ''}`} aria-hidden="true">
                  {isUser ? userInitial : '✳'}
                </span>
                <div className="message">
                  <strong>{isUser ? userName : 'Nexo'}</strong>
                  <p>{message.text}</p>
                </div>
              </div>
            );
          })}

          {loading && (
            <div className="message-row" role="status">
              <span className="message-avatar" aria-hidden="true">✳</span>
              <div className="message message-loading"><strong>Nexo</strong><p>Nexo está analisando…</p></div>
            </div>
          )}
          <div ref={messageEnd} />
        </div>

        {error && <p className="conversation-error" role="alert">{error}</p>}

        <label className="chat-label" htmlFor="conversation-message">Sua mensagem</label>
        <form className="chat-form" onSubmit={send}>
          <input
            id="conversation-message"
            value={text}
            onChange={(event) => setText(event.target.value)}
            placeholder="Ex.: Hoje finalizei a integração bancária e comecei a revisar o Portal..."
            disabled={loading || historyLoading}
            maxLength={10000}
            autoComplete="off"
          />
          <button className="button" type="submit" disabled={!text.trim() || loading || historyLoading}>
            {loading ? 'Enviando…' : 'Enviar'} <span aria-hidden="true">↗</span>
          </button>
        </form>
        <p className="chat-note">Suas mensagens ajudam o Nexo a manter o contexto dos projetos durante o trabalho.</p>
      </section>
    </main>
  );
}
