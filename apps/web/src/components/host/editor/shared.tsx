'use client';

import type { HostListingDto, ListingEditorSection, UpdateListingInput } from '@hongwang/shared';
import { useEffect } from 'react';
import type { FieldValues, Path, UseFormReturn } from 'react-hook-form';
import { toast } from 'sonner';
import { errorMessage, fieldErrors } from '@/lib/api/client';
import { useUpdateListing } from '@/lib/queries/host';
import { Button } from '@/components/ui/button';

export type EditorStep = ListingEditorSection | 'finish';

export const STEP_META: Record<EditorStep, { title: string; hint: string }> = {
  basics: { title: 'Basics', hint: 'The title and size guests see first.' },
  location: {
    title: 'Location',
    hint: 'Used for search and the map. The exact address stays private until a booking is confirmed.',
  },
  photos: { title: 'Photos', hint: 'Bright, wide shots of the room, the bathroom and the street.' },
  amenities: { title: 'Amenities', hint: 'Only tick what guests can use without asking.' },
  pricing: { title: 'Pricing', hint: 'You can change prices any time. Bookings already made keep their price.' },
  availability: { title: 'Availability', hint: 'Booking type, stay lengths, notice and check-in times.' },
  policies: { title: 'Rules and policy', hint: 'Set expectations and what happens if a guest cancels.' },
  finish: { title: 'Review and publish', hint: 'Our team checks every new listing before it goes live.' },
};

/** What every section gets from the editor. */
export interface SectionProps {
  listing: HostListingDto;
  /** After a successful save (updates the "saved" indicator). */
  onSaved: (dto: HostListingDto) => void;
  onNext: () => void;
  onBack?: () => void;
  /** Lets the editor warn before leaving a section with unsaved edits. */
  onDirtyChange: (dirty: boolean) => void;
}

/**
 * PATCH /listings/:id for one section. API field errors (VALIDATION_FAILED details) land on the
 * matching form fields; anything else is a toast. Resolves to the saved listing, or null.
 */
export function useSectionSave<T extends FieldValues>(listing: HostListingDto, form: UseFormReturn<T, unknown, unknown>, props: SectionProps) {
  const update = useUpdateListing(listing.id);
  const { onDirtyChange } = props;
  const dirty = form.formState.isDirty;
  useEffect(() => onDirtyChange(dirty), [dirty, onDirtyChange]);

  async function save(payload: UpdateListingInput) {
    try {
      const dto = await update.mutateAsync(payload);
      onDirtyChange(false);
      props.onSaved(dto);
      return dto;
    } catch (err) {
      const errs = fieldErrors(err);
      const paths = Object.keys(errs);
      for (const path of paths) form.setError(path as Path<T>, { type: 'server', message: errs[path] });
      toast.error(paths.length ? 'Some fields need fixing.' : errorMessage(err, 'Couldn’t save. Please try again.'));
      return null;
    }
  }
  return { save, saving: update.isPending };
}

/** Back / Save and continue (design C4 footer). */
export function SectionFooter({
  onBack,
  saving,
  submitLabel = 'Save and continue',
  onContinue,
}: {
  onBack?: () => void;
  saving?: boolean;
  submitLabel?: string;
  /** Without it the button submits the section's form. */
  onContinue?: () => void;
}) {
  return (
    <div className="flex flex-wrap justify-between gap-3 border-t border-line pt-4">
      <Button variant="outline" size="lg" onClick={onBack} disabled={!onBack}>
        Back
      </Button>
      <Button type={onContinue ? 'button' : 'submit'} size="lg" className="px-6" loading={saving} onClick={onContinue}>
        {submitLabel}
      </Button>
    </div>
  );
}

/** '' -> null, otherwise a number (for nullable number inputs). */
export const numberOrNull = (v: unknown) => (v === '' || v === null || v === undefined ? null : Number(v));
/** '' -> NaN so zod reports "expected number". */
export const toNumber = (v: unknown) => (v === '' || v === null || v === undefined ? Number.NaN : Number(v));

/** First error message of a field (react-hook-form error objects). */
export const msg = (e: { message?: unknown } | undefined) => (typeof e?.message === 'string' ? e.message : undefined);
