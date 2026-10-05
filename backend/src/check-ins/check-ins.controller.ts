import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { AuthGuard, AuthenticatedUser } from '../common/auth/auth.guard';
import { CurrentUser } from '../common/auth/current-user.decorator';
import { CheckInsService } from './check-ins.service';
import { ProjectsService } from '../projects/projects.service';
import { CheckInRecord } from './check-in.repository';

@Controller('api/v1')
export class CheckInsController {
  constructor(private readonly checkIns: CheckInsService, private readonly projects: ProjectsService) {}

  private toContext({ messages: _messages, ...context }: CheckInRecord) {
    // A equipe consulta o CheckIn estruturado, não a Conversation privada de outra pessoa.
    return context;
  }

  @Get('projects/:projectId/check-ins')
  async listByProject(
    @Param('projectId') projectId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Query('userId') userId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    await this.projects.getById(projectId, user.id);
    const checkIns = await this.checkIns.list(projectId, { userId, startDate, endDate });
    return checkIns.map(checkIn => this.toContext(checkIn));
  }


  @Post('projects/:projectId/check-ins')
  @UseGuards(AuthGuard)
  async create(
    @Param('projectId') projectId: string,
    @Body() body: unknown,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    await this.projects.getById(projectId, user.id);
    return this.toContext(await this.checkIns.create(projectId, body, user.id));
  }

  @Get('check-ins/:id')
  async getById(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    const checkIn = await this.checkIns.getById(id);
    await this.projects.getById(checkIn.projectId, user.id);
    return this.toContext(checkIn);
  }
}
