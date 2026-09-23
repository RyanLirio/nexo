import { BadRequestException } from '@nestjs/common';

/**
 * Domain Model: CheckIn
 *
 * Representa um check-in de acompanhamento de um projeto.
 * Registra o progresso, dificuldades e próximos passos.
 */
export class CheckIn {
  readonly id: string;
  readonly projectId: string;
  readonly userId: string;
  readonly summary: string;
  readonly difficulties: string | null;
  readonly nextSteps: string | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;

  constructor(props: {
    id: string;
    projectId: string;
    userId: string;
    summary: string;
    difficulties?: string | null;
    nextSteps?: string | null;
    createdAt: Date;
    updatedAt: Date;
  }) {
    this.id = props.id;
    this.projectId = props.projectId;
    this.userId = props.userId;
    this.summary = props.summary;
    this.difficulties = props.difficulties ?? null;
    this.nextSteps = props.nextSteps ?? null;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
  }

  /** Indica se o check-in reportou dificuldades. */
  get hasDifficulties(): boolean {
    return this.difficulties !== null && this.difficulties.length > 0;
  }

  /**
   * Valida os dados para criação de um check-in.
   */
  static validateCreate(data: {
    summary?: string | null;
    difficulties?: string | null;
    nextSteps?: string | null;
    messageIds?: unknown;
  }): {
    summary: string;
    difficulties: string | null;
    nextSteps: string | null;
    messageIds?: string[];
  } {
    if (!data.summary || typeof data.summary !== 'string' || !data.summary.trim()) {
      throw new BadRequestException('O resumo do check-in é obrigatório.');
    }

    let messageIds: string[] | undefined;
    if (Array.isArray(data.messageIds)) {
      messageIds = data.messageIds.filter((m): m is string => typeof m === 'string' && !!m.trim());
    }

    return {
      summary: data.summary.trim(),
      difficulties: data.difficulties?.trim() || null,
      nextSteps: data.nextSteps?.trim() || null,
      messageIds: messageIds && messageIds.length > 0 ? messageIds : undefined,
    };
  }
}
