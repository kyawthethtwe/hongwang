import { parsePhoneNumberFromString, type CountryCode } from 'libphonenumber-js/mobile';
import { z } from 'zod';

/**
 * '@hongwang/shared/phone': phone numbers via libphonenumber-js with its mobile-only metadata.
 * Sign-in codes go by SMS, so only mobile numbers count as valid (a Bangkok landline is refused).
 * Numbers are stored and sent in E.164 ('+66812345678').
 *
 * This is a separate entry point, not part of '@hongwang/shared': the metadata is about 130 KB and
 * the root entry is in every page's bundle. Keep libphonenumber-js imports in entries like this one
 * (M1's contact masking too).
 */
export type PhoneCountry = CountryCode;

/**
 * A valid mobile number in E.164, or null.
 *   toE164Mobile('081 234 5678', 'TH')   // '+66812345678'
 *   toE164Mobile('+66 81 234 5678')      // '+66812345678'
 *   toE164Mobile('02 123 4567', 'TH')    // null (landline)
 */
export function toE164Mobile(input: string, defaultCountry?: PhoneCountry): string | null {
  const parsed = parsePhoneNumberFromString(input, defaultCountry);
  return parsed?.isValid() ? parsed.number : null;
}

/** True for a valid mobile number already written in E.164, e.g. '+66812345678'. */
export function isE164Mobile(value: string): boolean {
  return /^\+[1-9]\d{7,14}$/.test(value) && toE164Mobile(value) === value;
}

/** A real mobile number in E.164. The API's phone DTOs extend the contract's `phoneSchema` with it. */
export const mobilePhoneSchema = z.string().refine(isE164Mobile, 'Enter a mobile number in international format, e.g. +66812345678');

/** '+66812345678' -> '+66 81 234 5678' for display; anything it can't parse comes back unchanged. */
export function formatPhone(e164: string): string {
  return parsePhoneNumberFromString(e164)?.formatInternational() ?? e164;
}
