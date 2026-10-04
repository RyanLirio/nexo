import { Controller, Get, Param, Query } from '@nestjs/common';
import { UsersService } from './users.service';
import { CurrentUser } from '../common/auth/current-user.decorator';
import { AuthenticatedUser } from '../common/auth/auth.guard';
import { AccessControlService } from '../common/auth/access-control.service';

@Controller('api/v1/users')
export class UsersController {
  constructor(private readonly usersService: UsersService, private readonly access: AccessControlService) {}

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
    @CurrentUser() user: AuthenticatedUser,
    @Query('relation') relation?: 'member' | 'responsible' | 'leader',
    @Query('status') status?: string,
  ) {
    return this.usersService.getProjects(id, { relation, status }, await this.access.isAdmin(user.id) ? undefined : user.id);
  }
}
