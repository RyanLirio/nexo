import { ProjectStatus } from './project-status.enum';

/**
 * Domain Model: Project
 *
 * Representa um projeto acadêmico vinculado a uma equipe.
 * Encapsula status, liderança, responsável e timestamps.
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
}
