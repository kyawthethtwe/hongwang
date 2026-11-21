// The separate entry keeps libphonenumber-js metadata to the pages that import this file.
import { formatPhone, toE164Mobile, type PhoneCountry } from '@hongwang/shared/phone';

/** Countries offered in the phone sign-in select (design A4). `example` is the input's placeholder. */
export const PHONE_COUNTRIES = [
  { code: '+66', iso: 'TH', example: '81 234 5678' },
  { code: '+95', iso: 'MM', example: '9 212 3456' },
  { code: '+60', iso: 'MY', example: '12 345 6789' },
] as const satisfies readonly { code: string; iso: PhoneCountry; example: string }[];
export type PhoneCountryCode = (typeof PHONE_COUNTRIES)[number]['code'];

/**
 * '+66' + '081 234 5678' -> '+66812345678'. Null unless it's a valid mobile number (libphonenumber-js,
 * see packages/shared/src/phone.ts), so the form can show "Check the number" before sending.
 */
export function toE164(countryCode: string, national: string): string | null {
  const country = PHONE_COUNTRIES.find((c) => c.code === countryCode);
  return country ? toE164Mobile(national, country.iso) : null;
}

/** '+66812345678' -> '+66 81 234 5678' for display. */
export { formatPhone };
