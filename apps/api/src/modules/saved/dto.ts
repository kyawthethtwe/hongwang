import { savedQuerySchema } from '@hongwang/shared';
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export class SavedQueryDto extends createZodDto(savedQuerySchema) {}
export class SavedListingParamDto extends createZodDto(z.object({ listingId: z.uuid() })) {}
