'use client';

import { FormEvent, useState } from 'react';
import { projects } from '../../../data/mock-data';

export default function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const [messages, setMessages] = useState([{ author: 'Nexo', text: 'Como está o projeto hoje?' }, { author: 'Ryan', text: 'Terminei a parte de autenticação, mas ainda estou com dificuldade na integração com o sistema.' }, { author: 'Nexo', text: 'Entendi. Qual é o principal problema na integração?' }]);
  const [text, setText] = useState('');
  const project = projects[0];
  function send(event: FormEvent) { event.preventDefault(); if (!text.trim()) return; setMessages([...messages, { author: 'Ryan', text }]); setText(''); }
  return <main className="content"><p className="eyebrow">Projeto</p><h1>{project.name}</h1><p className="page-intro">Responsável: {project.owner} · {project.status} · Atualizado {project.updatedAt}</p><div className="project-layout"><section className="chat card"><div className="chat-messages">{messages.map((message, index) => <div className={`message ${message.author === 'Ryan' ? 'message-user' : ''}`} key={index}><strong>{message.author}</strong><p>{message.text}</p></div>)}</div><form onSubmit={send}><label className="sr-only" htmlFor="message">Mensagem</label><input id="message" value={text} onChange={(event) => setText(event.target.value)} placeholder="Escreva uma atualização..."/><button className="button">Enviar</button></form></section><aside className="summary card"><h2>Resumo atual</h2><h3>Avanço</h3><p>{project.progress}</p><h3>Dificuldade</h3><p>{project.difficulty}</p><h3>Próximo passo</h3><p>{project.nextStep}</p></aside></div></main>;
}
