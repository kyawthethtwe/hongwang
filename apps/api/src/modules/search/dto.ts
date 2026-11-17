import { placesQuerySchema, searchQuerySchema } from '@hongwang/shared';
import { createZodDto } from 'nestjs-zod';

export class SearchQueryDto extends createZodDto(searchQuerySchema) {}
export class PlacesQueryDto extends createZodDto(placesQuerySchema) {}
