'use client';

import type { MeDto, UpdateProfileInput } from '@hongwang/shared';
import { toast } from 'sonner';
import { Field, Select } from '@/components/ui/field';
import { errorMessage } from '@/lib/api/client';
import { useUpdateProfile } from '@/lib/auth/queries';
import { Note, SectionHeading } from './section';

const LANGUAGES = [
  { value: 'en', label: 'English' },
  { value: 'th', label: 'ไทย', lang: 'th' },
] as const;
const CURRENCIES = [
  { value: 'THB', label: 'Thai baht (฿)' },
  { value: 'USD', label: 'US dollar ($)' },
  { value: 'SGD', label: 'Singapore dollar (S$)' },
] as const;
const TIMEZONES = [
  { value: 'Asia/Bangkok', label: 'Asia/Bangkok (UTC+7)' },
  { value: 'Asia/Singapore', label: 'Asia/Singapore (UTC+8)' },
] as const;

/** Language, currency and time zone; each change saves straight away. */
export function RegionSection({ user }: { user: MeDto }) {
  const update = useUpdateProfile();

  function save(patch: UpdateProfileInput) {
    update.mutate(patch, {
      onSuccess: () => toast.success('Saved'),
      onError: (err) => toast.error(errorMessage(err)),
    });
  }

  return (
    <div className="flex flex-col gap-5">
      <SectionHeading>Language and region</SectionHeading>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Language">
          {(p) => (
            <Select
              {...p}
              value={user.locale}
              disabled={update.isPending}
              onChange={(e) => save({ locale: e.currentTarget.value as UpdateProfileInput['locale'] })}
            >
              {LANGUAGES.map((o) => (
                <option key={o.value} value={o.value} lang={'lang' in o ? o.lang : undefined}>
                  {o.label}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Currency">
          {(p) => (
            <Select
              {...p}
              value={user.currency}
              disabled={update.isPending}
              onChange={(e) => save({ currency: e.currentTarget.value as UpdateProfileInput['currency'] })}
            >
              {CURRENCIES.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Time zone" className="sm:col-span-2">
          {(p) => (
            <Select
              {...p}
              value={user.timezone}
              disabled={update.isPending}
              onChange={(e) => save({ timezone: e.currentTarget.value as UpdateProfileInput['timezone'] })}
            >
              {TIMEZONES.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
          )}
        </Field>
      </div>
      <Note>You always pay in Thai baht. Other currencies are shown as estimates.</Note>
    </div>
  );
}
