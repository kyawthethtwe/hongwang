'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import {
  PROPERTY_TYPE_LABELS,
  PROPERTY_TYPES,
  ROOM_TYPE_LABELS,
  ROOM_TYPES,
  updateListingInputSchema,
} from '@hongwang/shared';
import { Controller, useForm } from 'react-hook-form';
import { Field, Input, RadioCard, Select, Textarea } from '@/components/ui/field';
import { Stepper } from '@/components/ui/stepper';
import { msg, numberOrNull, SectionFooter, useSectionSave, type SectionProps } from './shared';

const schema = updateListingInputSchema
  .pick({
    title: true,
    roomType: true,
    propertyType: true,
    sizeSqm: true,
    maxGuests: true,
    bedrooms: true,
    beds: true,
    bathrooms: true,
    description: true,
  })
  .required();

const ROOM_TYPE_SUB = {
  entire_place: 'The whole place to themselves',
  private_room: 'Their own room, shared spaces',
  shared_room: 'A bed in a shared room',
} as const;

export function BasicsSection(props: SectionProps) {
  const { listing } = props;
  const form = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      title: listing.title,
      roomType: listing.roomType,
      propertyType: listing.propertyType,
      sizeSqm: listing.sizeSqm,
      maxGuests: listing.maxGuests,
      bedrooms: listing.bedrooms,
      beds: listing.beds,
      bathrooms: listing.bathrooms,
      description: listing.description,
    },
  });
  const { register, control, handleSubmit, watch, formState } = form;
  const { errors } = formState;
  const { save, saving } = useSectionSave(listing, form, props);
  const title = watch('title') ?? '';
  const roomType = watch('roomType');

  return (
    <form
      noValidate
      className="flex flex-col gap-5"
      onSubmit={handleSubmit(async (v) => {
        if (await save(v)) props.onNext();
      })}
    >
      <Field label="Title" hint={`${title.length} of 60 characters`} error={msg(errors.title)}>
        {(p) => <Input {...p} maxLength={60} placeholder="e.g. Sunny studio near BTS Ari" {...register('title')} />}
      </Field>

      <fieldset className="m-0 border-0 p-0">
        <legend className="mb-2 p-0 text-sm font-semibold">What guests get</legend>
        <div className="grid grid-cols-[repeat(auto-fit,minmax(170px,1fr))] gap-2.5">
          {ROOM_TYPES.map((t) => (
            <RadioCard
              key={t}
              value={t}
              checked={roomType === t}
              title={ROOM_TYPE_LABELS[t]}
              sub={ROOM_TYPE_SUB[t]}
              {...register('roomType')}
            />
          ))}
        </div>
      </fieldset>

      <div className="grid grid-cols-[repeat(auto-fit,minmax(150px,1fr))] gap-3.5">
        <Field label="Property type" error={msg(errors.propertyType)}>
          {(p) => (
            <Select {...p} {...register('propertyType')}>
              {PROPERTY_TYPES.map((t) => (
                <option key={t} value={t}>
                  {PROPERTY_TYPE_LABELS[t]}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Size (m²)" error={msg(errors.sizeSqm)}>
          {(p) => (
            <Input {...p} type="number" inputMode="numeric" min={5} {...register('sizeSqm', { setValueAs: numberOrNull })} />
          )}
        </Field>
      </div>

      <div className="grid grid-cols-[repeat(auto-fit,minmax(150px,1fr))] gap-3.5">
        <Controller
          control={control}
          name="maxGuests"
          render={({ field, fieldState }) => (
            <Stepper label="Guests" value={field.value} onChange={field.onChange} min={1} max={16} error={msg(fieldState.error)} />
          )}
        />
        <Controller
          control={control}
          name="bedrooms"
          render={({ field, fieldState }) => (
            <Stepper label="Bedrooms" value={field.value} onChange={field.onChange} min={0} max={20} error={msg(fieldState.error)} />
          )}
        />
        <Controller
          control={control}
          name="beds"
          render={({ field, fieldState }) => (
            <Stepper label="Beds" value={field.value} onChange={field.onChange} min={1} max={30} error={msg(fieldState.error)} />
          )}
        />
        <Controller
          control={control}
          name="bathrooms"
          render={({ field, fieldState }) => (
            <Stepper
              label="Bathrooms"
              value={field.value}
              onChange={field.onChange}
              min={0}
              max={20}
              step={0.5}
              error={msg(fieldState.error)}
            />
          )}
        />
      </div>

      <Field label="Description" error={msg(errors.description)} hint="A few sentences about the room, the building and the street.">
        {(p) => (
          <Textarea {...p} rows={5} maxLength={4000} placeholder="What makes the room and the street special?" {...register('description')} />
        )}
      </Field>

      <SectionFooter onBack={props.onBack} saving={saving} />
    </form>
  );
}
