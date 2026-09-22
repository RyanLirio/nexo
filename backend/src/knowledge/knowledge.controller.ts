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
import { KnowledgeService } from './knowledge.service';

@Controller()
export class KnowledgeController {
  constructor(private readonly knowledge: KnowledgeService) {}

  // v1 routes
  @Get('api/v1/knowledge')
  list(
    @Query('query') query?: string,
    @Query('projectId') projectId?: string,
  ) {
    return this.knowledge.list(query, projectId);
  }

  @Get('api/v1/knowledge/:id')
  getById(@Param('id') id: string) {
    return this.knowledge.getById(id);
  }

  @Post('api/v1/knowledge')
  @UseGuards(AuthGuard)
  create(
    @Body() body: unknown,
    @CurrentUser() user?: AuthenticatedUser,
  ) {
    return this.knowledge.create(body, user?.id);
  }

  @Patch('api/v1/knowledge/:id/authorize')
  @UseGuards(AuthGuard)
  authorize(
    @Param('id') id: string,
    @Body() body: unknown,
    @CurrentUser() user?: AuthenticatedUser,
  ) {
    return this.knowledge.authorize(id, body, user?.id);
  }

  // legacy routes for backwards compatibility
  @Get('knowledge')
  legacyList(
    @Query('query') query?: string,
    @Query('projectId') projectId?: string,
  ) {
    return this.knowledge.list(query, projectId);
  }

  @Get('knowledge/:id')
  legacyGetById(@Param('id') id: string) {
    return this.knowledge.getById(id);
  }

  @Post('knowledge')
  legacyCreate(@Body() body: unknown) {
    return this.knowledge.create(body);
  }

  @Post('knowledge/:id/authorize')
  legacyAuthorize(@Param('id') id: string, @Body() body: unknown) {
    return this.knowledge.authorize(id, body);
  }
}
