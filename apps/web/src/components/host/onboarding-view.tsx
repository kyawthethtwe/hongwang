'use client';

import {
  HOST_ID_DOCUMENT_LABELS,
  HOST_ID_DOCUMENTS,
  HOST_RELATION_LABELS,
  HOST_RELATIONS,
  HOST_ROOM_COUNT_LABELS,
  HOST_ROOM_COUNTS,
  type HostIdDocument,
  type HostOnboardingDto,
  type HostOnboardingInput,
} from '@hongwang/shared';
import { Check, Upload } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { errorMessage } from '@/lib/api/client';
import { useSession } from '@/lib/auth/session';
import { useHostOnboarding, useSaveOnboarding, useSubmitIdentity } from '@/lib/queries/host';
import { UserMenu } from '@/components/layout/user-menu';
import { Button } from '@/components/ui/button';
import { Badge, Banner } from '@/components/ui/feedback';
import { Field, Radio, RadioCard, Select } from '@/components/ui/field';
import { PageTitle } from '@/components/ui/surfaces';
import { cn } from '@/lib/utils';
import { CreateListingButton } from './create-listing-button';
import { FocusedHeader } from './focused-header';
import { PageSkeleton, QueryError } from './query-state';

type Step = 'about' | 'identity' | 'payouts' | 'review';
const STEPS: { id: Step; label: string; sub: string }[] = [
  { id: 'about', label: 'About you', sub: 'You and the place' },
  { id: 'identity', label: 'Verify your identity', sub: 'ID card or passport and a selfie' },
  { id: 'payouts', label: 'Get paid', sub: 'Bank account via Stripe' },
  { id: 'review', label: 'In review', sub: 'Usually within 1 business day' },
];

const UPLOAD_SLOTS: Record<HostIdDocument, { id: string; label: string; sub: string }[]> = {
  national_id: [
    { id: 'front', label: 'Front of card', sub: 'JPG or PNG, up to 10 MB' },
    { id: 'back', label: 'Back of card', sub: 'JPG or PNG, up to 10 MB' },
    { id: 'selfie', label: 'Selfie holding the card', sub: 'Face and card both visible' },
  ],
  passport: [
    { id: 'front', label: 'Photo page', sub: 'JPG or PNG, up to 10 MB' },
    { id: 'selfie', label: 'Selfie holding your passport', sub: 'Face and document both visible' },
  ],
};

function firstStep(o: HostOnboardingDto): Step {
  if (!o.steps.about) return 'about';
  if (!o.steps.identity) return 'identity';
  return 'review';
}

function AboutStep({ onboarding, onNext }: { onboarding: HostOnboardingDto; onNext: () => void }) {
  const save = useSaveOnboarding();
  const [relation, setRelation] = useState<HostOnboardingInput['relation'] | null>(onboarding.relation);
  const [roomCount, setRoomCount] = useState<HostOnboardingInput['roomCount']>(onboarding.roomCount ?? '1');
  const [touched, setTouched] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setTouched(true);
    if (!relation) return;
    try {
      await save.mutateAsync({ relation, roomCount });
      onNext();
    } catch (err) {
      toast.error(errorMessage(err));
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-5" noValidate>
      <h2 className="m-0 text-[22px] font-semibold">About you</h2>
      <fieldset className="m-0 flex flex-col gap-2.5 border-0 p-0" aria-describedby={touched && !relation ? 'relation-error' : undefined}>
        <legend className="mb-2 p-0 font-semibold">How are you connected to the place?</legend>
        {HOST_RELATIONS.map((r) => (
          <label key={r} className="flex min-h-11 cursor-pointer items-center gap-2.5">
            <Radio name="relation" value={r} checked={relation === r} onChange={() => setRelation(r)} />
            {HOST_RELATION_LABELS[r]}
          </label>
        ))}
        {touched && !relation && (
          <p id="relation-error" role="alert" className="m-0 text-[13px] font-medium text-danger-ink">
            Choose one
          </p>
        )}
      </fieldset>
      <Field label="How many rooms will you list?" className="max-w-60">
        {(p) => (
          <Select {...p} value={roomCount} onChange={(e) => setRoomCount(e.target.value as HostOnboardingInput['roomCount'])}>
            {HOST_ROOM_COUNTS.map((c) => (
              <option key={c} value={c}>
                {HOST_ROOM_COUNT_LABELS[c]}
              </option>
            ))}
          </Select>
        )}
      </Field>
      <Button type="submit" size="lg" className="self-start px-[22px]" loading={save.isPending}>
        Continue
      </Button>
    </form>
  );
}

