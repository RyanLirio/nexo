import { BadRequestException } from '@nestjs/common';
import { HelpStatus, HELP_STATUS_TRANSITIONS } from './help-status.enum';

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

  /**
   * Valida e normaliza o status de um pedido de ajuda.
   */
  static validateStatus(rawStatus?: string): HelpStatus {
    const normalized = (rawStatus || '').trim().toUpperCase();
    if (!Object.values(HelpStatus).includes(normalized as HelpStatus)) {
      throw new BadRequestException('Status deve ser OPEN, IN_PROGRESS ou RESOLVED.');
    }
    return normalized as HelpStatus;
  }

  /**
   * Valida se uma transição de status é permitida pela máquina de estados.
   */
  static validateTransition(currentStatus: HelpStatus, newStatus: HelpStatus): void {
    if (currentStatus === newStatus) return;
    const allowed = HELP_STATUS_TRANSITIONS[currentStatus];
    if (!allowed || !allowed.includes(newStatus)) {
      throw new BadRequestException('Transição de status inválida.');
    }
  }
}
