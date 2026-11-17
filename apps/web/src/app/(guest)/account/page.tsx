import type { Metadata } from 'next';
import { Suspense } from 'react';
import { AccountSettings } from '@/components/account/account-settings';

export const metadata: Metadata = { title: 'Account' };

/** /account?section=profile|security|payments|notifications|region|privacy (design B6) */
export default function AccountPage() {
  return (
    <Suspense>
      <AccountSettings />
    </Suspense>
  );
}
