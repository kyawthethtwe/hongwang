import type { Metadata } from 'next';
import { VerifyEmailStatus } from '@/components/auth/verify-email-status';

export const metadata: Metadata = { title: 'Verify your email' };

export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { token } = await searchParams;
  return <VerifyEmailStatus token={typeof token === 'string' && token ? token : null} />;
}
