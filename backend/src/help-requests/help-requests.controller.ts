import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard, AuthenticatedUser } from '../common/auth/auth.guard';
import { CurrentUser } from '../common/auth/current-user.decorator';
import { HelpRequestsService } from './help-requests.service';
import { ProjectsService } from '../projects/projects.service';

@Controller('api/v1')
export class HelpRequestsController {
  constructor(private readonly helpRequests: HelpRequestsService, private readonly projects: ProjectsService) {}

  @Get('help-requests')
  async list(
    @CurrentUser() user: AuthenticatedUser,
    @Query('projectId') projectId?: string,
    @Query('status') status?: string,
  ) {
    if (projectId) await this.projects.getById(projectId, user.id);
    const accessible = await this.projects.list(undefined, user.id);
    return this.helpRequests.list(projectId, status, accessible.map(project => project.id as string));
  }

  @Get('help-requests/:id')
  async getById(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    const request = await this.helpRequests.getById(id);
    await this.projects.getById(request.projectId, user.id);
    return request;
  }

  @Post('projects/:projectId/help-requests')
  @UseGuards(AuthGuard)
  async create(
    @Param('projectId') projectId: string,
    @Body() body: unknown,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    await this.projects.getById(projectId, user.id);
    return this.helpRequests.create(projectId, body, user.id);
  }

  @Patch('help-requests/:id/status')
  async changeStatus(@Param('id') id: string, @Body() body: unknown, @CurrentUser() user: AuthenticatedUser) {
    await this.getById(id, user);
    return this.helpRequests.changeStatus(id, body);
  }
}

