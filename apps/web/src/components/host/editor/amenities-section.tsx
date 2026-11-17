'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { AMENITIES, AMENITY_LABELS, updateListingInputSchema, type Amenity } from '@hongwang/shared';
import { Controller, useForm } from 'react-hook-form';
import { Checkbox } from '@/components/ui/field';
import { cn } from '@/lib/utils';
import { msg, SectionFooter, useSectionSave, type SectionProps } from './shared';

const schema = updateListingInputSchema.pick({ amenities: true }).required();

export function AmenitiesSection(props: SectionProps) {
  const { listing } = props;
  const form = useForm({ resolver: zodResolver(schema), defaultValues: { amenities: listing.amenities } });
  const { save, saving } = useSectionSave(listing, form, props);

  return (
    <form
      noValidate
      className="flex flex-col gap-5"
      onSubmit={form.handleSubmit(async (v) => {
        if (await save(v)) props.onNext();
      })}
    >
      <Controller
        control={form.control}
        name="amenities"
        render={({ field, fieldState }) => {
          const on = new Set<Amenity>(field.value);
          return (
            <fieldset className="m-0 border-0 p-0">
              <legend className="sr-only">Amenities</legend>
              <div className="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-2.5">
                {AMENITIES.map((a) => (
                  <label
                    key={a}
                    className={cn(
                      'flex min-h-[52px] cursor-pointer items-center gap-2.5 rounded-button border-2 px-3.5',
                      on.has(a) ? 'border-brand' : 'border-line-card',
                    )}
                  >
                    <Checkbox
                      className="size-5"
                      checked={on.has(a)}
                      onChange={() => {
                        const next = new Set(on);
                        if (next.has(a)) next.delete(a);
                        else next.add(a);
                        field.onChange(AMENITIES.filter((x) => next.has(x)));
                      }}
                    />
                    {AMENITY_LABELS[a]}
                  </label>
                ))}
              </div>
              {fieldState.error && (
                <p role="alert" className="m-0 mt-2 text-[13px] font-medium text-danger-ink">
                  {msg(fieldState.error)}
                </p>
              )}
            </fieldset>
          );
        }}
      />
      <SectionFooter onBack={props.onBack} saving={saving} />
    </form>
  );
}
