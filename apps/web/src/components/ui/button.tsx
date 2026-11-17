import { cva, type VariantProps } from 'class-variance-authority';
import { Slot } from 'radix-ui';
import * as React from 'react';
import { cn } from '@/lib/utils';
import { Spinner } from './spinner';

/**
 * Buttons from the design. Every size meets the 44px touch target.
 *   <Button>Reserve</Button>                         primary (brand)
 *   <Button variant="outline">Decline</Button>
 *   <Button variant="dark">Approve</Button>          ink background (host actions)
 *   <Button variant="danger-outline">Cancel booking</Button>
 *   <Button asChild><Link href="/trips">View trip</Link></Button>
 */
export const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap font-semibold transition-colors disabled:pointer-events-none disabled:opacity-55 cursor-pointer no-underline [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        primary: 'bg-brand text-white hover:bg-brand-hover hover:text-white',
        outline: 'border border-line-strong bg-surface text-ink hover:bg-canvas hover:text-ink',
        'outline-dark': 'border border-ink bg-surface text-ink hover:bg-canvas hover:text-ink',
        dark: 'bg-ink text-white hover:bg-[#263434] hover:text-white',
        ghost: 'text-ink hover:bg-subtle hover:text-ink font-medium',
        danger: 'bg-danger text-white hover:bg-[#963a22] hover:text-white',
        'danger-outline': 'border border-danger-ink bg-surface text-danger-ink hover:bg-danger-bg hover:text-danger-ink',
        link: 'text-brand underline-offset-4 hover:underline hover:text-brand-hover px-0 font-medium',
      },
      size: {
        sm: 'min-h-10 px-3 text-sm rounded-[8px]',
        md: 'min-h-11 px-4 text-[15px] rounded-field',
        lg: 'min-h-12 px-5 text-[15px] rounded-button',
        xl: 'min-h-14 px-6 text-[17px] rounded-[14px]',
        icon: 'size-11 rounded-full p-0',
      },
      shape: {
        default: '',
        pill: 'rounded-full',
      },
      block: { true: 'w-full', false: '' },
    },
    defaultVariants: { variant: 'primary', size: 'md', shape: 'default', block: false },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  loading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, shape, block, asChild, loading, disabled, children, type, ...props }, ref) => {
    const Comp = asChild ? Slot.Root : 'button';
    return (
      <Comp
        ref={ref}
        type={asChild ? undefined : (type ?? 'button')}
        className={cn(buttonVariants({ variant, size, shape, block }), className)}
        disabled={asChild ? undefined : disabled || loading}
        aria-busy={loading || undefined}
        {...props}
      >
        {asChild ? (
          children
        ) : (
          <>
            {loading && <Spinner className="size-4" />}
            {children}
          </>
        )}
      </Comp>
    );
  },
);
Button.displayName = 'Button';
