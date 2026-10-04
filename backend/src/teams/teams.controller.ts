import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { Roles } from '../common/auth/roles.decorator';
import { TeamsService } from './teams.service';
import { CurrentUser } from '../common/auth/current-user.decorator';
import { AuthenticatedUser } from '../common/auth/auth.guard';
import { AccessControlService } from '../common/auth/access-control.service';

@Controller('api/v1/teams')
export class TeamsController {
  constructor(private readonly teamsService: TeamsService, private readonly access: AccessControlService) {}

  @Get()
  async list(@CurrentUser() user: AuthenticatedUser) {
    return this.teamsService.list(await this.access.isAdmin(user.id) ? undefined : user.id);
  }

  @Roles('ADMIN')
  @Post()
  async create(@Body() body: unknown) {
    return this.teamsService.create(body);
  }

  @Roles('ADMIN', 'MEMBER')
  @Get(':id')
  async getById(@Param('id') id: string) {
    return this.teamsService.getById(id);
  }

  @Roles('ADMIN', 'LEADER')
  @Patch(':id')
  async update(@Param('id') id: string, @Body() body: unknown) {
    return this.teamsService.update(id, body);
  }

  @Roles('ADMIN', 'MEMBER')
  @Get(':id/members')
  async listMembers(@Param('id') id: string) {
    return this.teamsService.listMembers(id);
  }

  @Roles('ADMIN', 'MEMBER')
  @Post(':id/members')
  async addMember(@Param('id') id: string, @Body() body: unknown) {
    return this.teamsService.addMember(id, body);
  }

  @Roles('ADMIN', 'LEADER')
  @Delete(':id/members/:userId')
  async removeMember(@Param('id') id: string, @Param('userId') userId: string) {
    await this.teamsService.removeMember(id, userId);
    return { ok: true };
  }
}
