import { MAX_PHOTO_BYTES } from '@hongwang/shared';
import {
  BadRequestException,
  Controller,
  ForbiddenException,
  Global,
  Headers,
  HttpCode,
  Module,
  Put,
  Query,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import { Public } from '../../common/auth';
import { StorageService } from './storage.service';

/** Receives browser uploads when STORAGE_DRIVER=local (the URL comes from StorageService). */
@Controller('uploads')
export class UploadsController {
  constructor(private readonly storage: StorageService) {}

  @Public()
  @Put('local')
  @HttpCode(204)
  async putLocal(
    @Query('key') key: string,
    @Query('ct') contentType: string,
    @Query('exp') exp: string,
    @Query('sig') sig: string,
    @Headers('content-type') headerType: string | undefined,
    @Req() req: Request,
  ) {
    if (!key || !this.storage.verifyLocalUpload(key, contentType, Number(exp), sig ?? '')) {
      throw new ForbiddenException('Upload link is invalid or expired');
    }
    if (headerType && headerType !== contentType) throw new BadRequestException('Content-Type mismatch');
    const body = await readBody(req, MAX_PHOTO_BYTES);
    await this.storage.writeLocal(key, body);
  }
}

function readBody(req: Request, limit: number): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    req.on('data', (c: Buffer) => {
      size += c.length;
      if (size > limit) {
        reject(new BadRequestException('File too large'));
        req.destroy();
      } else chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

@Global()
@Module({
  controllers: [UploadsController],
  providers: [StorageService],
  exports: [StorageService],
})
export class StorageModule {}
