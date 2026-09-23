import { HelpStatus } from './help-status.enum';

/**
 * Domain Model: HelpRequest
 *
 * Representa um pedido de ajuda vinculado a um projeto.
 * Possui um ciclo de vida OPEN → IN_PROGRESS → RESOLVED.
 */
export class HelpRequest {
  readonly id: string;
  readonly projectId: string;
  readonly requesterId: string;
  readonly helperId: string | null;
  readonly problem: string;
  readonly status: HelpStatus;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly resolvedAt: Date | null;

  constructor(props: {
    id: string;
    projectId: string;
    requesterId: string;
    helperId?: string | null;
    problem: string;
    status: HelpStatus;
    createdAt: Date;
    updatedAt: Date;
    resolvedAt?: Date | null;
  }) {
    this.id = props.id;
    this.projectId = props.projectId;
    this.requesterId = props.requesterId;
    this.helperId = props.helperId ?? null;
    this.problem = props.problem;
    this.status = props.status;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
    this.resolvedAt = props.resolvedAt ?? null;
  }

  /** Verifica se o pedido já foi resolvido. */
  get isResolved(): boolean {
    return this.status === HelpStatus.RESOLVED;
  }

  /** Verifica se o pedido ainda está aberto. */
  get isOpen(): boolean {
    return this.status === HelpStatus.OPEN;
  }
}
