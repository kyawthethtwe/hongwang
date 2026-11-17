import {
  attachPhotoInputSchema,
  availabilityQuerySchema,
  createListingInputSchema,
  idParamSchema,
  photoUploadInputSchema,
  reorderPhotosInputSchema,
  updateListingInputSchema,
  updatePhotoInputSchema,
} from '@hongwang/shared';
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export class ListingIdParamDto extends createZodDto(idParamSchema) {}
export class PhotoParamDto extends createZodDto(z.object({ id: z.uuid(), photoId: z.uuid() })) {}
export class AvailabilityQueryDto extends createZodDto(availabilityQuerySchema) {}
export class CreateListingDto extends createZodDto(createListingInputSchema) {}
export class UpdateListingDto extends createZodDto(updateListingInputSchema) {}
export class PhotoUploadDto extends createZodDto(photoUploadInputSchema) {}
export class AttachPhotoDto extends createZodDto(attachPhotoInputSchema) {}
export class UpdatePhotoDto extends createZodDto(updatePhotoInputSchema) {}
export class ReorderPhotosDto extends createZodDto(reorderPhotosInputSchema) {}
