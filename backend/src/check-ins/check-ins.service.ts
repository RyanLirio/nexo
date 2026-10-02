import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { CheckInRecord, CheckInRepository } from './check-in.repository';
import { CheckIn } from './models';
import { fields, optionalText } from '../request-fields';

@Injectable()
export class CheckInsService {
  constructor(private readonly checkInRepo: CheckInRepository) {}

  async list(
    projectId: string,
    filter?: { userId?: string; startDate?: string | Date; endDate?: string | Date },
  ): Promise<CheckInRecord[]> {
    const exists = await this.checkInRepo.projectExists(projectId);
    if (!exists) throw new NotFoundException('Projeto não encontrado.');

    const parsedFilter = filter
      ? {
          userId: filter.userId,
          startDate: filter.startDate ? new Date(filter.startDate) : undefined,
          endDate: filter.endDate ? new Date(filter.endDate) : undefined,
        }
      : undefined;

    return this.checkInRepo.listByProject(projectId, parsedFilter);
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

    const validated = CheckIn.validateCreate({
      summary: optionalText(body, 'summary'),
      difficulties: optionalText(body, 'difficulties'),
      nextSteps: optionalText(body, 'nextSteps'),
      messageIds: body.messageIds,
    });

    const exists = await this.checkInRepo.projectExists(projectId);
    if (!exists) throw new NotFoundException('Projeto não encontrado.');

    const isMember = await this.checkInRepo.isProjectMember(projectId, userId);
    if (!isMember) {
      throw new ForbiddenException('O usuário informado não participa deste projeto.');
    }

    return this.checkInRepo.create({
      projectId,
      userId,
      summary: validated.summary,
      difficulties: validated.difficulties,
      nextSteps: validated.nextSteps,
      messageIds: validated.messageIds,
    });
  }

  async saveCheckIn(projectId: string, value: unknown, currentUserId?: string): Promise<CheckInRecord> {
    const body = fields(value);
    const userId = optionalText(body, 'userId', 100) || currentUserId;
    if (!userId) {
      throw new BadRequestException('Identificador de usuário ausente no check-in.');
    }

    const exists = await this.checkInRepo.projectExists(projectId);
    if (!exists) throw new NotFoundException('Projeto não encontrado.');

    const isMember = await this.checkInRepo.isProjectMember(projectId, userId);
    if (!isMember) {
      throw new ForbiddenException('O usuário informado não participa deste projeto.');
    }

    const validated = CheckIn.validateCreate({
      summary: optionalText(body, 'summary'),
      difficulties: optionalText(body, 'difficulties'),
      nextSteps: optionalText(body, 'nextSteps'),
      messageIds: body.messageIds,
    });

    const now = new Date();
    const startOfDay = new Date(now);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(startOfDay);
    endOfDay.setDate(endOfDay.getDate() + 1);

    const existing = await this.checkInRepo.findDailyByUserAndProject(userId, projectId, startOfDay, endOfDay);
    if (existing) {
      return this.checkInRepo.updateCheckIn(existing.id, {
        summary: validated.summary,
        difficulties: validated.difficulties,
        nextSteps: validated.nextSteps,
        messageIds: validated.messageIds,
      });
    }

    return this.checkInRepo.create({
      projectId,
      userId,
      summary: validated.summary,
      difficulties: validated.difficulties,
      nextSteps: validated.nextSteps,
      messageIds: validated.messageIds,
    });
  }
}

