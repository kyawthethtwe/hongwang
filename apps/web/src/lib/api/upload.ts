import type { UploadTarget } from '@hongwang/shared';
import axios from 'axios';

/**
 * PUTs a file straight to storage: a presigned S3/R2 URL, or the API's local upload route in
 * development. Plain axios, not `api`: no /api base URL and no cookies. axios uses XMLHttpRequest in
 * the browser, which is what makes upload progress possible (fetch can't report it).
 * Rejects with an Error carrying the HTTP status when the upload fails.
 */
export async function uploadFile(
  target: Pick<UploadTarget, 'uploadUrl' | 'method' | 'headers'>,
  file: File,
  onProgress?: (percent: number) => void,
): Promise<void> {
  try {
    await axios.request({
      url: target.uploadUrl,
      method: target.method,
      headers: target.headers,
      data: file,
      onUploadProgress: (e) => onProgress?.(Math.min(100, Math.round((e.loaded / (e.total ?? file.size)) * 100))),
    });
  } catch (err) {
    const status = axios.isAxiosError(err) ? err.response?.status : undefined;
    throw new Error(`The upload didn’t go through${status ? ` (${status})` : ''}. Please try again.`, { cause: err });
  }
}
