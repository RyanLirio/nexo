import Link from 'next/link';

export default function LoginPage() {
  return <main className="login-page"><section className="login-card card" aria-labelledby="login-title"><p className="eyebrow">Bem-vindo ao Nexo</p><h1 id="login-title">Contexto que conecta equipes.</h1><p className="page-intro">Entre para acompanhar o que importa em seus projetos.</p><Link className="button google-button" href="/colaborador"><span aria-hidden="true">G</span>Continuar com Google</Link><p className="login-note">A autenticação é simulada neste protótipo.</p></section></main>;
}
