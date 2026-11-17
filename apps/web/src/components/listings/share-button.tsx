'use client';

import { Share } from 'lucide-react';
import { toast } from 'sonner';

/** Copies the page link (design A2 "Share"). */
export function ShareButton() {
  async function share() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      toast.success('Link copied');
    } catch {
      toast.error('Couldn’t copy the link. Copy it from the address bar instead.');
    }
  }
  return (
    <button
      type="button"
      onClick={share}
      className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-full border border-line-strong bg-surface px-4 font-medium text-ink hover:bg-canvas"
    >
      <Share aria-hidden className="size-[18px]" />
      Share
    </button>
  );
}
