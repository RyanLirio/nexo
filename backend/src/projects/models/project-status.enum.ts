/**
 * Status possíveis de um projeto.
 */
export enum ProjectStatus {
  PLANNING = 'PLANNING',
  ACTIVE = 'ACTIVE',
  PAUSED = 'PAUSED',
  COMPLETED = 'COMPLETED',
}

/** Lista de todos os status válidos para validação em runtime. */
export const VALID_PROJECT_STATUSES = Object.values(ProjectStatus);
