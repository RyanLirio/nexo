/**
 * Domain Model: KnowledgeEntry
 *
 * Representa uma entrada de conhecimento extraída de check-ins
 * ou pedidos de ajuda, sujeita a autorização de compartilhamento.
 */
export class KnowledgeEntry {
  readonly id: string;
  readonly projectId: string;
  readonly authorId: string;
  readonly title: string;
  readonly problem: string;
  readonly technology: string | null;
  readonly solution: string;
  readonly sharingAuthorizedBy: string | null;
  readonly sharingAuthorizedAt: Date | null;
  readonly sourceCheckInId: string | null;
  readonly sourceHelpRequestId: string | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;

  constructor(props: {
    id: string;
    projectId: string;
    authorId: string;
    title: string;
    problem: string;
    technology?: string | null;
    solution: string;
    sharingAuthorizedBy?: string | null;
    sharingAuthorizedAt?: Date | null;
    sourceCheckInId?: string | null;
    sourceHelpRequestId?: string | null;
    createdAt: Date;
    updatedAt: Date;
  }) {
    this.id = props.id;
    this.projectId = props.projectId;
    this.authorId = props.authorId;
    this.title = props.title;
    this.problem = props.problem;
    this.technology = props.technology ?? null;
    this.solution = props.solution;
    this.sharingAuthorizedBy = props.sharingAuthorizedBy ?? null;
    this.sharingAuthorizedAt = props.sharingAuthorizedAt ?? null;
    this.sourceCheckInId = props.sourceCheckInId ?? null;
    this.sourceHelpRequestId = props.sourceHelpRequestId ?? null;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
  }

  /** Verifica se o compartilhamento foi autorizado. */
  get isAuthorized(): boolean {
    return this.sharingAuthorizedAt !== null;
  }

  /** Verifica se a entrada tem duas origens simultaneamente (inválido). */
  get hasDualSource(): boolean {
    return this.sourceCheckInId !== null && this.sourceHelpRequestId !== null;
  }
}
