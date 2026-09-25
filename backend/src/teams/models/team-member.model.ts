/**
 * Domain Model: TeamMember
 *
 * Representa a associação de um usuário a uma equipe.
 */
export class TeamMember {
  readonly teamId: string;
  readonly userId: string;
  readonly joinedAt: Date;

  constructor(props: {
    teamId: string;
    userId: string;
    joinedAt: Date;
  }) {
    this.teamId = props.teamId;
    this.userId = props.userId;
    this.joinedAt = props.joinedAt;
  }
}
