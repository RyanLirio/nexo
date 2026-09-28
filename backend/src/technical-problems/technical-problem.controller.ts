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
import { TechnicalProblemService } from './technical-problem.service';

@Controller('api/v1/technical-problems')
export class TechnicalProblemController {
  constructor(private readonly technicalProblems: TechnicalProblemService) {}

  @Get()
  list(
    @Query('query') query?: string,
    @Query('projectId') projectId?: string,
  ) {
    return this.technicalProblems.list(query, projectId);
  }

  @Get(':id')
  getById(@Param('id') id: string) {
    return this.technicalProblems.getById(id);
  }

  @Post()
  @UseGuards(AuthGuard)
  create(
    @Body() body: unknown,
    @CurrentUser() user?: AuthenticatedUser,
  ) {
    return this.technicalProblems.create(body, user?.id);
  }

  @Patch(':id/authorize')
  @UseGuards(AuthGuard)
  authorize(
    @Param('id') id: string,
    @Body() body: unknown,
    @CurrentUser() user?: AuthenticatedUser,
  ) {
    return this.technicalProblems.authorize(id, body, user?.id);
  }
}

