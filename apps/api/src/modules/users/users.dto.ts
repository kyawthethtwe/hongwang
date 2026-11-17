import {
  avatarUploadInputSchema,
  changePasswordInputSchema,
  idParamSchema,
  updateProfileInputSchema,
} from '@hongwang/shared';
import { createZodDto } from 'nestjs-zod';

export class UpdateProfileDto extends createZodDto(updateProfileInputSchema) {}
export class ChangePasswordDto extends createZodDto(changePasswordInputSchema) {}
export class AvatarUploadDto extends createZodDto(avatarUploadInputSchema) {}
export class IdParamDto extends createZodDto(idParamSchema) {}
