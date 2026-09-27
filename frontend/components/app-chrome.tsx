'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { ReactNode, useEffect, useState } from 'react';
import { AuthSession, clearAuthSession, readAuthSession } from '../lib/auth-session';

function isProtectedPath(pathname: string): boolean {
  return pathname === '/colaborador' || pathname === '/lider' || pathname.startsWith('/projetos/');
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();
}

export default function AppChrome({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [session, setSession] = useState<AuthSession | null>(null);
  const [ready, setReady] = useState(false);
  const protectedPath = isProtectedPath(pathname);

  useEffect(() => {
    const currentSession = readAuthSession();
    setSession(currentSession);

    if (protectedPath && !currentSession) {
      setReady(false);
      router.replace('/login');
      return;
    }

    if (pathname === '/lider' && currentSession?.user.role === 'MEMBER') {
      setReady(false);
      router.replace('/colaborador');
      return;
    }

    setReady(true);
  }, [pathname, protectedPath, router]);

  function logout() {
    clearAuthSession();
    setSession(null);
    router.push('/login');
  }

  return (
    <div className="app-layout">
      <header className="topbar">
        <Link className="brand" href="/" aria-label="Nexo, página inicial">
          <span className="brand-symbol" aria-hidden="true">✳</span>
          <span>nexo<span className="brand-dot">.</span></span>
        </Link>
        <nav className="topnav" aria-label="Navegação principal">
          <Link href="/colaborador">Meus projetos</Link>
          {(session?.user.role === 'ADMIN' || session?.user.role === 'LEADER') && <Link href="/lider">Visão da equipe</Link>}
        </nav>
        {session ? (
          <button className="profile-link profile-button" type="button" onClick={logout} aria-label={`Sair da conta de ${session.user.name}`}>
            <span className="profile-avatar">{initials(session.user.name)}</span>
            <span>{session.user.name.split(' ')[0]} <span aria-hidden="true">↗</span></span>
          </button>
        ) : (
          <Link className="profile-link" href="/login" aria-label="Entrar no Nexo">
            <span className="profile-avatar">?</span>
            <span>Entrar <span aria-hidden="true">↗</span></span>
          </Link>
        )}
      </header>
      {protectedPath && !ready ? (
        <main id="main-content" className="auth-loading" aria-live="polite">Verificando sua sessão…</main>
      ) : children}
    </div>
  );
}
