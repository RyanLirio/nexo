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

@Controller()
export class HelpRequestsController {
  constructor(private readonly helpRequests: HelpRequestsService) {}

  // v1 routes
  @Get('api/v1/help-requests')
  list(
    @Query('projectId') projectId?: string,
    @Query('status') status?: string,
  ) {
    return this.helpRequests.list(projectId, status);
  }

  @Get('api/v1/help-requests/:id')
  getById(@Param('id') id: string) {
    return this.helpRequests.getById(id);
  }

  @Post('api/v1/projects/:projectId/help-requests')
  @UseGuards(AuthGuard)
  createV1(
    @Param('projectId') projectId: string,
    @Body() body: unknown,
    @CurrentUser() user?: AuthenticatedUser,
  ) {
    return this.helpRequests.create(projectId, body, user?.id);
  }

  @Patch('api/v1/help-requests/:id/status')
  changeStatusV1(@Param('id') id: string, @Body() body: unknown) {
    return this.helpRequests.changeStatus(id, body);
  }

  // legacy routes for backwards compatibility
  @Get('projects/:projectId/help-requests')
  legacyList(@Param('projectId') projectId: string) {
    return this.helpRequests.list(projectId);
  }

  @Post('projects/:projectId/help-requests')
  legacyCreate(@Param('projectId') projectId: string, @Body() body: unknown) {
    return this.helpRequests.create(projectId, body);
  }

  @Patch('help-requests/:id/status')
  legacyChangeStatus(@Param('id') id: string, @Body() body: unknown) {
    return this.helpRequests.changeStatus(id, body);
  }
}
