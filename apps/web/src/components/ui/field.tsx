import * as React from 'react';
import { cn } from '@/lib/utils';

const control =
  'w-full min-h-12 rounded-field border border-line-strong bg-surface px-3.5 text-[15px] font-normal text-ink transition-colors focus:border-brand focus:outline-none focus-visible:outline-2 focus-visible:outline-brand aria-[invalid=true]:border-danger disabled:bg-canvas disabled:text-muted';

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => <input ref={ref} className={cn(control, className)} {...props} />,
);
Input.displayName = 'Input';

export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, rows = 4, ...props }, ref) => (
    <textarea ref={ref} rows={rows} className={cn(control, 'py-3 leading-relaxed', className)} {...props} />
  ),
);
Textarea.displayName = 'Textarea';

/** Native select styled like the design (sort menus, banks, reasons). */
export const Select = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className, children, ...props }, ref) => (
    <select ref={ref} className={cn(control, 'px-3 cursor-pointer', className)} {...props}>
      {children}
    </select>
  ),
);
Select.displayName = 'Select';

export function Label({ className, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className={cn('text-sm font-semibold text-ink', className)} {...props} />;
}

/**
 * Label + control + hint/error, wired for accessibility.
 *   <Field label="Email" error={errors.email?.message}>
 *     {(p) => <Input type="email" {...p} {...register('email')} />}
 *   </Field>
 */
export function Field({
  label,
  hint,
  error,
  className,
  children,
  id: idProp,
}: {
  label: React.ReactNode;
  hint?: React.ReactNode;
  error?: React.ReactNode;
  className?: string;
  id?: string;
  children: (props: { id: string; 'aria-invalid'?: boolean; 'aria-describedby'?: string }) => React.ReactNode;
}) {
  const autoId = React.useId();
  const id = idProp ?? autoId;
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <Label htmlFor={id}>{label}</Label>
      {children({
        id,
        'aria-invalid': error ? true : undefined,
        'aria-describedby': [hintId, errorId].filter(Boolean).join(' ') || undefined,
      })}
      {hint && !error && (
        <p id={hintId} className="text-[13px] text-muted">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className="text-[13px] font-medium text-danger-ink" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

/** Native checkbox with the brand accent. Wrap it in a <label> with its text. */
export const Checkbox = React.forwardRef<HTMLInputElement, Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'>>(
  ({ className, ...props }, ref) => (
    <input ref={ref} type="checkbox" className={cn('size-[18px] shrink-0 accent-brand cursor-pointer', className)} {...props} />
  ),
);
Checkbox.displayName = 'Checkbox';

export const Radio = React.forwardRef<HTMLInputElement, Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'>>(
  ({ className, ...props }, ref) => (
    <input ref={ref} type="radio" className={cn('size-5 shrink-0 accent-brand cursor-pointer m-0', className)} {...props} />
  ),
);
Radio.displayName = 'Radio';

/**
 * Selectable card with a radio, as in "Pay with" and the cancellation policy picker.
 *   <RadioCard name="method" checked={m==='card'} onChange={() => set('card')} title="Card" sub="Visa, Mastercard" />
 */
export function RadioCard({
  title,
  sub,
  className,
  checked,
  ...props
}: Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type' | 'title'> & { title: React.ReactNode; sub?: React.ReactNode }) {
  return (
    <label
      className={cn(
        'flex cursor-pointer items-center gap-3.5 rounded-[14px] border-2 bg-surface px-4 py-3.5',
        checked ? 'border-brand' : 'border-line-card',
        className,
      )}
    >
      <Radio checked={checked} {...props} />
      <span className="flex flex-col">
        <span className="font-semibold">{title}</span>
        {sub && <span className="text-sm text-muted">{sub}</span>}
      </span>
    </label>
  );
}
