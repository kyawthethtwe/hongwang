'use client';

import { useEffect, useState } from 'react';

/** Current time, refreshed every `intervalMs` (countdowns, "saved 2 min ago"). */
export function useNow(intervalMs = 30_000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return now;
}

/** "19 h" / "42 min" / "expired" until an ISO timestamp. */
export function leftUntil(iso: string, now: number) {
  const mins = Math.floor((Date.parse(iso) - now) / 60_000);
  if (mins <= 0) return 'expired';
  return mins >= 60 ? `${Math.floor(mins / 60)} h` : `${mins} min`;
}
