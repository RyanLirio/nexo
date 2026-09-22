import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ProjectsService } from './projects.service';

@Controller()
export class ProjectsController {
  constructor(private readonly projects: ProjectsService) {}

  @Post('projects')
  create(@Body() body: unknown) {
    return this.projects.create(body);
  }

  @Get('projects/:id')
  getById(@Param('id') id: string) {
    return this.projects.getById(id);
  }

  @Get('users/:userId/projects')
  listByUser(@Param('userId') userId: string) {
    return this.projects.listByUser(userId);
  }

  @Get('teams/:teamId/projects')
  listByTeam(@Param('teamId') teamId: string) {
    return this.projects.listByTeam(teamId);
  }
}
