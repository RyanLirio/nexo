import { TeamRole } from './team-role.enum';

/**
 * Domain Model: TeamMember
 *
 * Representa a associação de um usuário a uma equipe,
 * incluindo seu papel (MEMBER ou LEADER).
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
}
