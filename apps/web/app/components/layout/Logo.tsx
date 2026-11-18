import { cn } from '~/lib/cn';

const SIZES = {
  sm: { box: 'size-7 rounded-control', icon: 16, text: 'text-[15px]' },
  md: { box: 'size-8 rounded-[9px]', icon: 18, text: 'text-[17px]' },
};

export function Logo({
  size = 'sm',
  className,
}: {
  size?: keyof typeof SIZES;
  className?: string;
}) {
  const style = SIZES[size];

  return (
    <div className={cn('flex items-center gap-2.5', className)}>
      <div className={cn('flex items-center justify-center bg-accent', style.box)}>
        <svg
          width={style.icon}
          height={style.icon}
          viewBox="0 0 24 24"
          fill="none"
          stroke="var(--accent-fg)"
          strokeWidth="2.4"
          strokeLinecap="round"
          aria-hidden="true"
        >
          <circle cx="11" cy="11" r="6" />
          <path d="M20 20l-4.2-4.2" />
          <circle cx="11" cy="11" r="1.6" fill="var(--accent-fg)" stroke="none" />
        </svg>
      </div>
      <span className={cn('font-semibold tracking-[-0.01em]', style.text)}>Promptscope</span>
    </div>
  );
}
