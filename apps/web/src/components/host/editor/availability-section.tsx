'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { updateListingInputSchema } from '@hongwang/shared';
import Link from 'next/link';
import { useId } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { Field, Input, Select } from '@/components/ui/field';
import { Switch } from '@/components/ui/switch';
import { msg, SectionFooter, toNumber, useSectionSave, type SectionProps } from './shared';

const schema = updateListingInputSchema
  .pick({
    instantBook: true,
    minNights: true,
    maxNights: true,
    advanceNoticeDays: true,
    bookingWindowMonths: true,
    checkInFrom: true,
    checkOutBy: true,
  })
  .required()
  .refine((v) => v.maxNights >= v.minNights, { message: 'Must be at least the minimum', path: ['maxNights'] });

const NOTICE = [
  [0, 'Same day'],
  [1, '1 day'],
  [2, '2 days'],
  [3, '3 days'],
  [7, '7 days'],
] as const;

export function AvailabilitySection(props: SectionProps) {
  const { listing } = props;
  const switchId = useId();
  const form = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      instantBook: listing.instantBook,
      minNights: listing.minNights,
      maxNights: listing.maxNights,
      advanceNoticeDays: listing.advanceNoticeDays,
      bookingWindowMonths: listing.bookingWindowMonths as 3 | 6 | 12,
      checkInFrom: listing.checkInFrom,
      checkOutBy: listing.checkOutBy,
    },
  });
  const { register, control, handleSubmit, formState } = form;
  const { errors } = formState;
  const { save, saving } = useSectionSave(listing, form, props);

  return (
    <form
      noValidate
      className="flex flex-col gap-5"
      onSubmit={handleSubmit(async (v) => {
        if (await save(v)) props.onNext();
      })}
    >
      <Controller
        control={control}
        name="instantBook"
        render={({ field }) => (
          <div className="flex items-start gap-3 rounded-[14px] border border-line-card px-4 py-3.5">
            <span className="flex-1">
              <label htmlFor={switchId} className="block cursor-pointer font-semibold">
                Instant book
              </label>
              <span id={`${switchId}-desc`} className="block text-sm text-muted">
                Guests book and pay straight away, and the dates are held for 15 minutes while they pay. Turn it off to
                approve each request yourself within 24 hours.
              </span>
            </span>
            <Switch
              id={switchId}
              aria-describedby={`${switchId}-desc`}
              checked={field.value}
              onCheckedChange={field.onChange}
              className="mt-0.5"
            />
          </div>
        )}
      />
      <div className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-3.5">
        <Field label="Minimum nights" error={msg(errors.minNights)}>
          {(p) => <Input {...p} type="number" inputMode="numeric" min={1} max={365} {...register('minNights', { setValueAs: toNumber })} />}
        </Field>
        <Field label="Maximum nights" error={msg(errors.maxNights)}>
          {(p) => <Input {...p} type="number" inputMode="numeric" min={1} max={365} {...register('maxNights', { setValueAs: toNumber })} />}
        </Field>
        <Field label="Notice before arrival" error={msg(errors.advanceNoticeDays)}>
          {(p) => (
            <Select {...p} {...register('advanceNoticeDays', { setValueAs: Number })}>
              {NOTICE.map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Bookable up to" error={msg(errors.bookingWindowMonths)}>
          {(p) => (
            <Select {...p} {...register('bookingWindowMonths', { setValueAs: Number })}>
              <option value={3}>3 months ahead</option>
              <option value={6}>6 months ahead</option>
              <option value={12}>12 months ahead</option>
            </Select>
          )}
        </Field>
        <Field label="Check-in from" error={msg(errors.checkInFrom)}>
          {(p) => <Input {...p} type="time" {...register('checkInFrom')} />}
        </Field>
        <Field label="Check-out by" error={msg(errors.checkOutBy)}>
          {(p) => <Input {...p} type="time" {...register('checkOutBy')} />}
        </Field>
      </div>
      <p className="m-0 text-ink-2">
        Block single dates and set special prices in the <Link href={`/host/calendar?listingId=${listing.id}`}>calendar</Link>.
      </p>
      <SectionFooter onBack={props.onBack} saving={saving} />
    </form>
  );
}
