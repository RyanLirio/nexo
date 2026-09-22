import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { CheckInRecord, CheckInRepository } from './check-in.repository';
import { fields, optionalText, requiredText } from '../request-fields';

@Injectable()
export class CheckInsService {
  constructor(private readonly checkInRepo: CheckInRepository) {}

  async list(projectId: string): Promise<CheckInRecord[]> {
    const exists = await this.checkInRepo.projectExists(projectId);
    if (!exists) throw new NotFoundException('Projeto não encontrado.');
    return this.checkInRepo.listByProject(projectId);
  }

  async getById(id: string): Promise<CheckInRecord> {
    const checkIn = await this.checkInRepo.findById(id);
    if (!checkIn) throw new NotFoundException('Check-in não encontrado.');
    return checkIn;
  }

  async create(projectId: string, value: unknown, currentUserId?: string): Promise<CheckInRecord> {
    const body = fields(value);
    const userId = optionalText(body, 'userId', 100) || currentUserId;
    if (!userId) {
      throw new BadRequestException('Identificador de usuário ausente no check-in.');
    }

    const summary = requiredText(body, 'summary');
    const difficulties = optionalText(body, 'difficulties');
    const nextSteps = optionalText(body, 'nextSteps');

    let messageIds: string[] | undefined;
    if (Array.isArray(body.messageIds)) {
      messageIds = body.messageIds.filter((m): m is string => typeof m === 'string' && !!m.trim());
    }

    const exists = await this.checkInRepo.projectExists(projectId);
    if (!exists) throw new NotFoundException('Projeto não encontrado.');

    const isMember = await this.checkInRepo.isProjectMember(projectId, userId);
    if (!isMember) {
      throw new ForbiddenException('O usuário informado não participa deste projeto.');
    }

    return this.checkInRepo.create({
      projectId,
      userId,
      summary,
      difficulties,
      nextSteps,
      messageIds,
    });
  }
}
