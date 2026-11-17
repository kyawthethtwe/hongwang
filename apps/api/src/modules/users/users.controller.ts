import type { MeDto, PublicUserDto, SessionDto, UploadTarget } from '@hongwang/shared';
import { Body, Controller, Delete, Get, HttpCode, Inject, Param, Patch, Post, Res } from '@nestjs/common';
import type { Response } from 'express';
import { CurrentUser, Public, type AuthUser } from '../../common/auth';
import { ENV, type Env } from '../../config/env';
import { clearAuthCookies } from '../auth/cookies';
import { AvatarUploadDto, ChangePasswordDto, IdParamDto, UpdateProfileDto } from './users.dto';
import { UsersService } from './users.service';

/** Users contract: packages/shared/src/schemas/users.ts */
@Controller('users')
export class UsersController {
  constructor(
    private readonly users: UsersService,
    @Inject(ENV) private readonly env: Env,
  ) {}

  @Patch('me')
  updateProfile(@CurrentUser() user: AuthUser, @Body() body: UpdateProfileDto): Promise<MeDto> {
    return this.users.updateProfile(user.id, body);
  }

  @Post('me/password')
  @HttpCode(204)
  async changePassword(@CurrentUser() user: AuthUser, @Body() body: ChangePasswordDto): Promise<void> {
    await this.users.changePassword(user, body);
  }

  @Get('me/sessions')
  listSessions(@CurrentUser() user: AuthUser): Promise<SessionDto[]> {
    return this.users.listSessions(user);
  }

  @Post('me/sessions/revoke-others')
  @HttpCode(204)
  async revokeOthers(@CurrentUser() user: AuthUser): Promise<void> {
    await this.users.revokeOtherSessions(user);
  }

  @Delete('me/sessions/:id')
  @HttpCode(204)
  async revokeSession(
    @CurrentUser() user: AuthUser,
    @Param() { id }: IdParamDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    const { current } = await this.users.revokeSession(user, id);
    if (current) clearAuthCookies(res, this.env);
  }

  @Post('me/avatar/upload-url')
  avatarUploadUrl(@CurrentUser() user: AuthUser, @Body() body: AvatarUploadDto): Promise<UploadTarget> {
    return this.users.createAvatarUploadTarget(user.id, body);
  }

  @Delete('me')
  @HttpCode(204)
  async deleteAccount(@CurrentUser() user: AuthUser, @Res({ passthrough: true }) res: Response): Promise<void> {
    await this.users.deleteAccount(user.id);
    clearAuthCookies(res, this.env);
  }

  @Public()
  @Get(':id')
  publicProfile(@Param() { id }: IdParamDto): Promise<PublicUserDto> {
    return this.users.getPublicProfile(id);
  }
}
