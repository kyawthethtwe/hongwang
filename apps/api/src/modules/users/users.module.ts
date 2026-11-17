import { Module } from '@nestjs/common';
import { SessionsService } from './sessions.service';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

/**
 * Owner: Auth & Accounts module.
 * Profile, password change, sessions, avatar upload, account deletion, public user profiles.
 * Exports UsersService (lookups, MeDto) and SessionsService (refresh-token sessions) for AuthModule
 * and any module that needs them.
 */
@Module({
  controllers: [UsersController],
  providers: [UsersService, SessionsService],
  exports: [UsersService, SessionsService],
})
export class UsersModule {}
