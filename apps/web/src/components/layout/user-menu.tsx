'use client';

import { useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/api/client';
import { useSession } from '@/lib/auth/session';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/overlays';
import { Avatar } from '@/components/ui/surfaces';

/** Avatar with account menu when signed in, "Sign in" otherwise. */
export function UserMenu({ mode }: { mode: 'guest' | 'host' }) {
  const { user, isLoading } = useSession();
  const router = useRouter();
  const qc = useQueryClient();

  if (isLoading) return <span className="size-11 rounded-full bg-line-soft" aria-hidden />;
  if (!user)
    return (
      <Button asChild variant="outline" shape="pill" className="px-[18px]">
        <Link href="/login">Sign in</Link>
      </Button>
    );

  const name = `${user.firstName} ${user.lastName}`.trim();
  async function signOut() {
    await apiFetch('/auth/logout', { method: 'POST' }).catch(() => undefined);
    qc.clear();
    router.push('/');
    router.refresh();
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button type="button" aria-label="Account menu" className="cursor-pointer rounded-full">
          <Avatar name={name} src={user.avatarUrl} />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <div className="px-3 py-2">
          <p className="m-0 font-semibold">{name}</p>
          {user.email && <p className="m-0 text-sm text-muted">{user.email}</p>}
        </div>
        <DropdownMenuSeparator />
        {mode === 'guest' ? (
          <>
            <DropdownMenuItem asChild><Link href="/trips">Trips</Link></DropdownMenuItem>
            <DropdownMenuItem asChild><Link href="/saved">Saved</Link></DropdownMenuItem>
            <DropdownMenuItem asChild><Link href="/host">Switch to hosting</Link></DropdownMenuItem>
          </>
        ) : (
          <>
            <DropdownMenuItem asChild><Link href="/host/listings">Listings</Link></DropdownMenuItem>
            <DropdownMenuItem asChild><Link href="/">Switch to travelling</Link></DropdownMenuItem>
          </>
        )}
        <DropdownMenuItem asChild><Link href="/account">Account</Link></DropdownMenuItem>
        {user.role === 'admin' && <DropdownMenuItem asChild><Link href="/admin">Admin</Link></DropdownMenuItem>}
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={signOut}>Sign out</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
