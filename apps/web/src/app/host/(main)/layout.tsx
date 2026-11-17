import { HostHeader } from '@/components/layout/host-header';

/**
 * Owner: Host Dashboard module. Host pages sit on the canvas background (design C2-C7).
 * Dashboard, calendar, listings, reservations, earnings live in this (main) group. The listing
 * editor and onboarding have their own focused header (design C1, C4): put them in host/(focused).
 */
export default function HostLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-canvas">
      <HostHeader />
      {children}
    </div>
  );
}
