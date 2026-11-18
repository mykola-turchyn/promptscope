import type {
  ChangeEvent,
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from 'react';
import { useId } from 'react';
import { cn } from '~/lib/cn';
import { Icon } from './Icon';

const controlClasses =
  'box-border w-full rounded-control border border-border bg-surface px-3 font-normal text-fg [font:inherit]';

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(controlClasses, 'h-9', className)} {...props} />;
}

export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea className={cn(controlClasses, 'py-2 font-mono text-[13px]', className)} {...props} />
  );
}

export function Select({ className, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={cn(controlClasses, 'h-9', className)} {...props} />;
}

export function Field({
  label,
  hint,
  error,
  aside,
  className,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  aside?: ReactNode;
  className?: string;
  children: (props: {
    id: string;
    'aria-invalid'?: boolean;
    'aria-describedby'?: string;
  }) => ReactNode;
}) {
  const id = useId();
  const messageId = `${id}-message`;
  const message = error ?? hint;

  return (
    <div className={cn('flex flex-col gap-1.5 text-[13px] font-medium', className)}>
      <span className="flex justify-between">
        <label htmlFor={id}>{label}</label>
        {aside}
      </span>
      {children({
        id,
        'aria-invalid': error ? true : undefined,
        'aria-describedby': message ? messageId : undefined,
      })}
      {message && (
        <span
          id={messageId}
          className={cn('font-normal', error ? 'text-danger' : 'text-xs text-subtle')}
        >
          {message}
        </span>
      )}
    </div>
  );
}

export interface FilterOption {
  value: string;
  label: string;
}

export function FilterSelect({
  name,
  label,
  options,
  defaultValue,
  onChange,
}: {
  name: string;
  label: string;
  options: FilterOption[];
  defaultValue: string;
  onChange?: (event: ChangeEvent<HTMLSelectElement>) => void;
}) {
  return (
    <span className="relative inline-flex">
      <select
        name={name}
        aria-label={label}
        defaultValue={defaultValue}
        onChange={onChange}
        className="h-9 appearance-none rounded-control border border-border bg-surface pr-8 pl-3 font-medium text-fg [font:inherit]"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {label}: {option.label}
          </option>
        ))}
      </select>
      <Icon
        name="chevronDown"
        size={14}
        className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2"
      />
    </span>
  );
}
