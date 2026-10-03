'use client';

import Link from 'next/link';
import { use, useEffect, useState } from 'react';
import { readAuthSession } from '../../../lib/auth-session';
import { CheckInContext, contextDate, getProjectData, ProjectContext, projectStatus, TechnicalProblemContext } from '../../../lib/project-context';

function CheckInDetails({ checkIn }: { checkIn: CheckInContext }) {
  return <><time dateTime={checkIn.updatedAt}>{contextDate(checkIn.updatedAt, true)}</time><dl className="check-in-fields">
    <div><dt>Contexto / avanços</dt><dd>{checkIn.summary}</dd></div>
    <div><dt>Dificuldades</dt><dd>{checkIn.difficulties || 'Nenhuma dificuldade relatada.'}</dd></div>
    <div><dt>Próximos passos</dt><dd>{checkIn.nextSteps || 'Nenhum próximo passo informado.'}</dd></div>
  </dl></>;
}

export default function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [project, setProject] = useState<ProjectContext | null>(null);
  const [history, setHistory] = useState<CheckInContext[]>([]);
  const [problems, setProblems] = useState<TechnicalProblemContext[]>([]);
  const [isLeader, setIsLeader] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  const [historyUser, setHistoryUser] = useState('');
  useEffect(() => {
    const controller = new AbortController();
    const session = readAuthSession();
    const leader = session?.user.role === 'ADMIN' || session?.user.role === 'LEADER';
    setIsLeader(leader);
    setProject(null); setHistory([]); setProblems([]); setError(null); setLoading(true);
    const path = `/projects/${encodeURIComponent(id)}`;
    Promise.all([
      getProjectData<ProjectContext>(`${path}${leader ? '/leader-view' : ''}`, controller.signal),
      getProjectData<CheckInContext[]>(`${path}/check-ins`, controller.signal),
      getProjectData<TechnicalProblemContext[]>(`/technical-problems?projectId=${encodeURIComponent(id)}`, controller.signal),
    ]).then(([projectData, checkIns, technicalProblems]) => {
      setProject(projectData); setHistory(checkIns); setProblems(technicalProblems);
    }).catch(cause => {
      if (!controller.signal.aborted) setError(cause instanceof TypeError ? 'Não foi possível conectar ao Nexo. Tente novamente.' : cause instanceof Error ? cause.message : 'Não foi possível carregar este projeto.');
    }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [id, revision]);

  const openProblems = new Map<string, TechnicalProblemContext>();
  for (const problem of [...(project?.openTechnicalProblems ?? project?.technicalProblems ?? []), ...problems]) {
    if (!problem.solution?.trim()) openProblems.set(problem.id, problem);
  }
  const resolved = problems.filter(problem => problem.sharingAuthorizedAt && problem.solution?.trim());
  return <main id="main-content" tabIndex={-1} className="content project-page">
    <Link className="back-link" href={isLeader ? '/lider' : '/colaborador'}>← Voltar aos projetos</Link>
    {loading && <p role="status">Carregando contexto do projeto…</p>}
    {error && <div className="card context-card"><p role="alert">{error}</p><button className="button" onClick={() => setRevision(value => value + 1)}>Tentar novamente</button></div>}
    {project && !loading && <>
      <header className="project-heading"><div><span className="eyebrow">{project.team?.name ?? 'Projeto'}</span><h1>{project.name}</h1><p>{project.description || 'Sem descrição registrada.'}</p></div><span className="status">{projectStatus(project.status)}</span></header>
      <div className="project-meta"><span>Prioridade: {project.priority ?? 'não informada'}</span><span>Previsão: {contextDate(project.estimatedCompletionAt)}</span><span>Líder: {project.leader?.name ?? 'não informado'}</span><span>Responsável: {project.responsibleUser?.name ?? 'não informado'}</span></div>
      <div className="section-heading"><h2>Atualizações da equipe</h2><button className="text-link" onClick={() => setRevision(value => value + 1)}>Atualizar contexto</button></div>
      <p className="context-muted">As atualizações refletem o que foi relatado nas conversas, sem avaliação de produtividade.</p>
      <section className="context-grid" aria-label="Último CheckIn por membro">
        {(project.members ?? []).map(member => {
          const checkIn = member.latestCheckIn ?? member.user?.checkIns?.[0] ?? history.find(item => item.userId === member.userId);
          const today = checkIn && new Date(checkIn.createdAt).toDateString() === new Date().toDateString();
          return <article className="card context-card" key={member.userId}><h3>{member.user?.name ?? 'Membro'}</h3>
            {!today && <p className="context-muted">Sem atualização registrada hoje.</p>}
            {checkIn ? <><p className="overline">{today ? 'Atualização de hoje' : 'Última atualização registrada'}</p><CheckInDetails checkIn={checkIn} /></> : <p className="context-muted">Nenhum CheckIn registrado.</p>}
          </article>;
        })}
        {!project.members?.length && <p>Nenhum membro registrado neste projeto.</p>}
      </section>
      <section className="context-section" aria-labelledby="history-title"><h2 id="history-title">Histórico recente</h2><p className="context-muted">Até 50 atualizações mais recentes, em ordem de registro.</p>
        <label className="history-filter">Membro <select value={historyUser} onChange={event => setHistoryUser(event.target.value)}><option value="">Todos</option>{(project.members ?? []).map(member => <option key={member.userId} value={member.userId}>{member.user?.name ?? 'Membro'}</option>)}</select></label>
        {history.filter(item => !historyUser || item.userId === historyUser).map(checkIn => <details className="card context-card history-entry" key={checkIn.id}><summary>{checkIn.user?.name ?? 'Atualização'} · {contextDate(checkIn.createdAt, true)}</summary><CheckInDetails checkIn={checkIn} /></details>)}
        {!history.filter(item => !historyUser || item.userId === historyUser).length && <p>Nenhuma atualização registrada para este filtro.</p>}
      </section>
      <section className="context-section" aria-labelledby="problems-title"><h2 id="problems-title">Problemas técnicos</h2><p className="context-muted">Problemas em aberto e soluções com compartilhamento autorizado.</p><div className="context-grid">
        {[...openProblems.values(), ...resolved].map(problem => <article className="card context-card" key={problem.id}><span className="status">{problem.solution?.trim() ? 'Resolvido' : 'Aberto'}</span><h3>{problem.title}</h3><p className="context-muted">{problem.technology || 'Tecnologia não informada'}</p><p>{problem.problem}</p>{problem.sharingAuthorizedAt && problem.solution?.trim() && <details><summary>Ver solução compartilhada</summary><p>{problem.solution}</p></details>}</article>)}
      </div>{!openProblems.size && !resolved.length && <p>Nenhum problema técnico disponível nesta visão.</p>}</section>
      <section className="card context-card context-section"><h2>Continue a conversa</h2><p>A conversa com o Nexo é geral: você pode mencionar mais de um projeto na mesma mensagem.</p><Link className="button" href="/colaborador/conversa">Conversar com o Nexo ↗</Link></section>
    </>}
  </main>;
}
