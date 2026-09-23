import { BadRequestException } from '@nestjs/common';

/**
 * Domain Model: User
 *
 * Representa um usuário do sistema Nexo. Encapsula a identidade
 * e os dados de perfil do usuário.
 */
export class User {
  readonly id: string;
  readonly name: string;
  readonly email: string;
  readonly googleSubject: string | null;
  readonly avatarUrl: string | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;

  constructor(props: {
    id: string;
    name: string;
    email: string;
    googleSubject?: string | null;
    avatarUrl?: string | null;
    createdAt: Date;
    updatedAt: Date;
  }) {
    this.id = props.id;
    this.name = props.name;
    this.email = props.email;
    this.googleSubject = props.googleSubject ?? null;
    this.avatarUrl = props.avatarUrl ?? null;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
  }

  /** Retorna o nome de exibição resumido (primeiro nome). */
  get displayName(): string {
    return this.name.split(' ')[0];
  }

  /**
   * Validação de criação de usuário.
   * Garante que nome e email são válidos.
   */
  static validateCreate(data: { name?: string; email?: string }): { name: string; email: string } {
    if (!data.name || typeof data.name !== 'string' || !data.name.trim()) {
      throw new BadRequestException('O nome do usuário é obrigatório.');
    }
    if (!data.email || typeof data.email !== 'string' || !data.email.includes('@')) {
      throw new BadRequestException('O email do usuário é obrigatório e deve ser válido.');
    }
    return { name: data.name.trim(), email: data.email.trim().toLowerCase() };
  }
}
