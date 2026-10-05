'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { AuthSession, readAuthSession } from '../lib/auth-session';
import { contextDate, getProjectData, ProjectContext, projectStatus } from '../lib/project-context';

export default function ProjectOverview({ leader = false }: { leader?: boolean }) {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [projects, setProjects] = useState<ProjectContext[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    const currentSession = readAuthSession();
    setSession(currentSession);
    if (!currentSession || (leader && currentSession.user.role === 'MEMBER')) { setLoading(false); return; }
    setLoading(true); setError(null);
    getProjectData<ProjectContext[]>('/projects', controller.signal)
      .then(data => { if (!controller.signal.aborted) setProjects(data); })
      .catch(() => { if (!controller.signal.aborted) setError('Não foi possível carregar seus projetos. Tente novamente.'); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [leader, revision]);

  return <main id="main-content" tabIndex={-1} className="content dashboard">
    <header className="welcome-row"><div>
      <span className="eyebrow"><span className="eyebrow-line" /> {leader ? 'Contexto da equipe' : 'Seu espaço de trabalho'}</span>
      <h1>{leader ? 'Projetos da equipe' : `Olá, ${session?.user.name.split(' ')[0] ?? 'boas-vindas'}.`}</h1>
      <p>{leader ? 'Consulte as atualizações e o conhecimento dos projetos aos quais você tem acesso.' : 'Compartilhe seu trabalho com o Nexo e acompanhe o contexto dos projetos.'}</p>
    </div><Link className="button" href="/colaborador/conversa">Conversar com o Nexo <span aria-hidden="true">↗</span></Link></header>
    <section className="projects-section" aria-labelledby="projects-title">
      <div className="section-heading"><h2 id="projects-title">Projetos acessíveis</h2><button className="text-link" onClick={() => setRevision(value => value + 1)} disabled={loading}>Atualizar</button></div>
      {loading && <p role="status">Carregando projetos…</p>}
      {error && <p className="conversation-error" role="alert">{error}</p>}
      {!loading && !error && projects.length === 0 && <div className="card context-card"><p>Nenhum projeto disponível para sua conta neste momento.</p></div>}
      {!loading && !error && <div className="project-grid">{projects.map((project, index) => <article key={project.id} className="card project-card">
        <div className="project-card-top"><span className={`project-icon project-icon-${index % 4 + 1}`} aria-hidden="true">↗</span><span className="status">{projectStatus(project.status)}</span></div>
        <h3>{project.name}</h3><p>{project.description || 'Sem descrição registrada.'}</p>
        <dl className="project-facts">
          <div><dt>Equipe</dt><dd>{project.team?.name ?? 'Não informada'}</dd></div>
          <div><dt>Líder</dt><dd>{project.leader?.name ?? 'Não informado'}</dd></div>
          <div><dt>Responsável</dt><dd>{project.responsibleUser?.name ?? 'Não informado'}</dd></div>
          <div><dt>Membros</dt><dd>{project._count?.members ?? project.members?.length ?? 'Não informado'}</dd></div>
          <div><dt>Prioridade</dt><dd>{project.priority ?? 'Não informada'}</dd></div>
          <div><dt>Previsão</dt><dd>{contextDate(project.estimatedCompletionAt)}</dd></div>
        </dl>
        <div className="project-card-footer"><Link href={`/projetos/${encodeURIComponent(project.id)}`}>Ver contexto do projeto <span aria-hidden="true">↗</span></Link></div>
      </article>)}</div>}
    </section>
  </main>;
}
