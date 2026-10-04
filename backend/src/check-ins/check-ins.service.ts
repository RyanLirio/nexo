import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { CheckInRecord, CheckInRepository } from './check-in.repository';
import { CheckIn } from './models';
import { fields, optionalText } from '../request-fields';

@Injectable()
export class CheckInsService {
  constructor(private readonly checkInRepo: CheckInRepository) {}

  private resolveUser(body: Record<string, unknown>, currentUserId?: string): string {
    const requestedId = optionalText(body, 'userId', 100);
    if (currentUserId && requestedId && requestedId !== currentUserId) {
      throw new ForbiddenException('O check-in deve pertencer ao usuário autenticado.');
    }
    const userId = currentUserId || requestedId;
    if (!userId) throw new BadRequestException('Identificador de usuário ausente no check-in.');
    return userId;
  }

  private async validateMessageOwnership(messageIds: string[] | undefined, userId: string, authenticated: boolean) {
    if (authenticated && messageIds?.length && !(await this.checkInRepo.messagesBelongToUser(messageIds, userId))) {
      throw new ForbiddenException('As mensagens devem pertencer à conversa do usuário autenticado.');
    }
  }

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

    if (parsedFilter && (Object.values(parsedFilter).some(value => value instanceof Date && Number.isNaN(value.getTime()))
      || (parsedFilter.startDate && parsedFilter.endDate && parsedFilter.startDate > parsedFilter.endDate))) {
      throw new BadRequestException('Informe um intervalo de datas válido.');
    }

    return this.checkInRepo.listByProject(projectId, parsedFilter);
  }


  async getById(id: string): Promise<CheckInRecord> {
    const checkIn = await this.checkInRepo.findById(id);
    if (!checkIn) throw new NotFoundException('Check-in não encontrado.');
    return checkIn;
  }

  async create(projectId: string, value: unknown, currentUserId?: string): Promise<CheckInRecord> {
    const body = fields(value);
    const userId = this.resolveUser(body, currentUserId);

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

    await this.validateMessageOwnership(validated.messageIds, userId, Boolean(currentUserId));
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
    const userId = this.resolveUser(body, currentUserId);

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

    await this.validateMessageOwnership(validated.messageIds, userId, Boolean(currentUserId));
    const now = new Date();
    const startOfDay = new Date(now);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(startOfDay);
    endOfDay.setDate(endOfDay.getDate() + 1);

    const existing = await this.checkInRepo.findDailyByUserAndProject(userId, projectId, startOfDay, endOfDay);
    if (existing) {
      return this.checkInRepo.updateCheckIn(existing.id, {
        summary: validated.summary,
        difficulties: validated.difficulties ?? existing.difficulties ?? null,
        nextSteps: validated.nextSteps ?? existing.nextSteps ?? null,
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

