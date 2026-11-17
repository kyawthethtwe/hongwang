'use client';

import type { MeDto } from '@hongwang/shared';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiError, apiFetch, tryRefresh } from '@/lib/api/client';

export const sessionKey = ['auth', 'me'] as const;

/**
 * The signed-in user, or null. Owner of the auth flows: Auth & Accounts module.
 *   const { user, isLoading } = useSession();
 */
export function useSession() {
  const query = useQuery({
    queryKey: sessionKey,
    queryFn: async (): Promise<MeDto | null> => {
      try {
        return await apiFetch<MeDto>('/auth/me');
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) {
          // Shares the in-flight refresh with apiFetch, so parallel 401s rotate the token once.
          if (await tryRefresh()) return apiFetch<MeDto>('/auth/me');
          return null;
        }
        throw err;
      }
    },
    staleTime: 5 * 60_000,
  });
  return { user: query.data ?? null, isLoading: query.isLoading, refetch: query.refetch };
}

/** Call after sign-in / sign-out / profile edits. */
export function useSetSession() {
  const qc = useQueryClient();
  return (user: MeDto | null) => qc.setQueryData(sessionKey, user);
}
