import { randomInt } from 'node:crypto';

/** No 0/O, 1/I: easy to read out over the phone. 32 symbols, 6 of them: ~1 billion refs. */
export const REF_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const REF_PATTERN = /^BK-[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/;

/** Human booking reference, e.g. BK-7F3K2Q. Uniqueness is the `bookings_ref_unique` constraint. */
export function generateBookingRef(random: (max: number) => number = randomInt): string {
  let out = 'BK-';
  for (let i = 0; i < 6; i++) out += REF_ALPHABET[random(REF_ALPHABET.length)];
  return out;
}

/** Name of the unique constraint on bookings.ref (migrations/0001_init.sql). */
export const REF_UNIQUE_CONSTRAINT = 'bookings_ref_unique';
