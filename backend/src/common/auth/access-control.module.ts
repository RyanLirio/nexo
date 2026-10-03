import { Module } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import { AccessControlService, PrismaAccessControlService } from './access-control.service';

@Module({
  providers: [PrismaService, { provide: AccessControlService, useClass: PrismaAccessControlService }],
  exports: [AccessControlService],
})
export class AccessControlModule {}
