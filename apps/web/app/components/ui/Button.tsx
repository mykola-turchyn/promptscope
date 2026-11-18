import { cva, type VariantProps } from 'class-variance-authority';
import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Link, type LinkProps } from 'react-router';
import { cn } from '~/lib/cn';
import { Icon, type IconName } from './Icon';

export const buttonVariants = cva(
  'inline-flex shrink-0 items-center justify-center gap-1.5 rounded-control border font-medium no-underline disabled:cursor-default disabled:text-subtle aria-disabled:pointer-events-none aria-disabled:text-subtle',
  {
    variants: {
      variant: {
        primary: 'border-accent bg-accent text-accent-fg',
        secondary: 'border-border bg-surface text-fg',
        ghost: 'border-transparent bg-transparent text-accent-text',
        danger: 'border-danger bg-transparent text-danger',
        dangerText: 'border-border bg-surface text-danger',
      },
      size: {
        sm: 'h-[30px] px-2.5 text-[13px]',
        md: 'h-9 px-3',
        lg: 'h-10 px-3.5',
        icon: 'size-9 text-muted',
      },
    },
    defaultVariants: { variant: 'secondary', size: 'md' },
  },
);

type ButtonVariantProps = VariantProps<typeof buttonVariants>;

interface ContentProps {
  icon?: IconName;
  iconSize?: number;
  children?: ReactNode;
}

function ButtonContent({ icon, iconSize = 15, children }: ContentProps) {
  return (
    <>
      {icon && <Icon name={icon} size={iconSize} strokeWidth={icon === 'plus' ? 2.2 : 2} />}
      {children}
    </>
  );
}

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    ButtonVariantProps,
    Omit<ContentProps, 'children'> {}

export function Button({
  variant,
  size,
  icon,
  iconSize,
  className,
  children,
  type = 'button',
  ...props
}: ButtonProps) {
  return (
    <button type={type} className={cn(buttonVariants({ variant, size }), className)} {...props}>
      <ButtonContent icon={icon} iconSize={iconSize}>
        {children}
      </ButtonContent>
    </button>
  );
}

export interface ButtonLinkProps
  extends LinkProps,
    ButtonVariantProps,
    Omit<ContentProps, 'children'> {
  disabled?: boolean;
}

export function ButtonLink({
  variant,
  size,
  icon,
  iconSize,
  className,
  children,
  disabled,
  ...props
}: ButtonLinkProps) {
  return (
    <Link
      className={cn(buttonVariants({ variant, size }), className)}
      aria-disabled={disabled || undefined}
      tabIndex={disabled ? -1 : undefined}
      {...props}
    >
      <ButtonContent icon={icon} iconSize={iconSize}>
        {children}
      </ButtonContent>
    </Link>
  );
}
