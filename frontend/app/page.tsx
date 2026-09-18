import Link from 'next/link';

export default function Home() {
  return (
    <main className="content">
      <p className="eyebrow">Nexo</p>
      <h1>Contexto para equipes trabalharem melhor juntas.</h1>
      <p className="page-intro">Um espaço simples para registrar avanços, dificuldades e próximos passos de cada projeto.</p>
      <Link className="button" href="/login">Acessar protótipo</Link>
    </main>
  );
}
