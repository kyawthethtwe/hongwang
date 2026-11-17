import type { Metadata } from 'next';
import { OnboardingView } from '@/components/host/onboarding-view';

export const metadata: Metadata = { title: 'Set up hosting' };

/** Become a host: ID check and payouts (design C1). */
export default function HostOnboardingPage() {
  return <OnboardingView />;
}
