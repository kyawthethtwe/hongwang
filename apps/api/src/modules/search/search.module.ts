import { Module } from '@nestjs/common';
import { SearchController } from './search.controller';
import { SearchService } from './search.service';

/**
 * Owner: Listings & Search module.
 * Map + date search on Postgres (PostGIS box, NOT EXISTS availability) and place autocomplete.
 */
@Module({
  controllers: [SearchController],
  providers: [SearchService],
  exports: [SearchService],
})
export class SearchModule {}
