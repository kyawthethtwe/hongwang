'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge, Banner } from '@/components/ui/feedback';
import { Dialog, DialogClose, DialogFooter } from '@/components/ui/overlays';
import { ApiError, apiFetch, errorMessage } from '@/lib/api/client';
import { sessionKey } from '@/lib/auth/session';
import { SectionHeading, SettingRow } from './section';

export function PrivacySection() {
  return (
    <div className="flex flex-col gap-5">
      <SectionHeading>Privacy and data</SectionHeading>
      <SettingRow
        title={
          <span className="inline-flex flex-wrap items-center gap-2">
            Download your data <Badge>Coming soon</Badge>
          </span>
        }
        sub="Bookings, messages and reviews as a ZIP file, emailed within 48 hours"
        action={
          <Button variant="outline" className="font-medium" disabled aria-describedby="download-soon">
            Request download
          </Button>
        }
      />
      <span id="download-soon" className="sr-only">
        Data downloads are coming soon.
      </span>
      <div className="flex flex-col gap-2 rounded-[14px] border border-danger-line bg-surface p-[18px]">
        <p className="m-0 font-semibold text-danger-ink">Delete account</p>
        <p className="m-0 text-sm text-ink-2">
          You can’t delete your account while you have an upcoming stay or an open payout. Receipts are kept for 7 years for tax
          reasons.
        </p>
        <DeleteAccountDialog />
      </div>
    </div>
  );
}

function DeleteAccountDialog() {
  const qc = useQueryClient();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function confirm() {
    setPending(true);
    setError(null);
    try {
      await apiFetch('/users/me', { method: 'DELETE' });
      qc.clear();
      qc.setQueryData(sessionKey, null);
      toast.success('Your account was deleted');
      router.replace('/');
      router.refresh();
    } catch (err) {
      // 409: upcoming stays or open requests; the API says how many.
      setError(err instanceof ApiError && err.status === 409 ? err.message : errorMessage(err));
      setPending(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) setError(null);
      }}
      title="Delete your account?"
      description="This signs you out everywhere, removes your profile, email and phone number, and takes your listings off Hongwang. It can’t be undone."
      trigger={
        <Button variant="danger-outline" className="self-start">
          Delete account
        </Button>
      }
    >
      {error && <Banner tone="danger">{error}</Banner>}
      <DialogFooter>
        <DialogClose asChild>
          <Button variant="outline">Keep my account</Button>
        </DialogClose>
        <Button variant="danger" loading={pending} onClick={confirm}>
          Delete account
        </Button>
      </DialogFooter>
    </Dialog>
  );
}
