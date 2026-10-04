import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { User, UserRole } from './models';
import { ListUsersParams, UserProjectRecord, UserRecord, UserRepository } from './user.repository';

@Injectable()
export class UsersService {
  constructor(private readonly userRepo: UserRepository) {}

  async getMe(userId: string): Promise<UserRecord> {
    const user = await this.userRepo.findById(userId);
    if (!user) {
      throw new NotFoundException('Usuário autenticado não encontrado.');
    }
    return user;
  }

  async getMeProjects(
    userId: string,
    filter?: { relation?: 'member' | 'responsible' | 'leader'; status?: string },
  ): Promise<UserProjectRecord[]> {
    await this.getMe(userId);
    return this.userRepo.findUserProjects(userId, filter?.relation, filter?.status);
  }

  async list(params?: ListUsersParams | string): Promise<UserRecord[]> {
    return this.userRepo.list(params);
  }

  async getById(id: string): Promise<UserRecord> {
    const user = await this.userRepo.findById(id);
    if (!user) {
      throw new NotFoundException('Usuário não encontrado.');
    }
    return user;
  }

  async create(data: { name?: string; email?: string; role?: string }): Promise<UserRecord> {
    const validated = User.validateCreate(data);

    const existing = await this.userRepo.findByEmail(validated.email);
    if (existing) {
      throw new ConflictException('Já existe um usuário cadastrado com este e-mail.');
    }

    return this.userRepo.create(validated);
  }

  async update(
    id: string,
    data: { name?: string; role?: string; isActive?: boolean },
    requestingUserId?: string,
  ): Promise<UserRecord> {
    const user = await this.getById(id);

    const updatePayload: { name?: string; role?: string; isActive?: boolean } = {};

    if (data.name !== undefined) {
      if (typeof data.name !== 'string' || !data.name.trim()) {
        throw new BadRequestException('O nome do usuário não pode ser vazio.');
      }
      updatePayload.name = data.name.trim();
    }

    let nextRole: UserRole | undefined;
    if (data.role !== undefined) {
      nextRole = User.validateRole(data.role);
      updatePayload.role = nextRole;
    }

    if (data.isActive !== undefined) {
      updatePayload.isActive = Boolean(data.isActive);
    }

    // Validação de segurança para proteger o último administrador ativo
    const isLosingAdminRole =
      user.role === UserRole.ADMIN &&
      ((nextRole && nextRole !== UserRole.ADMIN) || updatePayload.isActive === false);

    if (isLosingAdminRole) {
      const activeAdminsCount = await this.userRepo.countActiveAdmins();
      if (activeAdminsCount <= 1) {
        throw new BadRequestException(
          'Não é possível desativar ou remover privilégios do único administrador ativo do sistema.',
        );
      }
    }

    return this.userRepo.update(id, updatePayload);
  }

  async getProjects(
    userId: string,
    filter?: { relation?: 'member' | 'responsible' | 'leader'; status?: string },
  ): Promise<UserProjectRecord[]> {
    await this.getById(userId);
    return this.userRepo.findUserProjects(userId, filter?.relation, filter?.status);
  }
}
