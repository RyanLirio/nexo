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
    @CurrentUser() user: AuthenticatedUser,
    @Query('query') query?: string,
    @Query('projectId') projectId?: string,
    @Query('status') status?: string,
    @Query('technology') technology?: string,
  ) {
    return this.technicalProblems.list(query, projectId, { status, technology }, user.id);
  }

  @Get('/api/v1/projects/:projectId/technical-problems')
  listByProject(
    @CurrentUser() user: AuthenticatedUser,
    @Param('projectId') projectId: string,
    @Query('status') status?: string,
    @Query('technology') technology?: string,
  ) {
    return this.technicalProblems.list(undefined, projectId, {
      status,
      technology,
      onlyAuthorized: false,
    }, user.id);
  }

  @Get(':id')
  getById(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.technicalProblems.getById(id, user.id);
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

  @Patch(':id/solution')
  @UseGuards(AuthGuard)
  updateSolution(
    @Param('id') id: string,
    @Body() body: unknown,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const fields = typeof body === 'object' && body !== null ? (body as Record<string, unknown>) : {};
    const solution = typeof fields.solution === 'string' ? fields.solution : '';
    return this.technicalProblems.updateSolution(id, solution, user.id);
  }
}