function IdentityStep({ name, onNext }: { name: string; onNext: () => void }) {
  const submit = useSubmitIdentity();
  const [doc, setDoc] = useState<HostIdDocument>('national_id');
  const [files, setFiles] = useState<Record<string, string>>({});

  async function onContinue() {
    try {
      await submit.mutateAsync({ documentType: doc });
      onNext();
    } catch (err) {
      toast.error(errorMessage(err));
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="m-0 text-[22px] font-semibold">Verify your identity</h2>
        <p className="m-0 mt-1 text-ink-2">Guests book with more confidence when hosts are verified. This takes about 3 minutes.</p>
      </div>
      <Banner tone="info">
        Real ID review comes later. For now we only record that you’ve started the check: the files you pick here stay
        on your device and aren’t uploaded.
      </Banner>
      <fieldset className="m-0 grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-2.5 border-0 p-0">
        <legend className="mb-2 p-0 font-semibold">Document</legend>
        {HOST_ID_DOCUMENTS.map((d) => (
          <RadioCard
            key={d}
            name="document"
            value={d}
            checked={doc === d}
            onChange={() => {
              setDoc(d);
              setFiles({});
            }}
            title={HOST_ID_DOCUMENT_LABELS[d]}
          />
        ))}
      </fieldset>
      <div className="grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-3">
        {UPLOAD_SLOTS[doc].map((slot) => {
          const picked = files[slot.id];
          return (
            <label
              key={slot.id}
              className={cn(
                'relative flex min-h-[150px] cursor-pointer flex-col items-center justify-center gap-2 rounded-[14px] border-2 border-dashed p-4 text-center focus-within:outline-2 focus-within:outline-brand',
                picked ? 'border-brand bg-brand-soft' : 'border-line-strong bg-canvas',
              )}
            >
              {picked ? (
                <Check aria-hidden className="size-6 text-brand" />
              ) : (
                <Upload aria-hidden className="size-6 text-muted" />
              )}
              <span className="font-semibold">{slot.label}</span>
              <span className="text-[13px] text-muted">{picked ? `${picked} · tap to replace` : slot.sub}</span>
              <input
                type="file"
                accept="image/*"
                className="absolute size-px opacity-0"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) setFiles((prev) => ({ ...prev, [slot.id]: f.name }));
                }}
              />
            </label>
          );
        })}
      </div>
      <ul className="m-0 flex flex-col gap-1 pl-[18px] text-sm text-ink-2">
        <li>All four corners in the frame, no glare on the photo</li>
        <li>The name must match your account: {name}</li>
        <li>Only our trust team will see these files. We delete them 90 days after approval.</li>
      </ul>
      <Button size="lg" className="self-start px-[22px]" loading={submit.isPending} onClick={onContinue}>
        Continue
      </Button>
    </div>
  );
}

function PayoutsStep({ connected, onNext }: { connected: boolean; onNext: () => void }) {
  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="m-0 text-[22px] font-semibold">Get paid</h2>
        <p className="m-0 mt-1 text-ink-2">
          Payouts go to your bank 24 hours after each guest checks in. Bank details are collected on Stripe’s secure
          page, not by Hongwang.
        </p>
      </div>
      {connected ? (
        <Banner tone="success" title="Payouts connected.">
          Payouts arrive in Thai baht.
        </Banner>
      ) : (
        <div className="flex flex-wrap items-center gap-3">
          <Button size="lg" disabled>
            Set up payouts with Stripe
          </Button>
          <Badge tone="info">Coming soon</Badge>
          <p className="m-0 w-full text-sm text-muted">
            Stripe Connect payouts arrive in phase 2. You can carry on: your earnings are tracked in the meantime.
          </p>
        </div>
      )}
      <Button size="lg" className="self-start px-[22px]" onClick={onNext}>
        Continue
      </Button>
    </div>
  );
}

function ReviewStep({ kyc }: { kyc: HostOnboardingDto['kycStatus'] }) {
  const verified = kyc === 'verified';
  return (
    <div className="flex flex-col gap-3.5">
      <Badge tone={verified ? 'brand' : 'warn'} className="self-start px-3 text-[13px]">
        {verified ? 'Verified' : 'In review'}
      </Badge>
      <h2 className="m-0 text-[22px] font-semibold">{verified ? 'Your ID is verified' : 'We’re checking your ID'}</h2>
      <p className="m-0 text-ink-2">
        {verified
          ? 'You can publish listings as soon as they pass our listing review.'
          : 'Most checks finish within 1 business day. We’ll email you when it’s done. If a photo isn’t clear, you’ll be asked to retake just that one.'}
      </p>
      <div className="flex flex-wrap gap-2.5">
        <CreateListingButton icon={false} className="px-5">
          Draft your first listing
        </CreateListingButton>
        <Button asChild variant="outline-dark" size="lg" className="px-5">
          <Link href="/host">Go to dashboard</Link>
        </Button>
      </div>
    </div>
  );
}

