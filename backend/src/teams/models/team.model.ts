import { BadRequestException } from '@nestjs/common';

/**
 * Domain Model: Team
 *
 * Representa uma equipe dentro de uma organização no Nexo.
 * Encapsula regras de validação de dados da equipe.
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

  /**
   * Valida os dados para criação de uma equipe.
   */
  static validateCreate(data: {
    organizationId?: string;
    name?: string;
    description?: string | null;
  }): { organizationId: string; name: string; description: string | null } {
    if (!data.organizationId || typeof data.organizationId !== 'string' || !data.organizationId.trim()) {
      throw new BadRequestException('O campo organizationId é obrigatório.');
    }
    if (!data.name || typeof data.name !== 'string' || !data.name.trim()) {
      throw new BadRequestException('O nome da equipe é obrigatório.');
    }
    if (data.name.trim().length > 160) {
      throw new BadRequestException('O nome da equipe deve ter até 160 caracteres.');
    }
    return {
      organizationId: data.organizationId.trim(),
      name: data.name.trim(),
      description: data.description?.trim() || null,
    };
  }
}
