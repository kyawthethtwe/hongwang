'use client';

import { LISTING_EDITOR_SECTIONS, type ListingEditorSection } from '@hongwang/shared';
import { Check } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { errorMessage } from '@/lib/api/client';
import { useSession } from '@/lib/auth/session';
import { useListingStatusAction } from '@/lib/queries/host';
import { Button } from '@/components/ui/button';
import { Banner } from '@/components/ui/feedback';
import { cn } from '@/lib/utils';
import { STEP_META, type SectionProps } from './shared';

/** Review and publish (design C4 last step): checklist, then POST /listings/:id/submit. */
export function FinishSection({ listing, onBack, onGo }: Pick<SectionProps, 'listing' | 'onBack'> & { onGo: (s: ListingEditorSection) => void }) {
  const router = useRouter();
  const { user } = useSession();
  const submit = useListingStatusAction();
  const canSubmitStatus = listing.status === 'draft' || listing.status === 'rejected';

  async function onSubmit() {
    try {
      const dto = await submit.mutateAsync({ id: listing.id, action: 'submit' });
      toast.success(
        dto.status === 'published'
          ? `${dto.title} is live.`
          : 'Submitted for review. We usually check new listings within 1 business day.',
      );
      router.push('/host/listings');
    } catch (err) {
      toast.error(errorMessage(err, 'Couldn’t submit the listing.'));
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <ul className="m-0 flex list-none flex-col p-0">
        {LISTING_EDITOR_SECTIONS.map((s) => {
          const done = listing.completeness[s];
          return (
            <li key={s} className="flex items-center justify-between gap-3 border-b border-line-soft py-3">
              <span className="flex items-center gap-2.5">
                <span
                  aria-hidden
                  className={cn(
                    'box-border inline-flex size-[22px] items-center justify-center rounded-full border-2 text-white',
                    done ? 'border-brand bg-brand' : 'border-line-strong bg-surface',
                  )}
                >
                  {done && <Check className="size-3.5" strokeWidth={3} />}
                </span>
                {STEP_META[s].title}
                <span className="sr-only">{done ? ', done' : ', to do'}</span>
              </span>
              {!done && (
                <Button variant="outline" size="sm" onClick={() => onGo(s)}>
                  Finish
                </Button>
              )}
            </li>
          );
        })}
      </ul>

      {listing.reviewNote && (
        <Banner tone="danger" title="Our team asked for changes:">
          {listing.reviewNote}
        </Banner>
      )}

      {user?.kycStatus === 'verified' ? (
        <p className="m-0 flex items-center gap-2 font-medium text-brand-hover">
          <Check aria-hidden className="size-4" strokeWidth={2.4} />
          Your identity is verified, so this listing can be published.
        </p>
      ) : (
        <p className="m-0 text-ink-2">
          Publishing needs a verified ID. <Link href="/host/onboarding">Check your hosting setup</Link>.
        </p>
      )}

      {canSubmitStatus ? (
        <div className="flex flex-col gap-2">
          <Button
            size="xl"
            className="self-start px-[26px]"
            disabled={!listing.canSubmit}
            loading={submit.isPending}
            onClick={onSubmit}
          >
            Submit for review
          </Button>
          {!listing.canSubmit && <p className="m-0 text-sm text-muted">Finish the sections above to submit.</p>}
        </div>
      ) : listing.status === 'in_review' ? (
        <Banner tone="warn" title="In review.">
          We’ll check photos, address and description, usually within 1 business day, and tell you by email.
        </Banner>
      ) : (
        <Banner tone="success" title={listing.status === 'paused' ? 'Paused.' : 'Live.'}>
          Your changes are saved. Price and calendar changes apply straight away.
        </Banner>
      )}

      <div className="flex flex-wrap justify-between gap-3 border-t border-line pt-4">
        <Button variant="outline" size="lg" onClick={onBack}>
          Back
        </Button>
        <Button asChild variant="dark" size="lg">
          <Link href="/host/listings">Back to listings</Link>
        </Button>
      </div>
    </div>
  );
}
