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

@Controller('api/v1/knowledge')
export class KnowledgeController {
  constructor(private readonly knowledge: KnowledgeService) {}

  @Get()
  list(
    @Query('query') query?: string,
    @Query('projectId') projectId?: string,
  ) {
    return this.knowledge.list(query, projectId);
  }

  @Get(':id')
  getById(@Param('id') id: string) {
    return this.knowledge.getById(id);
  }

  @Post()
  @UseGuards(AuthGuard)
  create(
    @Body() body: unknown,
    @CurrentUser() user?: AuthenticatedUser,
  ) {
    return this.knowledge.create(body, user?.id);
  }

  @Patch(':id/authorize')
  @UseGuards(AuthGuard)
  authorize(
    @Param('id') id: string,
    @Body() body: unknown,
    @CurrentUser() user?: AuthenticatedUser,
  ) {
    return this.knowledge.authorize(id, body, user?.id);
  }
}

