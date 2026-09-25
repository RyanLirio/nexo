import { BadRequestException } from '@nestjs/common';
import { UserRole } from './user-role.enum';

/**
 * Domain Model: User
 *
 * Representa um usuário do sistema Nexo. Encapsula a identidade,
 * perfil e papel do usuário na organização/empresa única.
 */
export class User {
  readonly id: string;
  readonly name: string;
  readonly email: string;
  readonly role: UserRole;
  readonly googleSubject: string | null;
  readonly avatarUrl: string | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;

  constructor(props: {
    id: string;
    name: string;
    email: string;
    role?: UserRole;
    googleSubject?: string | null;
    avatarUrl?: string | null;
    createdAt: Date;
    updatedAt: Date;
  }) {
    this.id = props.id;
    this.name = props.name;
    this.email = props.email;
    this.role = props.role ?? UserRole.MEMBER;
    this.googleSubject = props.googleSubject ?? null;
    this.avatarUrl = props.avatarUrl ?? null;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
  }

  /** Retorna o nome de exibição resumido (primeiro nome). */
  get displayName(): string {
    return this.name.split(' ')[0];
  }

  /** Verifica se o usuário tem privilégio de administrador. */
  get isAdmin(): boolean {
    return this.role === UserRole.ADMIN;
  }

  /** Verifica se o usuário tem privilégio de líder. */
  get isLeader(): boolean {
    return this.role === UserRole.LEADER;
  }

  /** Verifica se o usuário é um membro padrão. */
  get isMember(): boolean {
    return this.role === UserRole.MEMBER;
  }

  /**
   * Valida e normaliza o papel do usuário.
   */
  static validateRole(role?: string): UserRole {
    const normalized = (role || 'MEMBER').toUpperCase();
    if (!Object.values(UserRole).includes(normalized as UserRole)) {
      throw new BadRequestException('O papel do usuário deve ser ADMIN, LEADER ou MEMBER.');
    }
    return normalized as UserRole;
  }

  /**
   * Validação de criação de usuário.
   * Garante que nome, email e role são válidos.
   */
  static validateCreate(data: { name?: string; email?: string; role?: string }): {
    name: string;
    email: string;
    role: UserRole;
  } {
    if (!data.name || typeof data.name !== 'string' || !data.name.trim()) {
      throw new BadRequestException('O nome do usuário é obrigatório.');
    }
    if (!data.email || typeof data.email !== 'string' || !data.email.includes('@')) {
      throw new BadRequestException('O email do usuário é obrigatório e deve ser válido.');
    }
    const role = User.validateRole(data.role);
    return { name: data.name.trim(), email: data.email.trim().toLowerCase(), role };
  }
}
