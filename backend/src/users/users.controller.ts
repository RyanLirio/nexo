import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { Roles } from '../common/auth/roles.decorator';
import { UsersService } from './users.service';
import { CurrentUser } from '../common/auth/current-user.decorator';
import { AuthenticatedUser } from '../common/auth/auth.guard';
import { AccessControlService } from '../common/auth/access-control.service';

@Controller('api/v1/users')
export class UsersController {
  constructor(private readonly usersService: UsersService, private readonly access: AccessControlService) {}

  @Get()
  async list(
    @Query('search') search?: string,
    @Query('status') status?: 'active' | 'inactive' | 'all',
    @Query('role') role?: string,
  ) {
    return this.usersService.list({ search, status, role });
  }

  @Roles('ADMIN')
  @Post()
  async create(@Body() body: { name?: string; email?: string; role?: string }) {
    return this.usersService.create(body);
  }

  @Get(':id')
  async getById(@Param('id') id: string) {
    return this.usersService.getById(id);
  }

  @Roles('ADMIN')
  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() body: { name?: string; role?: string; isActive?: boolean },
  ) {
    return this.usersService.update(id, body);
  }

  @Get(':id/projects')
  async getProjects(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Query('relation') relation?: 'member' | 'responsible' | 'leader',
    @Query('status') status?: string,
  ) {
    return this.usersService.getProjects(id, { relation, status }, await this.access.isAdmin(user.id) ? undefined : user.id);
  }
}
