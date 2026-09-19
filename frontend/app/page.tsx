import Link from 'next/link';

export default function Home() {
  return (
    <main id="main-content" tabIndex={-1} className="landing content">
      <div className="landing-copy">
        <span className="eyebrow"><span className="eyebrow-line" /> Seu trabalho, em contexto</span>
        <h1>Menos tempo tentando entender. <em>Mais tempo avançando.</em></h1>
        <p>Projetos, atualizações e dificuldades em um só lugar. Para que cada pessoa saiba onde o trabalho está e qual é o próximo passo.</p>
        <div className="landing-actions">
          <Link className="button" href="/login">Explorar o Nexo <span aria-hidden="true">↗</span></Link>
          <Link className="text-link" href="/colaborador">Ver painel de exemplo <span aria-hidden="true">→</span></Link>
        </div>
        <div className="landing-note"><span className="live-dot" /> Protótipo interativo com dados de demonstração</div>
      </div>
      <div className="landing-preview" aria-label="Prévia do painel de projetos">
        <div className="preview-top"><span className="preview-logo">✳</span><span>Visão de hoje</span><span>•••</span></div>
        <div className="preview-heading">O trabalho segue melhor<br />quando o contexto circula.</div>
        <div className="preview-card"><span className="preview-icon preview-icon-blue">↗</span><span><strong>Conciliação Financeira</strong><small>Avanço registrado hoje</small></span><span className="preview-arrow">→</span></div>
        <div className="preview-card"><span className="preview-icon preview-icon-orange">!</span><span><strong>Integração de Pedidos</strong><small>Dificuldade para acompanhar</small></span><span className="preview-arrow">→</span></div>
        <div className="preview-bottom"><span className="live-dot" /> Contexto sempre à mão</div>
      </div>
    </main>
  );
}
