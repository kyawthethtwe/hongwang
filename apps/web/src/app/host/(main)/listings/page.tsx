import type { Metadata } from 'next';
import { ListingsView } from '@/components/host/listings-view';

export const metadata: Metadata = { title: 'Listings' };

/** Host listings (design C3). */
export default function HostListingsPage() {
  return (
    <main className="mx-auto box-border w-full max-w-[1200px] px-4 pt-8 pb-14 sm:px-10">
      <ListingsView />
    </main>
  );
}
