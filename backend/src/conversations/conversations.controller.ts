import { Body, Controller, Get, Post } from '@nestjs/common';
import { AuthenticatedUser } from '../common/auth/auth.guard';
import { CurrentUser } from '../common/auth/current-user.decorator';
import { ConversationsService } from './conversations.service';
import { fields } from '../request-fields';

@Controller('api/v1/conversations')
export class ConversationsController {
  constructor(
    private readonly conversationsService: ConversationsService,
  ) {}

  @Get('current')
  history(@CurrentUser() user: AuthenticatedUser) {
    return this.conversationsService.getCurrentHistory(user.id);
  }

  @Post('message')
  sendMessage(
    @Body() body: unknown,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.conversationsService.separateMessageByProject(
      user.id,
      fields(body).message as string,
    );
  }
}
