import { Module } from '@nestjs/common';
import { AccessControlModule } from '../common/auth/access-control.module';
import { MeController } from './me.controller';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { UserRepository } from './user.repository';
import { PrismaUserRepository } from './prisma-user.repository';
import { PrismaService } from '../prisma.service';

@Module({
  imports: [AccessControlModule],
  controllers: [MeController, UsersController],
  providers: [
    PrismaService,
    UsersService,
    {
      provide: UserRepository,
      useClass: PrismaUserRepository,
    },
  ],
  exports: [UsersService, UserRepository],
})
export class UsersModule {}
