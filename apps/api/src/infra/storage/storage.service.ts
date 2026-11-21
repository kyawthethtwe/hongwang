import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import { mkdir, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { DeleteObjectCommand, HeadObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import type { UploadTarget } from '@hongwang/shared';
import { Inject, Injectable } from '@nestjs/common';
import { ENV, type Env } from '../../config/env';

export const LOCAL_UPLOAD_DIR = path.resolve(process.cwd(), 'uploads');
const UPLOAD_TTL_SEC = 10 * 60;

const EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/heic': 'heic',
};

/**
 * Object storage (whiteboard: "R2 or Cloudinary", photos via presigned upload).
 * The browser PUTs the file straight to `uploadUrl`, then tells the API the `key`.
 * - STORAGE_DRIVER=s3: S3-compatible presigned PUT (Cloudflare R2, MinIO, AWS).
 * - STORAGE_DRIVER=local: HMAC-signed PUT to this API (UploadsController), served from /uploads.
 */
@Injectable()
export class StorageService {
  private readonly s3: S3Client | null;

  constructor(@Inject(ENV) private readonly env: Env) {
    this.s3 =
      env.STORAGE_DRIVER === 's3'
        ? new S3Client({
            region: env.S3_REGION,
            endpoint: env.S3_ENDPOINT,
            forcePathStyle: true,
            credentials: { accessKeyId: env.S3_ACCESS_KEY_ID ?? '', secretAccessKey: env.S3_SECRET_ACCESS_KEY ?? '' },
          })
        : null;
  }

  /** Builds a key like `listings/<listingId>/<uuid>.jpg`. */
  newKey(prefix: string, contentType: string): string {
    return `${prefix.replace(/\/+$/, '')}/${randomUUID()}.${EXT[contentType] ?? 'bin'}`;
  }

  publicUrl(key: string): string {
    if (this.env.STORAGE_DRIVER === 's3') return `${this.env.S3_PUBLIC_URL?.replace(/\/$/, '')}/${key}`;
    return `${this.env.API_PUBLIC_URL}/uploads/${key}`;
  }

  async createUploadTarget(key: string, contentType: string, size: number): Promise<UploadTarget> {
    if (this.s3) {
      const cmd = new PutObjectCommand({
        Bucket: this.env.S3_BUCKET,
        Key: key,
        ContentType: contentType,
        ContentLength: size,
      });
      const uploadUrl = await getSignedUrl(this.s3, cmd, { expiresIn: UPLOAD_TTL_SEC });
      return { uploadUrl, method: 'PUT', headers: { 'Content-Type': contentType }, key, publicUrl: this.publicUrl(key) };
    }
    const exp = Math.floor(Date.now() / 1000) + UPLOAD_TTL_SEC;
    const sig = this.sign(key, contentType, exp);
    const qs = new URLSearchParams({ key, ct: contentType, exp: String(exp), sig });
    return {
      uploadUrl: `${this.env.API_PUBLIC_URL}/api/uploads/local?${qs.toString()}`,
      method: 'PUT',
      headers: { 'Content-Type': contentType },
      key,
      publicUrl: this.publicUrl(key),
    };
  }

  /** True once the object exists (call before attaching a key to a record). */
  async exists(key: string): Promise<boolean> {
    if (this.s3) {
      try {
        await this.s3.send(new HeadObjectCommand({ Bucket: this.env.S3_BUCKET, Key: key }));
        return true;
      } catch {
        return false;
      }
    }
    const { access } = await import('node:fs/promises');
    return access(this.localPath(key)).then(
      () => true,
      () => false,
    );
  }

  async delete(key: string): Promise<void> {
    if (this.s3) {
      await this.s3.send(new DeleteObjectCommand({ Bucket: this.env.S3_BUCKET, Key: key }));
      return;
    }
    await unlink(this.localPath(key)).catch(() => undefined);
  }

  // ---- local driver ----

  verifyLocalUpload(key: string, contentType: string, exp: number, sig: string): boolean {
    if (!Number.isFinite(exp) || exp < Date.now() / 1000) return false;
    const expected = Buffer.from(this.sign(key, contentType, exp));
    const given = Buffer.from(sig);
    return expected.length === given.length && timingSafeEqual(expected, given);
  }

  async writeLocal(key: string, body: Buffer): Promise<void> {
    const file = this.localPath(key);
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, body);
  }

  private localPath(key: string): string {
    const file = path.resolve(LOCAL_UPLOAD_DIR, key);
    if (!file.startsWith(LOCAL_UPLOAD_DIR + path.sep)) throw new Error('Invalid storage key');
    return file;
  }

  private sign(key: string, contentType: string, exp: number): string {
    return createHmac('sha256', this.env.JWT_ACCESS_SECRET).update(`${key}\n${contentType}\n${exp}`).digest('hex');
  }
}
