import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { TeamsService } from './teams.service';

@Controller('api/v1/teams')
export class TeamsController {
  constructor(private readonly teamsService: TeamsService) {}

  @Get()
  async list() {
    return this.teamsService.list();
  }

  @Post()
  async create(@Body() body: unknown) {
    return this.teamsService.create(body);
  }

  @Get(':id')
  async getById(@Param('id') id: string) {
    return this.teamsService.getById(id);
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() body: unknown) {
    return this.teamsService.update(id, body);
  }

  @Get(':id/members')
  async listMembers(@Param('id') id: string) {
    return this.teamsService.listMembers(id);
  }

  @Post(':id/members')
  async addMember(@Param('id') id: string, @Body() body: unknown) {
    return this.teamsService.addMember(id, body);
  }

  @Delete(':id/members/:userId')
  async removeMember(@Param('id') id: string, @Param('userId') userId: string) {
    await this.teamsService.removeMember(id, userId);
    return { ok: true };
  }
}
