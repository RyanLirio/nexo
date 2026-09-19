import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { CheckInsService } from './check-ins.service';

@Controller('projects/:projectId/check-ins')
export class CheckInsController {
  constructor(private readonly checkIns: CheckInsService) {}

  @Get()
  list(@Param('projectId') projectId: string) {
    return this.checkIns.list(projectId);
  }

  @Post()
  create(@Param('projectId') projectId: string, @Body() body: unknown) {
    return this.checkIns.create(projectId, body);
  }
}
