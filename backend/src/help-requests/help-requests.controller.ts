import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { HelpRequestsService } from './help-requests.service';

@Controller()
export class HelpRequestsController {
  constructor(private readonly helpRequests: HelpRequestsService) {}

  @Get('projects/:projectId/help-requests')
  list(@Param('projectId') projectId: string) {
    return this.helpRequests.list(projectId);
  }

  @Post('projects/:projectId/help-requests')
  create(@Param('projectId') projectId: string, @Body() body: unknown) {
    return this.helpRequests.create(projectId, body);
  }

  @Patch('help-requests/:id/status')
  changeStatus(@Param('id') id: string, @Body() body: unknown) {
    return this.helpRequests.changeStatus(id, body);
  }
}
