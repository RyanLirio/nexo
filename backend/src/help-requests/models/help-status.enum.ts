/**
 * Status possíveis de um pedido de ajuda.
 */
export enum HelpStatus {
  OPEN = 'OPEN',
  IN_PROGRESS = 'IN_PROGRESS',
  RESOLVED = 'RESOLVED',
}

/**
 * Transições de status válidas para um HelpRequest.
 * Após RESOLVED, não é possível retornar a nenhum estado anterior.
 */
export const HELP_STATUS_TRANSITIONS: Record<HelpStatus, HelpStatus[]> = {
  [HelpStatus.OPEN]: [HelpStatus.IN_PROGRESS, HelpStatus.RESOLVED],
  [HelpStatus.IN_PROGRESS]: [HelpStatus.RESOLVED],
  [HelpStatus.RESOLVED]: [],
};
