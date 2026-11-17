import { Module } from '@nestjs/common';
import { ListingPhotosService } from './listing-photos.service';
import { ListingPhotosController, ListingsController } from './listings.controller';
import { ListingsService } from './listings.service';

/**
 * Owner: Listings & Search module.
 * Host listing CRUD, photos (presigned uploads), submit/pause, public listing detail and availability.
 */
@Module({
  controllers: [ListingsController, ListingPhotosController],
  providers: [ListingsService, ListingPhotosService],
  exports: [ListingsService],
})
export class ListingsModule {}
