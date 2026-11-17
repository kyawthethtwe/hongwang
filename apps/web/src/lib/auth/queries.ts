'use client';

import type { AuthProvidersDto, MeDto, SessionDto, UpdateProfileInput } from '@hongwang/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/api/client';
import { sessionKey, useSetSession } from './session';

/** Query keys for the Auth & Accounts module. `sessionKey` (the signed-in user) lives in session.ts. */
export const authKeys = {
  me: sessionKey,
  providers: ['auth', 'providers'] as const,
  sessions: ['users', 'me', 'sessions'] as const,
};

/** Which sign-in providers the API has configured (Google only when its keys are set). */
export function useProviders() {
  return useQuery({
    queryKey: authKeys.providers,
    queryFn: () => apiFetch<AuthProvidersDto>('/auth/providers'),
    staleTime: Infinity,
  });
}

export function useSessionsList(enabled = true) {
  return useQuery({
    queryKey: authKeys.sessions,
    queryFn: () => apiFetch<SessionDto[]>('/users/me/sessions'),
    enabled,
  });
}

/** PATCH /users/me, then updates the cached session user. */
export function useUpdateProfile() {
  const setSession = useSetSession();
  return useMutation({
    mutationFn: (input: UpdateProfileInput) => apiFetch<MeDto>('/users/me', { method: 'PATCH', body: input }),
    onSuccess: (user) => setSession(user),
  });
}

/** Signs out this browser and forgets every cached query. */
export function useSignOut() {
  const qc = useQueryClient();
  const router = useRouter();
  return async (redirectTo = '/') => {
    await apiFetch('/auth/logout', { method: 'POST' }).catch(() => undefined);
    qc.clear();
    qc.setQueryData(sessionKey, null);
    router.replace(redirectTo);
    router.refresh();
  };
}
