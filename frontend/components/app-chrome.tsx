'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { ReactNode, useEffect, useRef, useState } from 'react';
import { Shield } from 'lucide-react';
import { AuthSession, clearAuthSession, dashboardFor, navigationFor, readAuthSession, SESSION_CHANGED } from '../lib/auth-session';
import { UserAvatar, initials } from './UserAvatar';

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

export default function AppChrome({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [session, setSession] = useState<AuthSession | null>(null);
  const [ready, setReady] = useState(false);
  const [theme, setTheme] = useState<Theme>('dark');
  const [profileOpen, setProfileOpen] = useState(false);
  const profile = useRef<HTMLDivElement>(null);
  const profileButton = useRef<HTMLButtonElement>(null);
  const protectedPath = isProtectedPath(pathname);

  useEffect(() => {
    let savedTheme: string | null = null;
    try { savedTheme = window.localStorage.getItem(THEME_KEY); } catch { /* Mantém o tema padrão. */ }
    const initialTheme: Theme = savedTheme === 'light' ? 'light' : 'dark';
    document.documentElement.dataset.theme = initialTheme;
    setTheme(initialTheme);
  }, []);

  useEffect(() => {
    function syncSession() {
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
    }
    syncSession();
    setProfileOpen(false);
    window.addEventListener(SESSION_CHANGED, syncSession);
    const expiryCheck = window.setInterval(syncSession, 30_000);
    return () => { window.removeEventListener(SESSION_CHANGED, syncSession); window.clearInterval(expiryCheck); };
  }, [pathname, protectedPath, router]);

  useEffect(() => {
    if (!profileOpen) return;
    function outside(event: PointerEvent) {
      if (!profile.current?.contains(event.target as Node)) setProfileOpen(false);
    }
    function escape(event: KeyboardEvent) {
      if (event.key === 'Escape') { setProfileOpen(false); profileButton.current?.focus(); }
    }
    document.addEventListener('pointerdown', outside);
    document.addEventListener('keydown', escape);
    return () => { document.removeEventListener('pointerdown', outside); document.removeEventListener('keydown', escape); };
  }, [profileOpen]);

  function logout() {
    clearAuthSession();
    setSession(null);
    setProfileOpen(false);
    router.replace('/login');
  }

  function toggleTheme() {
    const nextTheme: Theme = theme === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = nextTheme;
    try { window.localStorage.setItem(THEME_KEY, nextTheme); } catch { /* Tema funciona sem persistência. */ }
    setTheme(nextTheme);
  }

  return (
    <div className="app-layout">
      <header className="topbar">
        <Link className="brand" href={session ? dashboardFor(session.user.role) : '/'} aria-label="Nexo, página inicial">
          <span className="brand-symbol" aria-hidden="true">✳</span>
          <span>nexo<span className="brand-dot">.</span></span>
        </Link>
        <nav className="topnav" aria-label="Navegação principal">
          {navigationFor(session?.user.role).map(link => (
            <Link key={link.href} href={link.href} aria-current={pathname === link.href ? 'page' : undefined}>{link.label}</Link>
          ))}
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
          <div className="profile-container" ref={profile}>
            <button ref={profileButton} className="profile-link profile-button" type="button" onClick={() => setProfileOpen(open => !open)}
              aria-label={`Dados da conta de ${session.user.name}`} aria-expanded={profileOpen} aria-controls="profile-panel">
              <UserAvatar name={session.user.name} avatarUrl={session.user.avatarUrl} className="profile-avatar" />
              <span>{session.user.name.split(' ')[0]} <span aria-hidden="true">⌄</span></span>
            </button>
            {profileOpen && <div id="profile-panel" className="profile-panel" aria-label="Dados da conta">
              <strong>{session.user.name}</strong>
              <span>{session.user.email}</span>
              <small>{({ MEMBER: 'Colaborador', LEADER: 'Líder', ADMIN: 'Administrador' })[session.user.role]}</small>
              <button type="button" className="profile-logout" onClick={logout}>Sair</button>
            </div>}
          </div>
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
