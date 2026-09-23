import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { AuthGuard, AuthenticatedUser } from '../common/auth/auth.guard';
import { CurrentUser } from '../common/auth/current-user.decorator';
import { CheckInsService } from './check-ins.service';

@Controller('api/v1')
export class CheckInsController {
  constructor(private readonly checkIns: CheckInsService) {}

  @Get('projects/:projectId/check-ins')
  listByProject(@Param('projectId') projectId: string) {
    return this.checkIns.list(projectId);
  }

  @Post('projects/:projectId/check-ins')
  @UseGuards(AuthGuard)
  create(
    @Param('projectId') projectId: string,
    @Body() body: unknown,
    @CurrentUser() user?: AuthenticatedUser,
  ) {
    return this.checkIns.create(projectId, body, user?.id);
  }

  @Get('check-ins/:id')
  getById(@Param('id') id: string) {
    return this.checkIns.getById(id);
  }
}
