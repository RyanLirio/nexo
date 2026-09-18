import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Nexo',
  description: 'Contexto que conecta equipes.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="pt-BR"><body><div className="app-layout"><header className="topbar"><span className="brand">Nexo<span className="brand-mark">.</span></span><span className="topbar-note">Contexto que conecta equipes.</span></header>{children}</div></body></html>;
}
