import { ERROR_CODES } from '@hongwang/shared';
import { parseIdempotencyKey } from './idempotency';

describe('parseIdempotencyKey', () => {
  it('is null when the header is absent', () => {
    expect(parseIdempotencyKey(undefined)).toBeNull();
  });

  it('accepts a UUID', () => {
    expect(parseIdempotencyKey('c0ffee00-1111-4222-8333-444455556666')).toBe('c0ffee00-1111-4222-8333-444455556666');
  });

  it.each([
    ['too short', 'abc'],
    ['too long', 'a'.repeat(129)],
    ['characters outside the allowed set', 'key with spaces 1234'],
    ['empty', ''],
  ])('rejects a key that is %s with 400 VALIDATION_FAILED', (_why, key) => {
    expect(() => parseIdempotencyKey(key)).toThrow(expect.objectContaining({ status: 400, code: ERROR_CODES.validation }));
  });

  it('rejects the header sent twice', () => {
    expect(() => parseIdempotencyKey(['c0ffee00-1111-4222-8333-444455556666', 'c0ffee00-1111-4222-8333-444455556667'])).toThrow(
      expect.objectContaining({ status: 400 }),
    );
  });
});
