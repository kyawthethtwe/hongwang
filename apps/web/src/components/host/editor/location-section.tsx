'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { updateListingInputSchema } from '@hongwang/shared';
import dynamic from 'next/dynamic';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';
import { Skeleton } from '@/components/ui/feedback';
import { Field, Input, Select } from '@/components/ui/field';
import { msg, numberOrNull, SectionFooter, useSectionSave, type SectionProps } from './shared';

const LocationMap = dynamic(() => import('./location-map'), {
  ssr: false,
  loading: () => <Skeleton className="size-full rounded-none" />,
});

const S = updateListingInputSchema.shape;
const schema = z.object({
  addressLine: S.addressLine.unwrap(),
  subdistrict: S.subdistrict.unwrap(),
  district: S.district.unwrap(),
  province: S.province.unwrap().min(1, 'Choose a province'),
  // Drafts may not know the postcode yet: '' is saved as "not set".
  postcode: z.union([z.literal(''), S.postcode.unwrap()], { error: 'Use the 5-digit postcode' }),
  area: S.area.unwrap(),
  nearestStation: z.string().trim().max(80),
  stationWalkMinutes: S.stationWalkMinutes.unwrap(),
  exactLocation: S.exactLocation.unwrap().nullable(),
});

const PROVINCES = ['Bangkok', 'Nonthaburi', 'Samut Prakan', 'Pathum Thani', 'Chon Buri', 'Chiang Mai', 'Phuket'];

const STATIONS = [
  'BTS Ari', 'BTS Saphan Khwai', 'BTS Sanam Pao', 'BTS Victory Monument', 'BTS Phaya Thai', 'BTS Ratchathewi',
  'BTS Siam', 'BTS Chit Lom', 'BTS Phloen Chit', 'BTS Nana', 'BTS Asok', 'BTS Phrom Phong', 'BTS Thong Lo',
  'BTS Ekkamai', 'BTS Phra Khanong', 'BTS On Nut', 'BTS Sala Daeng', 'BTS Chong Nonsi', 'BTS Surasak',
  'BTS Saphan Taksin', 'BTS Krung Thon Buri', 'MRT Sukhumvit', 'MRT Silom', 'MRT Lumphini', 'MRT Sam Yan',
  'MRT Hua Lamphong', 'MRT Wat Mangkon', 'MRT Sam Yot', 'MRT Sanam Chai', 'MRT Chatuchak Park',
  'MRT Phahon Yothin', 'MRT Huai Khwang', 'MRT Phra Ram 9', 'Airport Rail Link Makkasan',
];

export function LocationSection(props: SectionProps) {
  const { listing } = props;
  const form = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      addressLine: listing.addressLine ?? '',
      subdistrict: listing.subdistrict ?? '',
      district: listing.district ?? '',
      province: listing.province || 'Bangkok',
      postcode: listing.postcode ?? '',
      area: listing.area,
      nearestStation: listing.nearestStation ?? '',
      stationWalkMinutes: listing.stationWalkMinutes,
      exactLocation: listing.exactLocation,
    },
  });
  const { register, control, handleSubmit, formState } = form;
  const { errors } = formState;
  const { save, saving } = useSectionSave(listing, form, props);
  const provinces = PROVINCES.includes(listing.province) || !listing.province ? PROVINCES : [listing.province, ...PROVINCES];

  return (
    <form
      noValidate
      className="flex flex-col gap-5"
      onSubmit={handleSubmit(async (v) => {
        const station = v.nearestStation.trim();
        const dto = await save({
          addressLine: v.addressLine,
          subdistrict: v.subdistrict,
          district: v.district,
          province: v.province,
          area: v.area,
          ...(v.postcode ? { postcode: v.postcode } : {}),
          nearestStation: station || null,
          stationWalkMinutes: station ? v.stationWalkMinutes : null,
          ...(v.exactLocation ? { exactLocation: v.exactLocation } : {}),
        });
        if (dto) props.onNext();
      })}
    >
      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
        <Field label="Street address" className="sm:col-span-2" error={msg(errors.addressLine)} hint="Only guests with a confirmed booking see this.">
          {(p) => <Input {...p} autoComplete="street-address" {...register('addressLine')} />}
        </Field>
        <Field label="Subdistrict (khwaeng)" error={msg(errors.subdistrict)}>
          {(p) => <Input {...p} {...register('subdistrict')} />}
        </Field>
        <Field label="District (khet)" error={msg(errors.district)}>
          {(p) => <Input {...p} {...register('district')} />}
        </Field>
        <Field label="Province" error={msg(errors.province)}>
          {(p) => (
            <Select {...p} {...register('province')}>
              {provinces.map((pr) => (
                <option key={pr} value={pr}>
                  {pr}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Postcode" error={msg(errors.postcode)}>
          {(p) => <Input {...p} inputMode="numeric" maxLength={5} autoComplete="postal-code" {...register('postcode')} />}
        </Field>
        <Field label="Neighbourhood guests see" hint="e.g. Ari, Thong Lo, Talat Noi" error={msg(errors.area)}>
          {(p) => <Input {...p} maxLength={60} {...register('area')} />}
        </Field>
        <div className="hidden sm:block" />
        <Field label="Nearest train station" hint="Leave empty if none is within walking distance." error={msg(errors.nearestStation)}>
          {(p) => <Input {...p} list="station-options" placeholder="e.g. BTS Ari" {...register('nearestStation')} />}
        </Field>
        <Field label="Walk to the station (minutes)" error={msg(errors.stationWalkMinutes)}>
          {(p) => (
            <Input
              {...p}
              type="number"
              inputMode="numeric"
              min={0}
              max={120}
              {...register('stationWalkMinutes', { setValueAs: numberOrNull })}
            />
          )}
        </Field>
        <datalist id="station-options">
          {STATIONS.map((s) => (
            <option key={s} value={s} />
          ))}
        </datalist>
      </div>

      <Controller
        control={control}
        name="exactLocation"
        render={({ field, fieldState }) => (
          <div className="flex flex-col gap-2">
            <div className="relative h-[260px] overflow-hidden rounded-[14px] bg-map">
              <LocationMap value={field.value} onChange={field.onChange} />
              <span className="pointer-events-none absolute top-4 left-4 rounded-field bg-surface px-3 py-1.5 text-[13px] font-semibold shadow-pop">
                {field.value ? 'Drag the pin to your front door' : 'Tap the map at your front door'}
              </span>
            </div>
            {field.value && (
              <p className="m-0 text-[13px] text-muted font-tabular">
                Pin at {field.value.lat.toFixed(5)}, {field.value.lng.toFixed(5)}
              </p>
            )}
            {fieldState.error && (
              <p role="alert" className="m-0 text-[13px] font-medium text-danger-ink">
                {msg(fieldState.error) ?? 'Place the pin on the map'}
              </p>
            )}
          </div>
        )}
      />
      <p className="m-0 text-sm text-muted">Guests see only a rough area until their booking is confirmed.</p>

      <SectionFooter onBack={props.onBack} saving={saving} />
    </form>
  );
}
