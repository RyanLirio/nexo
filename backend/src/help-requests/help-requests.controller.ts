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

@Controller('api/v1')
export class HelpRequestsController {
  constructor(private readonly helpRequests: HelpRequestsService) {}

  @Get('help-requests')
  list(
    @Query('projectId') projectId?: string,
    @Query('status') status?: string,
  ) {
    return this.helpRequests.list(projectId, status);
  }

  @Get('help-requests/:id')
  getById(@Param('id') id: string) {
    return this.helpRequests.getById(id);
  }

  @Post('projects/:projectId/help-requests')
  @UseGuards(AuthGuard)
  create(
    @Param('projectId') projectId: string,
    @Body() body: unknown,
    @CurrentUser() user?: AuthenticatedUser,
  ) {
    return this.helpRequests.create(projectId, body, user?.id);
  }

  @Patch('help-requests/:id/status')
  changeStatus(@Param('id') id: string, @Body() body: unknown) {
    return this.helpRequests.changeStatus(id, body);
  }
}

