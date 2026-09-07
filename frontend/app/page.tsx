export default function Home() {
  return (
    <div className="page">
      <header><span className="brand">nexo<span aria-hidden="true">↗</span></span><span>Projeto acadêmico · UNOESC</span></header>
      <main>
        <p className="eyebrow">Pessoas, conhecimento e conexões</p>
        <h1>Inteligência de colaboração para equipes remotas.</h1>
        <p className="intro">O Nexo propõe transformar conversas sobre o trabalho em conhecimento compartilhado e aproximar quem precisa de ajuda de quem pode colaborar.</p>
        <section aria-labelledby="proposal">
          <h2 id="proposal">O que queremos construir</h2>
          <ol>
            <li><span>01</span><h3>Conversar</h3><p>Registrar avanços, dificuldades e próximos passos em um check-in.</p></li>
            <li><span>02</span><h3>Compartilhar</h3><p>Guardar soluções técnicas com a autorização de quem contribuiu.</p></li>
            <li><span>03</span><h3>Conectar</h3><p>Encontrar conhecimento e colegas que possam ajudar.</p></li>
          </ol>
        </section>
        <p className="status">Estamos no kickoff estrutural. As funcionalidades serão desenvolvidas nas próximas etapas.</p>
      </main>
      <footer>Nexo · Programação IV · Ciência da Computação</footer>
    </div>
  );
}
