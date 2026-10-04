'use client';

import Script from 'next/script';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AuthSession,
  clearAuthSession,
  dashboardFor,
  readAuthSession,
  saveAuthSession,
  isAuthSession,
} from '../../lib/auth-session';

const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:3001';
const googleClientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

function messageFromResponse(body: unknown): string {
  if (body && typeof body === 'object' && 'message' in body) {
    const message = (body as { message?: unknown }).message;
    if (typeof message === 'string') return message;
    if (Array.isArray(message)) return message.join(' ');
  }
  return 'Não foi possível entrar. Tente novamente.';
}

export default function LoginPage() {
  const router = useRouter();
  const buttonContainer = useRef<HTMLDivElement>(null);
  const initialized = useRef(false);
  const authenticating = useRef(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [existingSession, setExistingSession] = useState<AuthSession | null>(null);

  useEffect(() => {
    setExistingSession(readAuthSession());
  }, []);

  const authenticate = useCallback(async ({ credential }: GoogleCredentialResponse) => {
    if (authenticating.current) return;
    authenticating.current = true;
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${apiBaseUrl}/api/v1/auth/google`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken: credential }),
        signal: AbortSignal.timeout(30_000),
      });
      const body: unknown = await response.json().catch(() => null);

      if (!response.ok || !isAuthSession(body)) {
        throw new Error(response.status >= 500 ? 'Não foi possível entrar agora. Tente novamente em instantes.' : messageFromResponse(body));
      }

      saveAuthSession(body);
      router.push(dashboardFor(body.user.role));
    } catch (cause) {
      setError(cause instanceof DOMException && cause.name === 'TimeoutError' ? 'O login demorou para responder. Tente novamente.'
        : cause instanceof TypeError ? 'Não foi possível conectar ao Nexo. Tente novamente.' : cause instanceof Error ? cause.message : 'Não foi possível entrar. Tente novamente.');
    } finally {
      setLoading(false);
      authenticating.current = false;
    }
  }, [router]);

  const initializeGoogle = useCallback(() => {
    if (!googleClientId || !window.google || !buttonContainer.current || initialized.current) return;

    initialized.current = true;
    window.google.accounts.id.initialize({
      client_id: googleClientId,
      callback: authenticate,
      auto_select: false,
      cancel_on_tap_outside: true,
    });
    window.google.accounts.id.renderButton(buttonContainer.current, {
      type: 'standard',
      theme: 'outline',
      size: 'large',
      text: 'continue_with',
      shape: 'rectangular',
      logo_alignment: 'left',
      width: Math.min(buttonContainer.current.clientWidth, 360),
      locale: 'pt-BR',
    });
  }, [authenticate]);

  useEffect(() => { if (!existingSession) initializeGoogle(); }, [existingSession, initializeGoogle]);

  function continueSession() {
    const current = readAuthSession();
    if (current) router.push(dashboardFor(current.user.role));
    else { setExistingSession(null); setError('Sua sessão expirou. Entre novamente.'); }
  }

  function changeAccount() {
    initialized.current = false;
    clearAuthSession();
    setExistingSession(null);
  }

  return (
    <main id="main-content" tabIndex={-1} className="login-page">
      <Script src="https://accounts.google.com/gsi/client" strategy="afterInteractive" onReady={initializeGoogle} />
      <section className="login-card" aria-labelledby="login-title">
        <div className="login-symbol" aria-hidden="true">✳</div>
        <span className="eyebrow">Bem-vindo ao Nexo</span>
        <h1 id="login-title">Contexto que conecta equipes.</h1>
        <p>Entre com a conta Google autorizada pela sua equipe.</p>

        {existingSession ? (
          <div className="saved-session">
            <div>
              <strong>{existingSession.user.name}</strong>
              <span>{existingSession.user.email}</span>
            </div>
            <button className="button" type="button" onClick={continueSession}>Continuar</button>
            <button className="login-secondary-button" type="button" onClick={changeAccount}>Usar outra conta</button>
          </div>
        ) : googleClientId ? (
          <>
            <div className={`google-login-container${loading ? ' is-loading' : ''}`} ref={buttonContainer} aria-busy={loading} />
            {loading && <p className="login-status" role="status">Validando sua conta…</p>}
          </>
        ) : (
          <p className="login-error" role="alert">O login Google ainda não está disponível. Avise o responsável pelo Nexo.</p>
        )}

        {error && <p className="login-error" role="alert">{error}</p>}
        <p className="login-note">O acesso é permitido somente para contas previamente cadastradas no Nexo.</p>
      </section>
      <p className="login-footer">Nexo · Programação IV</p>
    </main>
  );
}
