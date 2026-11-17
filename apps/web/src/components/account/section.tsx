import { cn } from '@/lib/utils';

/** Section heading on /account (design B6: 22px, semibold). */
export function SectionHeading({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return <h2 className={cn('m-0 text-[22px] font-semibold', className)} {...props} />;
}

/** "Password / Last changed 3 months ago .......... [Change password]" row. */
export function SettingRow({
  title,
  sub,
  action,
  className,
}: {
  title: React.ReactNode;
  sub?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-wrap items-center justify-between gap-3 border-b border-line py-4', className)}>
      <div className="min-w-0">
        <p className="m-0 font-semibold">{title}</p>
        {sub && <p className="m-0 text-sm text-muted">{sub}</p>}
      </div>
      {action}
    </div>
  );
}

export function Note({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn('m-0 text-sm text-muted', className)} {...props} />;
}
