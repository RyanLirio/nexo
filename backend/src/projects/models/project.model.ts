import { BadRequestException } from '@nestjs/common';
import { ProjectStatus, VALID_PROJECT_STATUSES } from './project-status.enum';

/**
 * Domain Model: Project
 *
 * Representa um projeto acadêmico vinculado a uma equipe.
 * Encapsula status, liderança, responsável e timestamps.
 * Contém regras de domínio para validação de líder, membros e transições de status.
 */
export class Project {
  readonly id: string;
  readonly name: string;
  readonly description: string | null;
  readonly status: ProjectStatus;
  readonly teamId: string;
  readonly leaderId: string | null;
  readonly responsibleUserId: string | null;
  readonly createdBy: string | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;

  constructor(props: {
    id: string;
    name: string;
    description?: string | null;
    status: ProjectStatus;
    teamId: string;
    leaderId?: string | null;
    responsibleUserId?: string | null;
    createdBy?: string | null;
    createdAt: Date;
    updatedAt: Date;
  }) {
    this.id = props.id;
    this.name = props.name;
    this.description = props.description ?? null;
    this.status = props.status;
    this.teamId = props.teamId;
    this.leaderId = props.leaderId ?? null;
    this.responsibleUserId = props.responsibleUserId ?? null;
    this.createdBy = props.createdBy ?? null;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
  }

  /** Verifica se o projeto está em um estado ativo (não concluído). */
  get isActive(): boolean {
    return this.status !== ProjectStatus.COMPLETED;
  }

  /** Verifica se o projeto já foi finalizado. */
  get isCompleted(): boolean {
    return this.status === ProjectStatus.COMPLETED;
  }

  /**
   * Valida se um status é válido para transição.
   * Lança BadRequestException se o status não está na lista de valores aceitos.
   */
  static validateStatus(status: string): ProjectStatus {
    const normalized = status.toUpperCase();
    if (!(VALID_PROJECT_STATUSES as string[]).includes(normalized)) {
      throw new BadRequestException(
        `Status inválido. Valores aceitos: ${VALID_PROJECT_STATUSES.join(', ')}.`,
      );
    }
    return normalized as ProjectStatus;
  }

  /**
   * Valida que o líder indicado pertence à equipe e possui papel LEADER ou ADMIN.
   * Recebe o membro encontrado no repositório.
   */
  static validateLeader(member: { userId: string; role: string } | null): void {
    if (!member) {
      throw new BadRequestException('O líder deve pertencer à mesma equipe do projeto.');
    }
    const role = (member.role || '').toUpperCase();
    if (role !== 'LEADER' && role !== 'ADMIN') {
      throw new BadRequestException('Apenas membros com papel LEADER ou ADMIN podem liderar o projeto.');
    }
  }

  /**
   * Valida que o responsável pertence à mesma equipe.
   */
  static validateResponsible(member: { userId: string; role: string } | null): void {
    if (!member) {
      throw new BadRequestException('O responsável deve pertencer à mesma equipe do projeto.');
    }
  }

  /**
   * Monta a lista de membros iniciais do projeto a partir do líder e responsável.
   */
  static buildInitialMembers(
    leaderId?: string | null,
    responsibleUserId?: string | null,
  ): { userId: string; role: 'OWNER' | 'MEMBER' }[] {
    const members: { userId: string; role: 'OWNER' | 'MEMBER' }[] = [];
    if (leaderId) {
      members.push({ userId: leaderId, role: 'OWNER' });
    }
    if (responsibleUserId && responsibleUserId !== leaderId) {
      members.push({ userId: responsibleUserId, role: 'MEMBER' });
    }
    return members;
  }

  /**
   * Valida o papel de um membro de projeto.
   */
  static validateMemberRole(role?: string): 'OWNER' | 'MEMBER' {
    const normalized = (role || 'MEMBER').toUpperCase();
    if (normalized !== 'MEMBER' && normalized !== 'OWNER') {
      throw new BadRequestException('O papel do membro no projeto deve ser MEMBER ou OWNER.');
    }
    return normalized as 'OWNER' | 'MEMBER';
  }
}
