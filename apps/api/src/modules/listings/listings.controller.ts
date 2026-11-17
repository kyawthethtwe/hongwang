import type {
  AvailabilityDto,
  HostListingDto,
  HostListingSummaryDto,
  ListingDetailDto,
  ListingPhotoDto,
  UploadTarget,
} from '@hongwang/shared';
import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Put, Query } from '@nestjs/common';
import { CurrentUser, OptionalAuth, type AuthUser } from '../../common/auth';
import {
  AttachPhotoDto,
  AvailabilityQueryDto,
  CreateListingDto,
  ListingIdParamDto,
  PhotoParamDto,
  PhotoUploadDto,
  ReorderPhotosDto,
  UpdateListingDto,
  UpdatePhotoDto,
} from './dto';
import { ListingPhotosService } from './listing-photos.service';
import { ListingsService } from './listings.service';

/** Listings contract: packages/shared/src/schemas/listings.ts. Static paths come before `:id`. */
@Controller('listings')
export class ListingsController {
  constructor(private readonly listings: ListingsService) {}

  @Get('mine')
  mine(@CurrentUser() user: AuthUser): Promise<HostListingSummaryDto[]> {
    return this.listings.mine(user);
  }

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() body: CreateListingDto): Promise<HostListingDto> {
    return this.listings.create(user, body);
  }

  @OptionalAuth()
  @Get(':id')
  detail(@Param() { id }: ListingIdParamDto, @CurrentUser() user: AuthUser | undefined): Promise<ListingDetailDto> {
    return this.listings.detail(id, user);
  }

  @OptionalAuth()
  @Get(':id/availability')
  availability(
    @Param() { id }: ListingIdParamDto,
    @Query() query: AvailabilityQueryDto,
    @CurrentUser() user: AuthUser | undefined,
  ): Promise<AvailabilityDto> {
    return this.listings.availability(id, query, user);
  }

  @Get(':id/edit')
  edit(@Param() { id }: ListingIdParamDto, @CurrentUser() user: AuthUser): Promise<HostListingDto> {
    return this.listings.getForEdit(id, user);
  }

  @Patch(':id')
  update(@Param() { id }: ListingIdParamDto, @CurrentUser() user: AuthUser, @Body() body: UpdateListingDto): Promise<HostListingDto> {
    return this.listings.update(id, user, body);
  }

  @Post(':id/submit')
  @HttpCode(200)
  submit(@Param() { id }: ListingIdParamDto, @CurrentUser() user: AuthUser): Promise<HostListingDto> {
    return this.listings.submit(id, user);
  }

  @Post(':id/pause')
  @HttpCode(200)
  pause(@Param() { id }: ListingIdParamDto, @CurrentUser() user: AuthUser): Promise<HostListingDto> {
    return this.listings.pause(id, user);
  }

  @Post(':id/unpause')
  @HttpCode(200)
  unpause(@Param() { id }: ListingIdParamDto, @CurrentUser() user: AuthUser): Promise<HostListingDto> {
    return this.listings.unpause(id, user);
  }

  @Delete(':id')
  @HttpCode(204)
  async remove(@Param() { id }: ListingIdParamDto, @CurrentUser() user: AuthUser): Promise<void> {
    await this.listings.remove(id, user);
  }
}

@Controller('listings/:id/photos')
export class ListingPhotosController {
  constructor(private readonly photos: ListingPhotosService) {}

  @Post('upload-url')
  @HttpCode(200)
  uploadUrl(@Param() { id }: ListingIdParamDto, @CurrentUser() user: AuthUser, @Body() body: PhotoUploadDto): Promise<UploadTarget> {
    return this.photos.createUploadTarget(id, user, body);
  }

  @Post()
  attach(@Param() { id }: ListingIdParamDto, @CurrentUser() user: AuthUser, @Body() body: AttachPhotoDto): Promise<ListingPhotoDto> {
    return this.photos.attach(id, user, body);
  }

  @Put('order')
  reorder(@Param() { id }: ListingIdParamDto, @CurrentUser() user: AuthUser, @Body() body: ReorderPhotosDto): Promise<ListingPhotoDto[]> {
    return this.photos.reorder(id, user, body);
  }

  @Patch(':photoId')
  caption(@Param() { id, photoId }: PhotoParamDto, @CurrentUser() user: AuthUser, @Body() body: UpdatePhotoDto): Promise<ListingPhotoDto> {
    return this.photos.updateCaption(id, photoId, user, body);
  }

  @Delete(':photoId')
  @HttpCode(204)
  async remove(@Param() { id, photoId }: PhotoParamDto, @CurrentUser() user: AuthUser): Promise<void> {
    await this.photos.remove(id, photoId, user);
  }
}