/** Become a host: about you, ID check, payouts, in review (design C1). */
export function OnboardingView() {
  const { user } = useSession();
  const { data, error, isLoading, refetch } = useHostOnboarding();
  const [step, setStep] = useState<Step | null>(null);

  useEffect(() => {
    if (data && step === null) setStep(firstStep(data));
  }, [data, step]);

  const current = step ?? 'about';
  const reached = (s: Step) => {
    if (!data) return s === 'about';
    const order = STEPS.findIndex((x) => x.id === s);
    const furthest = STEPS.findIndex((x) => x.id === firstStep(data));
    return order <= Math.max(furthest, STEPS.findIndex((x) => x.id === current));
  };
  const done = (s: Step) =>
    !!data && (s === 'about' ? data.steps.about : s === 'identity' ? data.steps.identity : s === 'payouts' ? data.steps.payouts : false);
  const name = user ? `${user.firstName} ${user.lastName ? `${user.lastName[0]}.` : ''}`.trim() : 'your name';

  return (
    <>
      <FocusedHeader
        hosting
        actions={
          <>
            <Button asChild variant="ghost" shape="pill">
              <Link href="/host">Save and exit</Link>
            </Button>
            <UserMenu mode="host" />
          </>
        }
      />
      <main className="mx-auto box-border w-full max-w-[1120px] px-4 pt-8 pb-14 sm:px-10">
        <PageTitle>Set up hosting{user ? `, ${user.firstName}` : ''}</PageTitle>
        <p className="m-0 mt-1 mb-7 text-ink-2">
          You can draft listings right away. Publishing unlocks once we’ve checked your ID.
        </p>
        {isLoading ? (
          <PageSkeleton rows={2} />
        ) : error || !data ? (
          <QueryError error={error} retry={() => void refetch()} what="hosting setup" />
        ) : (
          <div className="flex flex-wrap items-start gap-8">
            <nav aria-label="Setup steps" className="max-w-[280px] flex-[1_1_240px]">
              <ol className="m-0 flex list-none flex-col gap-1 p-0">
                {STEPS.map((s, i) => {
                  const isCurrent = s.id === current;
                  const isDone = done(s.id) && !isCurrent;
                  return (
                    <li key={s.id}>
                      <button
                        type="button"
                        aria-current={isCurrent ? 'step' : undefined}
                        disabled={!reached(s.id)}
                        onClick={() => setStep(s.id)}
                        className={cn(
                          'flex min-h-14 w-full cursor-pointer items-center gap-3 rounded-button border-0 px-3 py-2 text-left text-ink disabled:cursor-not-allowed disabled:opacity-60',
                          isCurrent ? 'bg-surface' : 'bg-transparent hover:bg-subtle',
                        )}
                      >
                        <span
                          aria-hidden
                          className={cn(
                            'box-border flex size-7 flex-none items-center justify-center rounded-full border-2 text-[13px] font-bold',
                            isDone
                              ? 'border-brand bg-brand text-white'
                              : isCurrent
                                ? 'border-brand bg-surface text-brand'
                                : 'border-line-strong bg-surface text-muted',
                          )}
                        >
                          {isDone ? <Check className="size-4" /> : i + 1}
                        </span>
                        <span className="flex flex-col">
                          <span className="font-semibold">
                            {s.label}
                            {isDone && <span className="sr-only"> (done)</span>}
                          </span>
                          <span className="text-[13px] text-muted">{s.sub}</span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ol>
            </nav>
            <section
              aria-label={STEPS.find((s) => s.id === current)!.label}
              className="box-border flex min-w-0 flex-[999_1_520px] flex-col gap-5 rounded-sheet border border-line bg-surface p-5 sm:p-7"
            >
              {current === 'about' && <AboutStep onboarding={data} onNext={() => setStep('identity')} />}
              {current === 'identity' && <IdentityStep name={name} onNext={() => setStep('payouts')} />}
              {current === 'payouts' && <PayoutsStep connected={data.payoutsConnected} onNext={() => setStep('review')} />}
              {current === 'review' && <ReviewStep kyc={data.kycStatus} />}
            </section>
          </div>
        )}
      </main>
    </>
  );
}
