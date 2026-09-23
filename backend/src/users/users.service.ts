import { Injectable, NotFoundException } from '@nestjs/common';
import { UserRepository, UserRecord, UserProjectRecord } from './user.repository';

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

  async list(search?: string): Promise<UserRecord[]> {
    return this.userRepo.list(search);
  }

  async getById(id: string): Promise<UserRecord> {
    const user = await this.userRepo.findById(id);
    if (!user) {
      throw new NotFoundException('Usuário não encontrado.');
    }
    return user;
  }

  async getProjects(
    userId: string,
    filter?: { relation?: 'member' | 'responsible' | 'leader'; status?: string },
  ): Promise<UserProjectRecord[]> {
    await this.getById(userId);
    return this.userRepo.findUserProjects(userId, filter?.relation, filter?.status);
  }
}
