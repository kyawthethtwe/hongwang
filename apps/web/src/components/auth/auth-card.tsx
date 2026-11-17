import { cn } from '@/lib/utils';

/** The white card every auth screen sits in (design A4). */
export function AuthCard({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <div
      className={cn(
        'flex w-full max-w-[440px] flex-col gap-5 self-start rounded-sheet border border-line bg-surface p-6 sm:p-8',
        className,
      )}
    >
      {children}
    </div>
  );
}

export function AuthHeading({ title, subtitle }: { title: React.ReactNode; subtitle?: React.ReactNode }) {
  return (
    <div>
      <h1 className="m-0 font-display text-[28px] leading-[1.2] font-bold tracking-[-0.02em]">{title}</h1>
      {subtitle && <p className="m-0 mt-1.5 text-ink-2">{subtitle}</p>}
    </div>
  );
}

/** Underlined text button ("Forgot your password?", "Use email instead"). */
export function TextButton({ className, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      className={cn(
        'min-h-11 cursor-pointer border-0 bg-transparent p-0 font-medium text-brand underline hover:text-brand-hover disabled:cursor-default disabled:text-muted disabled:no-underline',
        className,
      )}
      {...props}
    />
  );
}

export function LegalNote() {
  return <p className="m-0 text-[13px] text-muted">By continuing you agree to the [TERMS] and [PRIVACY POLICY].</p>;
}

/** Primary submit used across the auth forms (52px, 14px radius as in the design). */
export const authSubmitClass = 'min-h-13 rounded-[14px]';
