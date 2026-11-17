import { decodeCursor, encodeCursor } from './cursor';

describe('search cursor', () => {
  it('round-trips offsets', () => {
    for (const o of [0, 1, 24, 48, 9999]) expect(decodeCursor(encodeCursor(o))).toBe(o);
  });

  it('is opaque url-safe text', () => {
    expect(encodeCursor(24)).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it('treats a missing cursor as the first page', () => {
    expect(decodeCursor(undefined)).toBe(0);
    expect(decodeCursor('')).toBe(0);
  });

  it('rejects cursors that are not ours', () => {
    expect(decodeCursor('not-base64-json')).toBeNull();
    expect(decodeCursor(Buffer.from('{"o":-1}').toString('base64url'))).toBeNull();
    expect(decodeCursor(Buffer.from('{"o":1.5}').toString('base64url'))).toBeNull();
    expect(decodeCursor(Buffer.from('{"o":"3"}').toString('base64url'))).toBeNull();
    expect(decodeCursor(Buffer.from('[]').toString('base64url'))).toBeNull();
    expect(decodeCursor(Buffer.from('{"o":1000000}').toString('base64url'))).toBeNull();
  });
});
