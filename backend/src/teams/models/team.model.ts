/**
 * Domain Model: Team
 *
 * Representa uma equipe dentro de uma organização no Nexo.
 */
export class Team {
  readonly id: string;
  readonly organizationId: string;
  readonly name: string;
  readonly description: string | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;

  constructor(props: {
    id: string;
    organizationId: string;
    name: string;
    description?: string | null;
    createdAt: Date;
    updatedAt: Date;
  }) {
    this.id = props.id;
    this.organizationId = props.organizationId;
    this.name = props.name;
    this.description = props.description ?? null;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
  }
}
