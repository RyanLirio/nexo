import type { Metadata } from 'next';
import Link from 'next/link';
import './globals.css';

export const metadata: Metadata = {
  title: 'Nexo — contexto que conecta equipes',
  description: 'Um lugar para acompanhar projetos, compartilhar contexto e destravar o trabalho.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>
        <div className="app-layout">
          <header className="topbar">
            <Link className="brand" href="/" aria-label="Nexo, página inicial">
              <span className="brand-symbol" aria-hidden="true">✳</span>
              <span>nexo<span className="brand-dot">.</span></span>
            </Link>
            <nav className="topnav" aria-label="Navegação principal">
              <Link href="/colaborador">Meus projetos</Link>
              <Link href="/lider">Visão da equipe</Link>
            </nav>
            <Link className="profile-link" href="/login" aria-label="Voltar ao login">
              <span className="profile-avatar">R</span>
              <span>Ryan <span aria-hidden="true">↗</span></span>
            </Link>
          </header>
          {children}
        </div>
      </body>
    </html>
  );
}
