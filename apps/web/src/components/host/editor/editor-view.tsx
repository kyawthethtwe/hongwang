'use client';

import { LISTING_EDITOR_SECTIONS, type HostListingDto } from '@hongwang/shared';
import Link from 'next/link';
import { parseAsStringLiteral, useQueryState } from 'nuqs';
import { useCallback, useRef, useState } from 'react';
import { useEditListing } from '@/lib/queries/host';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { FocusedHeader } from '../focused-header';
import { PageSkeleton, QueryError } from '../query-state';
import { LISTING_STATUS } from '../status-badge';
import { useNow } from '../use-now';
import { AmenitiesSection } from './amenities-section';
import { AvailabilitySection } from './availability-section';
import { BasicsSection } from './basics-section';
import { FinishSection } from './finish-section';
import { LocationSection } from './location-section';
import { PhotosSection } from './photos-section';
import { PoliciesSection } from './policies-section';
import { PricingSection } from './pricing-section';
import { STEP_META, type EditorStep, type SectionProps } from './shared';

const STEPS = [...LISTING_EDITOR_SECTIONS, 'finish'] as const satisfies readonly EditorStep[];

function savedAgo(ms: number, now: number) {
  const mins = Math.floor((now - ms) / 60_000);
  if (mins < 1) return 'saved just now';
  if (mins < 60) return `saved ${mins} min ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `saved ${hours} h ago`;
  return `saved ${new Date(ms).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`;
}

const SECTIONS: Record<Exclude<EditorStep, 'finish'>, (p: SectionProps) => React.ReactNode> = {
  basics: BasicsSection,
  location: LocationSection,
  photos: PhotosSection,
  amenities: AmenitiesSection,
  pricing: PricingSection,
  availability: AvailabilitySection,
  policies: PoliciesSection,
};

/** Listing editor, one section at a time (design C4). `?section=` keeps the step in the URL. */
export function EditorView({ id }: { id: string }) {
  const { data: listing, error, isLoading, refetch } = useEditListing(id);
  const [step, setStep] = useQueryState('section', parseAsStringLiteral(STEPS).withDefault('basics'));
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const dirty = useRef(false);
  const now = useNow(30_000);

  const onDirtyChange = useCallback((d: boolean) => {
    dirty.current = d;
  }, []);
  const onSaved = useCallback((_dto: HostListingDto) => setSavedAt(Date.now()), []);

  function go(next: EditorStep, ask = true) {
    if (next === step) return;
    if (ask && dirty.current && !window.confirm('You have unsaved changes in this section. Leave without saving?')) return;
    dirty.current = false;
    void setStep(next);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  const index = STEPS.indexOf(step);
  const doneCount = listing ? LISTING_EDITOR_SECTIONS.filter((s) => listing.completeness[s]).length : 0;
  const total = LISTING_EDITOR_SECTIONS.length;
  const lastSaved = savedAt ?? (listing ? Date.parse(listing.updatedAt) : null);

  return (
    <>
      <FocusedHeader
        status={
          listing && (
            <span>
              {listing.title || 'Untitled listing'} ·{' '}
              <span className="text-muted" aria-live="polite">
                {LISTING_STATUS[listing.status].label}
                {lastSaved ? `, ${savedAgo(lastSaved, Math.max(now, savedAt ?? 0))}` : ''}
              </span>
            </span>
          )
        }
        actions={
          <>
            <Button asChild variant="outline" className="font-medium">
              <Link href={`/rooms/${id}`} target="_blank" rel="noopener">
                Preview
              </Link>
            </Button>
            <Button asChild variant="ghost">
              <Link
                href="/host/listings"
                onClick={(e) => {
                  // Sections save on "Save and continue"; don't drop edits silently.
                  if (dirty.current && !window.confirm('You have unsaved changes in this section. Leave without saving?')) {
                    e.preventDefault();
                  }
                }}
              >
                Save and exit
              </Link>
            </Button>
          </>
        }
      />
      <div className="mx-auto box-border flex w-full max-w-[1200px] flex-wrap items-start gap-8 px-4 pt-7 pb-14 sm:px-10">
        {isLoading ? (
          <div className="w-full">
            <PageSkeleton rows={3} />
          </div>
        ) : error || !listing ? (
          <div className="w-full">
            <QueryError error={error} retry={() => void refetch()} what="this listing" />
          </div>
        ) : (
          <>
            <nav aria-label="Listing sections" className="flex max-w-full flex-[1_1_240px] flex-col gap-1.5 md:max-w-[280px]">
              <p className="m-0 mb-1.5 text-sm font-semibold text-ink-2">
                {doneCount} of {total} sections done
              </p>
              <div
                role="progressbar"
                aria-label="Sections done"
                aria-valuemin={0}
                aria-valuemax={total}
                aria-valuenow={doneCount}
                className="mb-2.5 h-1.5 rounded-full bg-line"
              >
                <div className="h-1.5 rounded-full bg-brand transition-[width]" style={{ width: `${(doneCount / total) * 100}%` }} />
              </div>
              <ol className="m-0 flex list-none flex-col gap-0.5 p-0">
                {STEPS.map((s) => {
                  const current = s === step;
                  const done = s !== 'finish' && listing.completeness[s];
                  return (
                    <li key={s}>
                      <button
                        type="button"
                        aria-current={current ? 'step' : undefined}
                        onClick={() => go(s)}
                        className={cn(
                          'flex min-h-11 w-full cursor-pointer items-center justify-between gap-2.5 rounded-field border-0 px-3 text-left text-ink',
                          current ? 'bg-surface font-semibold' : 'bg-transparent font-medium hover:bg-subtle',
                        )}
                      >
                        {STEP_META[s].title}
                        {s !== 'finish' && (
                          <span className={cn('text-[13px] font-semibold', done ? 'text-brand-hover' : 'text-warn-ink')}>
                            {done ? '✓ Done' : 'To do'}
                          </span>
                        )}
                      </button>
                    </li>
                  );
                })}
              </ol>
            </nav>

            <section
              aria-labelledby="section-title"
              className="box-border flex min-w-0 flex-[999_1_560px] flex-col gap-5 rounded-sheet border border-line bg-surface p-5 sm:p-7"
            >
              <div>
                <h1 id="section-title" className="m-0 font-display text-[28px] leading-[1.2] font-bold tracking-[-0.02em]">
                  {STEP_META[step].title}
                </h1>
                <p className="m-0 mt-1 text-ink-2">{STEP_META[step].hint}</p>
              </div>
              {step === 'finish' ? (
                <FinishSection listing={listing} onBack={() => go(STEPS[index - 1]!, false)} onGo={(s) => go(s, false)} />
              ) : (
                (() => {
                  const Section = SECTIONS[step];
                  return (
                    <Section
                      key={`${listing.id}:${step}`}
                      listing={listing}
                      onSaved={onSaved}
                      onDirtyChange={onDirtyChange}
                      onNext={() => go(STEPS[index + 1]!, false)}
                      onBack={index > 0 ? () => go(STEPS[index - 1]!) : undefined}
                    />
                  );
                })()
              )}
            </section>
          </>
        )}
      </div>
    </>
  );
}
