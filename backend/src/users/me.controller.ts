import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AuthGuard, AuthenticatedUser } from '../common/auth/auth.guard';
import { CurrentUser } from '../common/auth/current-user.decorator';
import { UsersService } from './users.service';

@Controller('api/v1/me')
@UseGuards(AuthGuard)
export class MeController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  async getMe(@CurrentUser() user: AuthenticatedUser) {
    return this.usersService.getMe(user.id);
  }

  @Get('projects')
  async getMeProjects(
    @CurrentUser() user: AuthenticatedUser,
    @Query('relation') relation?: 'member' | 'responsible' | 'leader',
    @Query('status') status?: string,
  ) {
    return this.usersService.getMeProjects(user.id, { relation, status });
  }
}
