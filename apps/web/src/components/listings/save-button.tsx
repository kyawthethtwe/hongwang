'use client';

import { Heart } from 'lucide-react';
import { useToggleSaved } from '@/lib/queries/saved';
import { cn } from '@/lib/utils';

/** Round heart on a card photo (design A1). `aria-pressed` reflects the saved state. */
export function SaveHeart({ id, title, className }: { id: string; title: string; className?: string }) {
  const { toggle, isSaved } = useToggleSaved();
  const saved = isSaved(id);
  return (
    <button
      type="button"
      aria-label={saved ? `Remove ${title} from saved` : `Save ${title}`}
      aria-pressed={saved}
      onClick={() => toggle({ id, saved: !saved })}
      className={cn(
        'inline-flex size-11 cursor-pointer items-center justify-center rounded-full border-0 bg-surface shadow-pop transition-transform hover:scale-105',
        className,
      )}
    >
      <HeartIcon filled={saved} />
    </button>
  );
}

/** "Save" / "Saved" pill on the listing page (design A2). */
export function SavePill({ id }: { id: string }) {
  const { toggle, isSaved } = useToggleSaved();
  const saved = isSaved(id);
  return (
    <button
      type="button"
      aria-pressed={saved}
      onClick={() => toggle({ id, saved: !saved })}
      className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-full border border-line-strong bg-surface px-4 font-medium text-ink hover:bg-canvas"
    >
      <HeartIcon filled={saved} size={18} />
      {saved ? 'Saved' : 'Save'}
    </button>
  );
}

export function HeartIcon({ filled, size = 20 }: { filled: boolean; size?: number }) {
  return (
    <Heart
      aria-hidden
      width={size}
      height={size}
      strokeWidth={2}
      className={cn(filled ? 'fill-heart text-heart' : 'fill-none text-ink')}
    />
  );
}
