'use client';

import type { HostOnboardingDto } from '@hongwang/shared';
import { useQueryClient } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';
import { apiFetch, errorMessage } from '@/lib/api/client';
import { hostKeys, useCreateListing } from '@/lib/queries/host';
import { Button, type ButtonProps } from '@/components/ui/button';

/**
 * "Create listing": POST /listings, then the editor. With `requireOnboarding`, a host who hasn't
 * answered "About you" (users.host_profile) is sent to /host/onboarding first.
 */
export function CreateListingButton({
  requireOnboarding = false,
  children = 'Create listing',
  icon = true,
  ...props
}: Omit<ButtonProps, 'onClick'> & { requireOnboarding?: boolean; icon?: boolean }) {
  const router = useRouter();
  const qc = useQueryClient();
  const create = useCreateListing();
  const [checking, setChecking] = useState(false);

  async function onClick() {
    try {
      if (requireOnboarding) {
        setChecking(true);
        const onboarding = await qc.fetchQuery({
          queryKey: hostKeys.onboarding(),
          queryFn: () => apiFetch<HostOnboardingDto>('/host/onboarding'),
        });
        if (!onboarding.steps.about) {
          router.push('/host/onboarding');
          return;
        }
      }
      const listing = await create.mutateAsync();
      router.push(`/host/listings/${listing.id}/edit`);
    } catch (err) {
      toast.error(errorMessage(err, 'Couldn’t create the listing. Please try again.'));
    } finally {
      setChecking(false);
    }
  }

  return (
    <Button size="lg" loading={checking || create.isPending} onClick={onClick} {...props}>
      {icon && <Plus aria-hidden className="size-[18px]" />}
      {children}
    </Button>
  );
}
