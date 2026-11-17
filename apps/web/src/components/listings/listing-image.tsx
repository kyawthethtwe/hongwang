import Image from 'next/image';
import { PhotoPlaceholder } from '@/components/ui/surfaces';
import { cn } from '@/lib/utils';

type Tint = 1 | 2 | 3 | 4 | 5 | 6;

/** Stable placeholder tint for a listing id, so a card keeps its colour across renders. */
export function tintFor(id: string, offset = 0): Tint {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return (((h + offset) % 6) + 1) as Tint;
}

/** Hosts next.config.ts `images.remotePatterns` allows; anything else is shown unoptimized. */
function isOptimizable(src: string): boolean {
  try {
    const u = new URL(src);
    if (u.hostname === 'localhost') return (u.port === '4000' && u.pathname.startsWith('/uploads/')) || u.port === '9000';
    return u.protocol === 'https:' && (u.hostname.endsWith('.r2.dev') || u.hostname === 'images.unsplash.com');
  } catch {
    return false;
  }
}

/**
 * Listing photo that fills its (relatively positioned) parent, or a tinted placeholder.
 */
export function ListingImage({
  src,
  alt,
  sizes,
  tint = 1,
  priority,
  label,
  className,
}: {
  src: string | null | undefined;
  alt: string;
  sizes: string;
  tint?: Tint;
  priority?: boolean;
  label?: string;
  className?: string;
}) {
  if (!src) return <PhotoPlaceholder tint={tint} label={label} className={cn('absolute inset-0 size-full', className)} />;
  return (
    <Image
      src={src}
      alt={alt}
      fill
      sizes={sizes}
      priority={priority}
      unoptimized={!isOptimizable(src)}
      className={cn('object-cover', className)}
    />
  );
}
