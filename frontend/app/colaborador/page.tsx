import Link from 'next/link';
import { projects } from '../../data/mock-data';

export default function CollaboratorPage() {
  return <main className="content"><p className="eyebrow">Área do colaborador</p><h1>Olá, Ryan</h1><p className="page-intro">Acompanhe seus projetos e mantenha o contexto atualizado.</p><section><div className="section-heading"><h2>Meus projetos</h2><Link href="/lider">Ver visão do líder</Link></div><div className="project-grid">{projects.map((project) => <article className="project-card card" key={project.id}><div><span className="status">{project.status}</span>{project.hasDifficulty && <span className="difficulty">Dificuldade registrada</span>}</div><h3>{project.name}</h3><p>Última atualização: {project.updatedAt}</p><Link className="button button-secondary" href={`/projetos/${project.id}`}>Abrir projeto</Link></article>)}</div></section><section className="help-card card"><div><h2>Precisa de ajuda com algum problema?</h2><p>Em breve você poderá encontrar soluções técnicas registradas pela equipe.</p></div><button className="button button-secondary">Buscar uma solução</button></section></main>;
}
