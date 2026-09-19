import Link from 'next/link';
import { projects } from '../../data/mock-data';

const difficultyCount = projects.filter((project) => project.hasDifficulty).length;

export default function CollaboratorPage() {
  return (
    <main id="main-content" tabIndex={-1} className="content dashboard">
      <div className="welcome-row">
        <div>
          <span className="eyebrow"><span className="eyebrow-line" /> Seu espaço de trabalho</span>
          <h1>Bom te ver, Ryan <span aria-hidden="true">✳</span></h1>
          <p className="page-intro">Tudo que você precisa para retomar o trabalho, em um só lugar.</p>
        </div>
        <span className="demo-label"><span className="live-dot" /> Ambiente de demonstração</span>
      </div>

      <section className="projects-section" aria-labelledby="projects-title">
        <div className="section-heading">
          <div><span className="overline">Continue de onde parou</span><h2 id="projects-title">Meus projetos <span>{projects.length}</span></h2></div>
          <span className="section-hint">{difficultyCount} com dificuldade informada</span>
        </div>
        <div className="project-grid">
          {projects.map((project) => (
            <article className="project-card card" key={project.id}>
              <div className="project-card-top"><span className={`project-icon project-icon-${project.id}`} aria-hidden="true">{project.id === '1' ? '↗' : project.id === '2' ? '✳' : project.id === '3' ? '⟷' : '▤'}</span><span className="status">{project.status}</span></div>
              <h3>{project.name}</h3>
              <p>{project.progress}</p>
              {project.hasDifficulty && <p className="difficulty-note"><strong>Dificuldade informada:</strong> {project.difficulty}</p>}
              <div className="project-card-footer"><span>Atualizado {project.updatedAt}</span><Link href={`/projetos/${project.id}`} aria-label={`Abrir ${project.name}`}>Abrir projeto <span aria-hidden="true">↗</span></Link></div>
            </article>
          ))}
        </div>
      </section>

      <section className="overview-banner" aria-label="Resumo dos projetos">
        <div className="overview-copy">
          <span className="overline">Seu contexto</span>
          <h2>Retome uma conversa.</h2>
          <p>Conte o que avançou e deixe os próximos passos claros para sua equipe.</p>
          <Link href="/projetos/1">Continuar última conversa <span aria-hidden="true">↗</span></Link>
        </div>
        <div className="overview-stats">
          <div><strong>{projects.length.toString().padStart(2, '0')}</strong><span>projetos</span></div>
          <div><strong>{difficultyCount.toString().padStart(2, '0')}</strong><span>com dificuldade</span></div>
        </div>
        <span className="overview-ornament" aria-hidden="true">✳</span>
      </section>

      <section className="help-card card">
        <span className="help-icon" aria-hidden="true">?</span>
        <div><span className="overline">Conhecimento compartilhado</span><h2>Um problema não precisa parar tudo.</h2><p>Em breve, soluções técnicas da equipe estarão disponíveis aqui.</p></div>
        <span className="soon-tag">Em breve</span>
      </section>
    </main>
  );
}
