import { Controller, Get, Param, Query } from '@nestjs/common';
import { UsersService } from './users.service';

@Controller('api/v1/users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  async list(@Query('search') search?: string) {
    return this.usersService.list(search);
  }

  @Get(':id')
  async getById(@Param('id') id: string) {
    return this.usersService.getById(id);
  }

  @Get(':id/projects')
  async getProjects(
    @Param('id') id: string,
    @Query('relation') relation?: 'member' | 'responsible' | 'leader',
    @Query('status') status?: string,
  ) {
    return this.usersService.getProjects(id, { relation, status });
  }
}
