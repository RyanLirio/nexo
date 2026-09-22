import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard, AuthenticatedUser } from '../common/auth/auth.guard';
import { CurrentUser } from '../common/auth/current-user.decorator';
import { ProjectsService } from './projects.service';

@Controller()
export class ProjectsController {
  constructor(private readonly projects: ProjectsService) {}

  // v1 endpoints
  @Get('api/v1/projects')
  list(
    @Query('teamId') teamId?: string,
    @Query('status') status?: string,
    @Query('userId') userId?: string,
  ) {
    return this.projects.list({ teamId, status, userId });
  }

  @Post('api/v1/projects')
  @UseGuards(AuthGuard)
  create(@Body() body: unknown, @CurrentUser() user?: AuthenticatedUser) {
    return this.projects.create(body, user?.id);
  }

  @Get('api/v1/projects/:id')
  getById(@Param('id') id: string) {
    return this.projects.getById(id);
  }

  @Patch('api/v1/projects/:id')
  update(@Param('id') id: string, @Body() body: unknown) {
    return this.projects.update(id, body);
  }

  @Patch('api/v1/projects/:id/status')
  @UseGuards(AuthGuard)
  changeStatus(
    @Param('id') id: string,
    @Body() body: unknown,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.projects.changeStatus(id, body, user.id);
  }

  @Get('api/v1/projects/:id/members')
  listMembers(@Param('id') id: string) {
    return this.projects.listMembers(id);
  }

  @Post('api/v1/projects/:id/members')
  addMember(@Param('id') id: string, @Body() body: unknown) {
    return this.projects.addMember(id, body);
  }

  @Delete('api/v1/projects/:id/members/:userId')
  async removeMember(@Param('id') id: string, @Param('userId') userId: string) {
    await this.projects.removeMember(id, userId);
    return { ok: true };
  }

  // legacy backwards compatibility routes
  @Post('projects')
  legacyCreate(@Body() body: unknown) {
    return this.projects.create(body);
  }

  @Get('projects/:id')
  legacyGetById(@Param('id') id: string) {
    return this.projects.getById(id);
  }

  @Get('users/:userId/projects')
  legacyListByUser(@Param('userId') userId: string) {
    return this.projects.listByUser(userId);
  }

  @Get('teams/:teamId/projects')
  legacyListByTeam(@Param('teamId') teamId: string) {
    return this.projects.listByTeam(teamId);
  }
}
