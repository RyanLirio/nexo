'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { ReactNode, useEffect, useState } from 'react';
import { Shield } from 'lucide-react';
import { AuthSession, clearAuthSession, readAuthSession } from '../lib/auth-session';

type Theme = 'dark' | 'light';

const THEME_KEY = 'nexo.theme';

function isProtectedPath(pathname: string): boolean {
  return (
    pathname === '/colaborador' ||
    pathname.startsWith('/colaborador/') ||
    pathname === '/lider' ||
    pathname.startsWith('/projetos/') ||
    pathname === '/admin' ||
    pathname.startsWith('/admin')
  );
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
  const [theme, setTheme] = useState<Theme>('dark');
  const protectedPath = isProtectedPath(pathname);

  useEffect(() => {
    const savedTheme = window.localStorage.getItem(THEME_KEY);
    const initialTheme: Theme = savedTheme === 'light' ? 'light' : 'dark';
    document.documentElement.dataset.theme = initialTheme;
    setTheme(initialTheme);
  }, []);

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

    if (pathname.startsWith('/admin') && currentSession?.user.role !== 'ADMIN') {
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

  function toggleTheme() {
    const nextTheme: Theme = theme === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = nextTheme;
    window.localStorage.setItem(THEME_KEY, nextTheme);
    setTheme(nextTheme);
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
          <Link href="/colaborador/conversa">Conversa com o Nexo</Link>
          {(session?.user.role === 'ADMIN' || session?.user.role === 'LEADER') && <Link href="/lider">Visão da equipe</Link>}
        </nav>
        <button
          className="theme-toggle"
          type="button"
          onClick={toggleTheme}
          aria-label={theme === 'dark' ? 'Ativar modo claro' : 'Ativar modo escuro'}
          title={theme === 'dark' ? 'Ativar modo claro' : 'Ativar modo escuro'}
        >
          <span aria-hidden="true">{theme === 'dark' ? '☀' : '☾'}</span>
        </button>
        {session?.user.role === 'ADMIN' && (
          <Link
            href="/admin"
            className="admin-badge-button"
            aria-label="Acessar painel administrativo"
          >
            <Shield size={14} aria-hidden="true" />
            <span>Painel Administrativo</span>
          </Link>
        )}
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
