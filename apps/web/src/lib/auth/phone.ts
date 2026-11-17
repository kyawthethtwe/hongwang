/** Countries offered in the phone sign-in select (design A4). */
export const PHONE_COUNTRIES = [
  { code: '+66', iso: 'TH', example: '81 234 5678' },
  { code: '+95', iso: 'MM', example: '9 123 456 789' },
  { code: '+60', iso: 'MY', example: '12 345 6789' },
] as const;
export type PhoneCountryCode = (typeof PHONE_COUNTRIES)[number]['code'];

/** '+66' + '081 234 5678' -> '+66812345678' (drops spaces, dashes and the trunk 0). */
export function toE164(countryCode: string, national: string): string {
  const digits = national.replace(/\D/g, '').replace(/^0+/, '');
  return `${countryCode}${digits}`;
}

/** '+66812345678' -> '+66 81 234 5678' for display. */
export function formatPhone(e164: string): string {
  const country = PHONE_COUNTRIES.find((c) => e164.startsWith(c.code));
  if (!country) return e164;
  const n = e164.slice(country.code.length);
  const groups =
    n.length === 9 ? [n.slice(0, 2), n.slice(2, 5), n.slice(5)] : n.length === 10 ? [n.slice(0, 3), n.slice(3, 6), n.slice(6)] : [n];
  return `${country.code} ${groups.join(' ')}`;
}
