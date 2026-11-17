import type { SavedListingDto } from '@hongwang/shared';
import { Controller, Delete, Get, HttpCode, Param, Put, Query } from '@nestjs/common';
import { CurrentUser, type AuthUser } from '../../common/auth';
import { SavedListingParamDto, SavedQueryDto } from './dto';
import { SavedService } from './saved.service';

/** Saved rooms. Contract: packages/shared/src/schemas/search.ts. */
@Controller('saved')
export class SavedController {
  constructor(private readonly saved: SavedService) {}

  @Get()
  list(@CurrentUser() user: AuthUser, @Query() query: SavedQueryDto): Promise<SavedListingDto[]> {
    return this.saved.list(user, query);
  }

  @Get('ids')
  ids(@CurrentUser() user: AuthUser): Promise<string[]> {
    return this.saved.ids(user);
  }

  @Put(':listingId')
  @HttpCode(204)
  async save(@CurrentUser() user: AuthUser, @Param() { listingId }: SavedListingParamDto): Promise<void> {
    await this.saved.save(user, listingId);
  }

  @Delete(':listingId')
  @HttpCode(204)
  async unsave(@CurrentUser() user: AuthUser, @Param() { listingId }: SavedListingParamDto): Promise<void> {
    await this.saved.unsave(user, listingId);
  }
}
