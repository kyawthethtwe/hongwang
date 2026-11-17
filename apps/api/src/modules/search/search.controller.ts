import type { PlaceDto, SearchResultDto } from '@hongwang/shared';
import { Controller, Get, Query } from '@nestjs/common';
import { OptionalAuth } from '../../common/auth';
import { PlacesQueryDto, SearchQueryDto } from './dto';
import { SearchService } from './search.service';

@Controller('search')
export class SearchController {
  constructor(private readonly search: SearchService) {}

  /** GET /search: map box, place, dates, guests and filters -> one page of ListingSummaryDto. */
  @OptionalAuth()
  @Get()
  find(@Query() query: SearchQueryDto): Promise<SearchResultDto> {
    return this.search.search(query);
  }

  /** GET /search/places?q=: built-in Bangkok neighbourhoods for the "Where" field. */
  @OptionalAuth()
  @Get('places')
  places(@Query() query: PlacesQueryDto): PlaceDto[] {
    return this.search.places(query.q);
  }
}
