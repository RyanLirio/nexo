import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { fields, optionalText, requiredText } from '../request-fields';

type HelpState = 'OPEN' | 'IN_PROGRESS' | 'RESOLVED';
const nextStatus: Record<HelpState, HelpState[]> = {
  OPEN: ['IN_PROGRESS', 'RESOLVED'],
  IN_PROGRESS: ['RESOLVED'],
  RESOLVED: [],
};

@Injectable()
export class HelpRequestsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(projectId: string) {
    const project = await this.prisma.project.findUnique({ where: { id: projectId }, select: { id: true } });
    if (!project) throw new NotFoundException('Projeto não encontrado.');
    return this.prisma.helpRequest.findMany({
      where: { projectId },
      include: {
        requester: { select: { id: true, name: true } },
        helper: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  async create(projectId: string, value: unknown) {
    const body = fields(value);
    const requesterId = requiredText(body, 'requesterId', 100);
    const helperId = optionalText(body, 'helperId', 100);
    const problem = requiredText(body, 'problem');
    const project = await this.prisma.project.findUnique({ where: { id: projectId }, select: { id: true } });
    if (!project) throw new NotFoundException('Projeto não encontrado.');
    const requester = await this.prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId, userId: requesterId } },
      select: { userId: true },
    });
    if (!requester) throw new ForbiddenException('O solicitante informado não participa deste projeto.');
    if (helperId) {
      const helper = await this.prisma.projectMember.findUnique({
        where: { projectId_userId: { projectId, userId: helperId } },
        select: { userId: true },
      });
      if (!helper) throw new BadRequestException('O ajudante informado deve participar deste projeto.');
    }
    return this.prisma.helpRequest.create({ data: { projectId, requesterId, helperId, problem } });
  }

  async changeStatus(id: string, value: unknown) {
    const status = requiredText(fields(value), 'status', 20);
    if (status !== 'OPEN' && status !== 'IN_PROGRESS' && status !== 'RESOLVED') {
      throw new BadRequestException('Status deve ser OPEN, IN_PROGRESS ou RESOLVED.');
    }
    const request = await this.prisma.helpRequest.findUnique({ where: { id } });
    if (!request) throw new NotFoundException('Pedido de ajuda não encontrado.');
    if (status === request.status) return request;
    if (!nextStatus[request.status].includes(status)) {
      throw new BadRequestException('Transição de status inválida.');
    }
    return this.prisma.helpRequest.update({
      where: { id },
      data: { status, resolvedAt: status === 'RESOLVED' ? new Date() : null },
    });
  }
}
