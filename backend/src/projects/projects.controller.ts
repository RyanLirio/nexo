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

@Controller('api/v1/projects')
export class ProjectsController {
  constructor(private readonly projects: ProjectsService) {}

  @Get()
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query('teamId') teamId?: string,
    @Query('status') status?: string,
    @Query('userId') userId?: string,
  ) {
    return this.projects.list({ teamId, status, userId }, user.id);
  }

  @Post()
  @UseGuards(AuthGuard)
  create(@Body() body: unknown, @CurrentUser() user?: AuthenticatedUser) {
    return this.projects.create(body, user?.id);
  }

  @Get(':id')
  getById(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.projects.getById(id, user.id);
  }

  @Get(':id/leader-view')
  @UseGuards(AuthGuard)
  getLeaderView(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.projects.getLeaderView(id, user.id);
  }


  @Patch(':id')
  @UseGuards(AuthGuard)
  update(
    @Param('id') id: string,
    @Body() body: unknown,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.projects.update(id, body, user.id);
  }

  @Patch(':id/status')
  @UseGuards(AuthGuard)
  changeStatus(
    @Param('id') id: string,
    @Body() body: unknown,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.projects.changeStatus(id, body, user.id);
  }

  @Get(':id/members')
  listMembers(@Param('id') id: string) {
    return this.projects.listMembers(id);
  }

  @Post(':id/members')
  addMember(@Param('id') id: string, @Body() body: unknown) {
    return this.projects.addMember(id, body);
  }

  @Delete(':id/members/:userId')
  async removeMember(@Param('id') id: string, @Param('userId') userId: string) {
    await this.projects.removeMember(id, userId);
    return { ok: true };
  }
}
