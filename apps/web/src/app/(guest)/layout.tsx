import { SiteFooter, SiteHeader } from '@/components/layout/site-header';

/** Guest pages: search, listing, trips, saved, account. */
export default function GuestLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-surface">
      <SiteHeader />
      <div className="flex-1">{children}</div>
      <SiteFooter />
    </div>
  );
}
