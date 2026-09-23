import { BadRequestException } from '@nestjs/common';
import { TeamRole } from './team-role.enum';

/**
 * Domain Model: TeamMember
 *
 * Representa a associação de um usuário a uma equipe,
 * incluindo seu papel (MEMBER ou LEADER).
 * Encapsula regras de validação de papel.
 */
export class TeamMember {
  readonly teamId: string;
  readonly userId: string;
  readonly role: TeamRole;
  readonly joinedAt: Date;

  constructor(props: {
    teamId: string;
    userId: string;
    role: TeamRole;
    joinedAt: Date;
  }) {
    this.teamId = props.teamId;
    this.userId = props.userId;
    this.role = props.role;
    this.joinedAt = props.joinedAt;
  }

  /** Verifica se o membro tem papel de líder. */
  get isLeader(): boolean {
    return this.role === TeamRole.LEADER;
  }

  /**
   * Valida e normaliza o papel de um membro.
   * Aceita 'MEMBER' ou 'LEADER', padrão: 'MEMBER'.
   */
  static validateRole(role?: string): TeamRole {
    const normalized = (role || 'MEMBER').toUpperCase();
    if (normalized !== TeamRole.MEMBER && normalized !== TeamRole.LEADER) {
      throw new BadRequestException('O papel do membro deve ser MEMBER ou LEADER.');
    }
    return normalized as TeamRole;
  }
}
