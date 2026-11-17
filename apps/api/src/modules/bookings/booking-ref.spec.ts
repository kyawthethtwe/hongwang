import { generateBookingRef, REF_ALPHABET, REF_PATTERN } from './booking-ref';

describe('generateBookingRef', () => {
  it('produces BK- plus six symbols from the unambiguous alphabet', () => {
    for (let i = 0; i < 500; i++) expect(generateBookingRef()).toMatch(REF_PATTERN);
  });

  it('never uses look-alike characters', () => {
    expect(REF_ALPHABET).not.toMatch(/[01IO]/);
    expect(new Set(REF_ALPHABET).size).toBe(REF_ALPHABET.length);
  });

  it('maps the random source onto the alphabet', () => {
    let i = 0;
    expect(generateBookingRef(() => i++)).toBe('BK-ABCDEF');
    expect(generateBookingRef((max) => max - 1)).toBe('BK-999999');
  });

  it('is random enough that 2,000 refs do not collide', () => {
    const refs = new Set(Array.from({ length: 2000 }, () => generateBookingRef()));
    expect(refs.size).toBe(2000);
  });
});
