import { BadRequestException, ForbiddenException } from '@nestjs/common';

/**
 * Domain Model: TechnicalProblem
 *
 * Representa um problema técnico identificado em check-ins
 * ou pedidos de ajuda, sujeito a autorização de compartilhamento.
 */
export class TechnicalProblem {
  readonly id: string;
  readonly projectId: string;
  readonly authorId: string;
  readonly title: string;
  readonly problem: string;
  readonly problemEmbedding: number[] | null;
  readonly technology: string | null;
  readonly solution: string | null;
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
    problemEmbedding?: number[] | null;
    technology?: string | null;
    solution?: string | null;
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
    this.problemEmbedding = props.problemEmbedding ?? null;
    this.technology = props.technology ?? null;
    this.solution = props.solution ?? null;
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

  /**
   * Valida a regra de origem única do problema técnico.
   * Não é permitido ter sourceCheckInId e sourceHelpRequestId simultâneos.
   */
  static validateSources(sourceCheckInId?: string | null, sourceHelpRequestId?: string | null): void {
    if (sourceCheckInId && sourceHelpRequestId) {
      throw new BadRequestException('Um problema técnico não pode ter duas origens simultâneas.');
    }
  }

  /**
   * Valida a autorização de compartilhamento.
   * Somente o autor original pode autorizar o compartilhamento.
   * Retorna true se a autorização precisa ser gravada, ou false se já está autorizada.
   */
  static validateAuthorization(
    entry: { authorId: string; sharingAuthorizedAt?: Date | null; sharingAuthorizedBy?: string | null },
    authorId: string,
  ): boolean {
    if (entry.authorId !== authorId) {
      throw new ForbiddenException('Somente o autor informado pode autorizar.');
    }
    if (entry.sharingAuthorizedAt && entry.sharingAuthorizedBy) {
      return false;
    }
    return true;
  }
}
