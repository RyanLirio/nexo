import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { Public } from './common/auth/public.decorator';
import { PrismaService } from './prisma.service';

@Public()
@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async check() {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return { status: 'ok', database: 'ok' };
    } catch {
      throw new ServiceUnavailableException('Banco de dados indisponível.');
    }
  }
}
