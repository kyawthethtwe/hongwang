'use client';

import type { MeDto, SessionDto } from '@hongwang/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Button, buttonVariants } from '@/components/ui/button';
import { Banner, Skeleton } from '@/components/ui/feedback';
import { apiFetch, errorMessage } from '@/lib/api/client';
import { authKeys, useProviders, useSessionsList } from '@/lib/auth/queries';
import { fromNow } from '@/lib/format';
import { cn } from '@/lib/utils';
import { ChangePasswordDialog } from './change-password-dialog';
import { SectionHeading, SettingRow } from './section';

const CONNECT_GOOGLE_HREF = `/api/auth/google?${new URLSearchParams({ connect: '1', next: '/account?section=security&google=connected' })}`;

export function SecuritySection({ user }: { user: MeDto }) {
  const qc = useQueryClient();
  const providers = useProviders();
  const showGoogle = user.googleConnected || !!providers.data?.google;

  const disconnect = useMutation({
    mutationFn: () => apiFetch('/auth/google', { method: 'DELETE' }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: authKeys.me });
      toast.success('Google disconnected');
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  return (
    <div className="flex flex-col gap-5">
      <SectionHeading>Login and security</SectionHeading>
      <div>
        <SettingRow
          title="Password"
          sub={
            user.hasPassword
              ? user.passwordChangedAt
                ? `Last changed ${fromNow(user.passwordChangedAt)}`
                : 'Set'
              : 'Not set. You sign in with your phone or Google.'
          }
          action={
            <ChangePasswordDialog
              hasPassword={user.hasPassword}
              trigger={
                <Button variant="outline" className="font-medium">
                  {user.hasPassword ? 'Change password' : 'Set a password'}
                </Button>
              }
            />
          }
        />
        {showGoogle && (
          <SettingRow
            title="Google"
            sub={user.googleConnected ? 'Connected' : 'Not connected'}
            action={
              user.googleConnected ? (
                <Button variant="outline" className="font-medium" loading={disconnect.isPending} onClick={() => disconnect.mutate()}>
                  Disconnect
                </Button>
              ) : (
                <a href={CONNECT_GOOGLE_HREF} className={cn(buttonVariants({ variant: 'outline' }), 'font-medium')}>
                  Connect
                </a>
              )
            }
          />
        )}
      </div>
      <SignedInSessions />
    </div>
  );
}

function SignedInSessions() {
  const qc = useQueryClient();
  const sessions = useSessionsList();
  const refresh = () => qc.invalidateQueries({ queryKey: authKeys.sessions });

  const revoke = useMutation({
    mutationFn: (id: string) => apiFetch(`/users/me/sessions/${id}`, { method: 'DELETE' }),
    onSuccess: async () => {
      await refresh();
      toast.success('Signed out of that device');
    },
    onError: (err) => toast.error(errorMessage(err)),
  });
  const revokeOthers = useMutation({
    mutationFn: () => apiFetch('/users/me/sessions/revoke-others', { method: 'POST' }),
    onSuccess: async () => {
      await refresh();
      toast.success('Signed out everywhere else');
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  const list = sessions.data ?? [];
  const others = list.filter((s) => !s.current);

  return (
    <>
      <h3 className="m-0 mt-2 text-[17px] font-semibold">Where you’re signed in</h3>
      {sessions.isLoading ? (
        <div className="flex flex-col gap-2" aria-hidden>
          <Skeleton className="h-11" />
          <Skeleton className="h-11" />
        </div>
      ) : sessions.isError ? (
        <Banner tone="danger" action={<Button variant="outline" size="sm" onClick={() => sessions.refetch()}>Try again</Button>}>
          We couldn’t load your devices.
        </Banner>
      ) : (
        <ul className="m-0 flex list-none flex-col p-0">
          {list.map((s) => (
            <SessionRow key={s.id} session={s} pending={revoke.isPending && revoke.variables === s.id} onRevoke={() => revoke.mutate(s.id)} />
          ))}
        </ul>
      )}
      {others.length > 0 && (
        <Button variant="danger-outline" className="self-start" loading={revokeOthers.isPending} onClick={() => revokeOthers.mutate()}>
          Sign out everywhere else
        </Button>
      )}
    </>
  );
}

function SessionRow({ session, pending, onRevoke }: { session: SessionDto; pending: boolean; onRevoke: () => void }) {
  const when = session.current ? null : fromNow(session.lastUsedAt);
  return (
    <li className="flex flex-wrap items-center justify-between gap-3 border-b border-line-soft py-1.5">
      <span className="py-2.5">
        {session.device}
        {when && <span className="text-muted"> · {when}</span>}
      </span>
      {session.current ? (
        <span className="py-2.5 text-sm font-semibold text-brand-hover">This device</span>
      ) : (
        <Button
          variant="ghost"
          size="sm"
          className="font-semibold text-danger hover:text-danger"
          loading={pending}
          onClick={onRevoke}
          aria-label={`Sign out ${session.device}${when ? `, last active ${when}` : ''}`}
        >
          Sign out
        </Button>
      )}
    </li>
  );
}
