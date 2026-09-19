import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { KnowledgeService } from './knowledge.service';

@Controller('knowledge')
export class KnowledgeController {
  constructor(private readonly knowledge: KnowledgeService) {}

  @Get()
  list(@Query('q') query?: string, @Query('projectId') projectId?: string) {
    return this.knowledge.list(query, projectId);
  }

  @Get(':id')
  getById(@Param('id') id: string) {
    return this.knowledge.getById(id);
  }

  @Post()
  create(@Body() body: unknown) {
    return this.knowledge.create(body);
  }

  @Patch(':id/authorize')
  authorize(@Param('id') id: string, @Body() body: unknown) {
    return this.knowledge.authorize(id, body);
  }
}
