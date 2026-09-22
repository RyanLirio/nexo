import { Module } from '@nestjs/common';
import { CheckInsController } from './check-ins.controller';
import { CheckInsService } from './check-ins.service';
import { CheckInRepository } from './check-in.repository';
import { PrismaCheckInRepository } from './prisma-check-in.repository';
import { PrismaService } from '../prisma.service';

@Module({
  controllers: [CheckInsController],
  providers: [
    PrismaService,
    CheckInsService,
    {
      provide: CheckInRepository,
      useClass: PrismaCheckInRepository,
    },
  ],
  exports: [CheckInsService, CheckInRepository],
})
export class CheckInsModule {}
