'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { HOST_FEE_RATE, roundToBaht, toBaht, toSatang } from '@hongwang/shared';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { formatTHB } from '@/lib/format';
import { Field, Input } from '@/components/ui/field';
import { msg, SectionFooter, toNumber, useSectionSave, type SectionProps } from './shared';

// The form works in baht; the API takes satang (see money.ts).
const schema = z.object({
  basePrice: z.number({ error: 'Enter a nightly price' }).int('Whole baht only').min(100, 'At least ฿100 a night'),
  cleaningFee: z.number({ error: 'Enter 0 if there’s no cleaning fee' }).int('Whole baht only').min(0),
  weeklyDiscountPct: z.number({ error: 'Enter 0 for no discount' }).int().min(0).max(80, 'At most 80%'),
});

/** What the host keeps from one night at `priceSatang`, after the 5% host fee. */
export const hostEarns = (priceSatang: number) => priceSatang - roundToBaht(priceSatang * HOST_FEE_RATE);

export function PricingSection(props: SectionProps) {
  const { listing } = props;
  const form = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      basePrice: listing.basePrice ? toBaht(listing.basePrice) : Number.NaN,
      cleaningFee: toBaht(listing.cleaningFee),
      weeklyDiscountPct: listing.weeklyDiscountPct,
    },
  });
  const { register, handleSubmit, watch, formState } = form;
  const { errors } = formState;
  const { save, saving } = useSectionSave(listing, form, props);
  const price = watch('basePrice');
  const priceSatang = Number.isFinite(price) && price > 0 ? toSatang(price) : 0;

  return (
    <form
      noValidate
      className="flex flex-col gap-5"
      onSubmit={handleSubmit(async (v) => {
        const dto = await save({
          basePrice: toSatang(v.basePrice),
          cleaningFee: toSatang(v.cleaningFee),
          weeklyDiscountPct: v.weeklyDiscountPct,
        });
        if (dto) props.onNext();
      })}
    >
      <div className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-3.5">
        <Field label="Price per night (฿)" error={msg(errors.basePrice)}>
          {(p) => (
            <Input
              {...p}
              type="number"
              inputMode="numeric"
              min={100}
              placeholder="e.g. 1100"
              className="min-h-[52px] text-lg font-semibold"
              {...register('basePrice', { setValueAs: toNumber })}
            />
          )}
        </Field>
        <Field label="Cleaning fee per stay (฿)" error={msg(errors.cleaningFee)}>
          {(p) => (
            <Input {...p} type="number" inputMode="numeric" min={0} className="min-h-[52px]" {...register('cleaningFee', { setValueAs: toNumber })} />
          )}
        </Field>
        <Field label="Weekly discount (%)" hint="For stays of 7 nights or more" error={msg(errors.weeklyDiscountPct)}>
          {(p) => (
            <Input
              {...p}
              type="number"
              inputMode="numeric"
              min={0}
              max={80}
              className="min-h-[52px]"
              {...register('weeklyDiscountPct', { setValueAs: toNumber })}
            />
          )}
        </Field>
      </div>
      <div className="flex flex-col gap-1.5 rounded-[14px] bg-canvas px-[18px] py-4" aria-live="polite">
        <p className="m-0 font-semibold">
          {priceSatang
            ? `Guests see ${formatTHB(priceSatang)} a night. You earn ${formatTHB(hostEarns(priceSatang))} a night after the ${HOST_FEE_RATE * 100}% host fee.`
            : 'Enter a nightly price to see what you earn.'}
        </p>
        <p className="m-0 text-sm text-muted">
          Hongwang keeps {HOST_FEE_RATE * 100}% of the nightly total. Guests pay a separate service fee of about 10%.
          Special prices for single dates are set in the calendar.
        </p>
      </div>
      <SectionFooter onBack={props.onBack} saving={saving} />
    </form>
  );
}
