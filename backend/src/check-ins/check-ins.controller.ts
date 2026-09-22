import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { AuthGuard, AuthenticatedUser } from '../common/auth/auth.guard';
import { CurrentUser } from '../common/auth/current-user.decorator';
import { CheckInsService } from './check-ins.service';

@Controller()
export class CheckInsController {
  constructor(private readonly checkIns: CheckInsService) {}

  // v1 routes
  @Get('api/v1/projects/:projectId/check-ins')
  listByProject(@Param('projectId') projectId: string) {
    return this.checkIns.list(projectId);
  }

  @Post('api/v1/projects/:projectId/check-ins')
  @UseGuards(AuthGuard)
  createV1(
    @Param('projectId') projectId: string,
    @Body() body: unknown,
    @CurrentUser() user?: AuthenticatedUser,
  ) {
    return this.checkIns.create(projectId, body, user?.id);
  }

  @Get('api/v1/check-ins/:id')
  getById(@Param('id') id: string) {
    return this.checkIns.getById(id);
  }

  // legacy route
  @Post('projects/:projectId/check-ins')
  create(@Param('projectId') projectId: string, @Body() body: unknown) {
    return this.checkIns.create(projectId, body);
  }
}
