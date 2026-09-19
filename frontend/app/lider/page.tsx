import Link from 'next/link';
import { projects } from '../../data/mock-data';

const attentionProjects = projects.filter((project) => project.hasDifficulty);

export default function LeaderPage() {
  return (
    <main className="content dashboard">
      <div className="welcome-row">
        <div><span className="eyebrow"><span className="eyebrow-line" /> Panorama da equipe</span><h1>O contexto, de relance.</h1><p className="page-intro">Veja onde o trabalho avançou e onde uma conversa pode ajudar.</p></div>
        <span className="demo-label"><span className="live-dot" /> Dados de demonstração</span>
      </div>
      <div className="metrics" aria-label="Resumo da equipe">
        <article className="metric-card card"><span>Colaboradores</span><strong>01</strong><small>pessoa acompanhada</small></article>
        <article className="metric-card card"><span>Projetos acompanhados</span><strong>{projects.length.toString().padStart(2, '0')}</strong><small>em diferentes etapas</small></article>
        <article className="metric-card card metric-attention"><span>Dificuldades informadas</span><strong>{attentionProjects.length.toString().padStart(2, '0')}</strong><small>contextos para acompanhar</small></article>
      </div>
      <div className="leader-grid">
        <section className="team card" aria-labelledby="team-title">
          <div className="section-heading"><div><span className="overline">Pessoas e projetos</span><h2 id="team-title">Equipe</h2></div><span className="section-hint">01 colaborador</span></div>
          <div className="team-person"><span className="person-avatar">RL</span><div><strong>Ryan Lirio</strong><span>4 projetos em acompanhamento</span></div><span className="person-dot" aria-label="Ativo" /></div>
          <div className="team-list">
            {projects.map((project) => <Link className="team-project" href={`/projetos/${project.id}`} key={project.id}><span className={`project-icon project-icon-${project.id}`} aria-hidden="true">{project.id === '1' ? '↗' : project.id === '2' ? '✳' : project.id === '3' ? '⟷' : '▤'}</span><span className="team-project-copy"><strong>{project.name}</strong><small>Atualizado {project.updatedAt}</small></span><span className="team-project-status">{project.hasDifficulty ? 'Atenção' : project.status}</span><span className="team-project-arrow" aria-hidden="true">↗</span></Link>)}
          </div>
        </section>
        <aside className="attention-panel card" aria-labelledby="attention-title">
          <span className="overline">Onde apoiar</span><h2 id="attention-title">Pontos de atenção</h2><p>Dificuldades registradas nos projetos acompanhados.</p>
          {attentionProjects.map((project) => <Link className="attention-item" href={`/projetos/${project.id}`} key={project.id}><span className="attention-indicator" /><span><strong>{project.name}</strong><small>{project.difficulty}</small></span><span aria-hidden="true">↗</span></Link>)}
        </aside>
      </div>
    </main>
  );
}
