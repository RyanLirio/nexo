'use client';

import Link from 'next/link';
import { FormEvent, use, useState } from 'react';
import { projects } from '../../../data/mock-data';

type Message = { author: 'Nexo' | 'Ryan'; text: string };

export default function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const project = projects.find((item) => item.id === id);
  const [messages, setMessages] = useState<Message[]>([
    { author: 'Nexo', text: 'Como está o projeto hoje? Conte o que avançou, se surgiu alguma dificuldade e o que vem a seguir.' },
    { author: 'Ryan', text: 'Avancei na implementação, mas ainda preciso resolver um ponto da integração.' },
    { author: 'Nexo', text: 'Entendi. Qual é o principal obstáculo agora?' },
  ]);
  const [text, setText] = useState('');

  function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const message = text.trim();
    if (!message) return;
    setMessages((current) => [...current, { author: 'Ryan', text: message }]);
    setText('');
  }

  if (!project) return <main className="content"><h1>Projeto não encontrado</h1><Link className="text-link" href="/colaborador">Voltar aos projetos →</Link></main>;

  return (
    <main className="content project-page">
      <Link className="back-link" href="/colaborador">← Meus projetos</Link>
      <div className="project-heading"><div><span className="eyebrow"><span className="eyebrow-line" /> Espaço do projeto</span><h1>{project.name}</h1><p>Um lugar para registrar o que importa e manter a equipe em sintonia.</p></div><span className={`status ${project.hasDifficulty ? 'status-attention' : ''}`}>{project.status}</span></div>
      <div className="project-meta"><span><span className="meta-avatar">RL</span> {project.owner}</span><span>Última atualização · {project.updatedAt}</span><span className="demo-label"><span className="live-dot" /> Demonstração</span></div>
      <div className="project-layout">
        <section className="chat card" aria-labelledby="conversation-title">
          <div className="panel-heading"><div><span className="chat-symbol" aria-hidden="true">✳</span><span><strong id="conversation-title">Conversa com o Nexo</strong><small>Check-in do projeto</small></span></div><span className="panel-badge">Conversa local</span></div>
          <div className="chat-messages" aria-live="polite">{messages.map((message, index) => <div className={`message-row ${message.author === 'Ryan' ? 'message-row-user' : ''}`} key={index}><span className={`message-avatar ${message.author === 'Ryan' ? 'message-avatar-user' : ''}`} aria-hidden="true">{message.author === 'Ryan' ? 'R' : '✳'}</span><div className="message"><strong>{message.author}</strong><p>{message.text}</p></div></div>)}</div>
          <form className="chat-form" onSubmit={send}><label className="sr-only" htmlFor="message">Sua mensagem</label><input id="message" value={text} onChange={(event) => setText(event.target.value)} placeholder="Conte como está o projeto..." /><button className="button" type="submit" disabled={!text.trim()} aria-label="Enviar mensagem">Enviar <span aria-hidden="true">↗</span></button></form><p className="chat-note">As mensagens aparecem apenas nesta sessão de demonstração.</p>
        </section>
        <aside className="summary card" aria-labelledby="summary-title"><span className="overline">Contexto em foco</span><h2 id="summary-title">Resumo atual</h2><p className="summary-intro">O essencial para retomar esta conversa.</p><div className="summary-item"><span className="summary-marker summary-marker-green" /><div><h3>Avanço</h3><p>{project.progress}</p></div></div><div className="summary-item"><span className="summary-marker summary-marker-orange" /><div><h3>Dificuldade</h3><p>{project.difficulty}</p></div></div><div className="summary-item"><span className="summary-marker summary-marker-blue" /><div><h3>Próximo passo</h3><p>{project.nextStep}</p></div></div><div className="summary-foot">Resumo de demonstração · não muda com a conversa</div></aside>
      </div>
    </main>
  );
}
