import { Body, Controller, Post } from '@nestjs/common';
import { AuthenticatedUser } from '../common/auth/auth.guard';
import { CurrentUser } from '../common/auth/current-user.decorator';
import { ConversationsService } from './conversations.service';

@Controller('api/v1/conversations')
export class ConversationsController {
  constructor(
    private readonly conversationsService: ConversationsService,
  ) {}

  @Post('message')
  sendMessage(
    @Body() body: { message: string },
    @CurrentUser() user?: AuthenticatedUser,
  ) {
    return this.conversationsService.separateMessageByProject(
      user!.id,
      body.message,
    );
  }
}