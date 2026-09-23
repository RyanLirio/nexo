import { ProjectRole } from './project-role.enum';

/**
 * Domain Model: ProjectMember
 *
 * Representa a associação de um usuário a um projeto,
 * incluindo seu papel (OWNER ou MEMBER).
 */
export class ProjectMember {
  readonly projectId: string;
  readonly userId: string;
  readonly role: ProjectRole;
  readonly joinedAt: Date;

  constructor(props: {
    projectId: string;
    userId: string;
    role: ProjectRole;
    joinedAt: Date;
  }) {
    this.projectId = props.projectId;
    this.userId = props.userId;
    this.role = props.role;
    this.joinedAt = props.joinedAt;
  }

  /** Verifica se o membro é o dono (OWNER) do projeto. */
  get isOwner(): boolean {
    return this.role === ProjectRole.OWNER;
  }
}
