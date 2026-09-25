import { BadRequestException } from '@nestjs/common';

/**
 * Domain Model: Team
 *
 * Representa uma equipe no Nexo.
 * Encapsula regras de validação de dados da equipe.
 */
export class Team {
  readonly id: string;
  readonly name: string;
  readonly description: string | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;

  constructor(props: {
    id: string;
    name: string;
    description?: string | null;
    createdAt: Date;
    updatedAt: Date;
  }) {
    this.id = props.id;
    this.name = props.name;
    this.description = props.description ?? null;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
  }

  /**
   * Valida os dados para criação de uma equipe.
   */
  static validateCreate(data: {
    name?: string;
    description?: string | null;
  }): { name: string; description: string | null } {
    if (!data.name || typeof data.name !== 'string' || !data.name.trim()) {
      throw new BadRequestException('O nome da equipe é obrigatório.');
    }
    if (data.name.trim().length > 160) {
      throw new BadRequestException('O nome da equipe deve ter até 160 caracteres.');
    }
    return {
      name: data.name.trim(),
      description: data.description?.trim() || null,
    };
  }
}
