import Link from 'next/link';
import { projects } from '../../data/mock-data';

export default function LeaderPage() {
  return <main className="content"><p className="eyebrow">Área do líder</p><h1>Visão da equipe</h1><p className="page-intro">Contexto recente para apoiar os projetos no momento certo.</p><div className="metrics"><article className="card"><strong>3</strong><span>colaboradores</span></article><article className="card"><strong>7</strong><span>projetos acompanhados</span></article><article className="card"><strong>2</strong><span>com dificuldades registradas</span></article></div><section className="team card"><div className="section-heading"><div><h2>Ryan Lirio</h2><p>4 projetos</p></div></div>{projects.map((project) => <div className="team-project" key={project.id}><div><strong>{project.name}</strong><p>Última atualização: {project.updatedAt}</p></div><div>{project.hasDifficulty && <span className="difficulty">Dificuldade informada</span>}<Link className="button button-secondary" href={`/projetos/${project.id}`}>Ver contexto</Link></div></div>)}</section></main>;
}
