import { Module } from '@nestjs/common';
import { OpenAIService } from './openai.service';
import { AiToolsModule } from './tools/ai-tools.module';

@Module({
  imports: [AiToolsModule],
  providers: [OpenAIService],
  exports: [OpenAIService, AiToolsModule],
})
export class AiModule {}