import type { Metadata } from 'next';
import AppChrome from '../components/app-chrome';
import './globals.css';

export const metadata: Metadata = {
  title: 'Nexo — contexto que conecta equipes',
  description: 'Um lugar para acompanhar projetos, compartilhar contexto e destravar o trabalho.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" data-theme="dark">
      <body>
        <a className="skip-link" href="#main-content">Pular para o conteúdo</a>
        <AppChrome>{children}</AppChrome>
      </body>
    </html>
  );
}
