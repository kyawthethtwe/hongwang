'use client';

import type { IsoDate, SavedListingDto } from '@hongwang/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useCallback, useMemo } from 'react';
import { toast } from 'sonner';
import { ApiError, apiFetch, errorMessage } from '@/lib/api/client';
import { useSession } from '@/lib/auth/session';

/** Saved rooms. Owner: Listings & Search module. */
export const savedKeys = {
  all: ['saved'] as const,
  ids: () => ['saved', 'ids'] as const,
  lists: () => ['saved', 'list'] as const,
  list: (dates: { checkIn?: IsoDate; checkOut?: IsoDate }) => ['saved', 'list', dates] as const,
};

/** Ids of the caller's saved rooms (empty and idle when signed out). */
export function useSavedIds() {
  const { user } = useSession();
  const query = useQuery({
    queryKey: savedKeys.ids(),
    queryFn: () => apiFetch<string[]>('/saved/ids'),
    enabled: !!user,
    staleTime: 60_000,
  });
  const ids = useMemo(() => new Set(user ? (query.data ?? []) : []), [query.data, user]);
  return { ...query, ids };
}

export function useSavedListings(dates: { checkIn?: IsoDate; checkOut?: IsoDate }, enabled = true) {
  return useQuery({
    queryKey: savedKeys.list(dates),
    queryFn: () => apiFetch<SavedListingDto[]>('/saved', { query: dates }),
    enabled,
  });
}

/** Where a signed-out visitor goes to sign in and come back to this page. */
export function loginHref(next?: string) {
  const here = next ?? (typeof window !== 'undefined' ? `${window.location.pathname}${window.location.search}` : '/');
  return `/login?next=${encodeURIComponent(here)}`;
}

type ToggleVars = {
  id: string;
  saved: boolean;
  /** Put this row back into saved lists at `index` (Undo on the saved page). */
  restore?: { item: SavedListingDto; index: number };
};

/**
 * Save / unsave with optimistic updates of the id set and the saved lists.
 * Signed-out visitors are sent to /login?next=<current url>.
 *   const { toggle, isSaved } = useToggleSaved();
 *   toggle({ id, saved: !isSaved(id) });
 */
export function useToggleSaved() {
  const qc = useQueryClient();
  const router = useRouter();
  const { user, isLoading } = useSession();
  const { ids } = useSavedIds();

  const mutation = useMutation({
    mutationFn: ({ id, saved }: ToggleVars) => apiFetch(`/saved/${id}`, { method: saved ? 'PUT' : 'DELETE' }),
    onMutate: async ({ id, saved, restore }) => {
      await qc.cancelQueries({ queryKey: savedKeys.all });
      const prevIds = qc.getQueryData<string[]>(savedKeys.ids());
      const prevLists = qc.getQueriesData<SavedListingDto[]>({ queryKey: savedKeys.lists() });
      qc.setQueryData<string[]>(savedKeys.ids(), (cur = []) => (saved ? [id, ...cur.filter((x) => x !== id)] : cur.filter((x) => x !== id)));
      qc.setQueriesData<SavedListingDto[]>({ queryKey: savedKeys.lists() }, (list) => {
        if (!list) return list;
        if (!saved) return list.filter((l) => l.id !== id);
        if (restore && !list.some((l) => l.id === id)) {
          const next = [...list];
          next.splice(Math.min(restore.index, next.length), 0, restore.item);
          return next;
        }
        return list;
      });
      return { prevIds, prevLists };
    },
    onError: (err, _vars, ctx) => {
      if (ctx) {
        qc.setQueryData(savedKeys.ids(), ctx.prevIds);
        for (const [key, data] of ctx.prevLists) qc.setQueryData(key, data);
      }
      if (err instanceof ApiError && err.status === 401) {
        router.push(loginHref());
        return;
      }
      toast.error(errorMessage(err, 'Couldn’t update your saved rooms.'));
    },
    onSettled: (_data, _err, vars) => {
      void qc.invalidateQueries({ queryKey: savedKeys.ids() });
      // A newly saved room needs its card data; removals are already reflected.
      if (vars.saved) void qc.invalidateQueries({ queryKey: savedKeys.lists() });
    },
  });

  const toggle = useCallback(
    (vars: ToggleVars) => {
      if (!user) {
        if (!isLoading) router.push(loginHref());
        return;
      }
      mutation.mutate(vars);
    },
    [user, isLoading, router, mutation],
  );

  const isSaved = useCallback((id: string) => ids.has(id), [ids]);

  return { toggle, isSaved, isPending: mutation.isPending };
}
