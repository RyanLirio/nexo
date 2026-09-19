import Link from 'next/link';

export default function LoginPage() {
  return (
    <main className="login-page">
      <section className="login-card" aria-labelledby="login-title">
        <div className="login-symbol" aria-hidden="true">✳</div>
        <span className="eyebrow">Bem-vindo ao Nexo</span>
        <h1 id="login-title">Contexto que conecta equipes.</h1>
        <p>Seu espaço para acompanhar projetos e manter todos na mesma página.</p>
        <Link className="button google-button" href="/colaborador"><span className="google-mark" aria-hidden="true">G</span>Continuar com Google <span aria-hidden="true">→</span></Link>
        <div className="login-divider"><span>acesso de demonstração</span></div>
        <Link className="login-leader-link" href="/lider">Explorar a visão do líder <span aria-hidden="true">↗</span></Link>
        <p className="login-note">Este é um protótipo. Nenhuma conta Google será conectada.</p>
      </section>
      <p className="login-footer">Nexo · Programação IV</p>
    </main>
  );
}
