'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { CANCELLATION_POLICIES, CANCELLATION_POLICY_INFO, updateListingInputSchema } from '@hongwang/shared';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Checkbox, Field, RadioCard, Textarea } from '@/components/ui/field';
import { msg, SectionFooter, useSectionSave, type SectionProps } from './shared';

const S = updateListingInputSchema.shape;
const schema = z.object({
  cancellationPolicy: S.cancellationPolicy.unwrap(),
  houseRules: z.object({
    smoking: z.boolean(),
    pets: z.boolean(),
    events: z.boolean(),
    notes: z.string().trim().max(1000),
  }),
});

const RULES = [
  ['smoking', 'Smoking allowed'],
  ['pets', 'Pets allowed'],
  ['events', 'Events allowed'],
] as const;

export function PoliciesSection(props: SectionProps) {
  const { listing } = props;
  const form = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      cancellationPolicy: listing.cancellationPolicy,
      houseRules: { ...listing.houseRules, notes: listing.houseRules.notes ?? '' },
    },
  });
  const { register, handleSubmit, watch, formState } = form;
  const { errors } = formState;
  const { save, saving } = useSectionSave(listing, form, props);
  const policy = watch('cancellationPolicy');

  return (
    <form
      noValidate
      className="flex flex-col gap-5"
      onSubmit={handleSubmit(async (v) => {
        const dto = await save({
          cancellationPolicy: v.cancellationPolicy,
          houseRules: { ...v.houseRules, notes: v.houseRules.notes || null },
        });
        if (dto) props.onNext();
      })}
    >
      <fieldset className="m-0 flex flex-col gap-2.5 border-0 p-0">
        <legend className="mb-2 p-0 font-semibold">Cancellation policy</legend>
        {CANCELLATION_POLICIES.map((p) => (
          <RadioCard
            key={p}
            value={p}
            checked={policy === p}
            title={CANCELLATION_POLICY_INFO[p].label}
            sub={CANCELLATION_POLICY_INFO[p].summary}
            {...register('cancellationPolicy')}
          />
        ))}
        <p className="m-0 text-sm text-muted">
          If you cancel a confirmed stay, the guest always gets a full refund and you pay a 10% fee.
        </p>
      </fieldset>
      <fieldset className="m-0 border-0 p-0">
        <legend className="mb-2 p-0 font-semibold">House rules</legend>
        <div className="flex flex-wrap gap-2.5">
          {RULES.map(([key, label]) => (
            <label key={key} className="flex min-h-12 flex-[1_1_180px] cursor-pointer items-center gap-2.5">
              <Checkbox className="size-5" {...register(`houseRules.${key}`)} />
              {label}
            </label>
          ))}
        </div>
      </fieldset>
      <Field
        label="Anything else guests should know?"
        hint="No phone numbers, LINE IDs or links. They’re removed in review."
        error={msg(errors.houseRules?.notes)}
      >
        {(p) => (
          <Textarea
            {...p}
            rows={3}
            maxLength={1000}
            placeholder="e.g. Shoes off inside. Quiet hours 22:00 to 07:00."
            {...register('houseRules.notes')}
          />
        )}
      </Field>
      <SectionFooter onBack={props.onBack} saving={saving} />
    </form>
  );
}
