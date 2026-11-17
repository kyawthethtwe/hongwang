/**
 * Owner: Host Dashboard module. Focused host pages (design C1 onboarding, C4 listing editor):
 * no main navigation, each page renders its own FocusedHeader (components/host/focused-header.tsx).
 */
export default function HostFocusedLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen bg-canvas">{children}</div>;
}
