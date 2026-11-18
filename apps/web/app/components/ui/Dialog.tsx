import { type ReactNode, useEffect, useRef } from 'react';
import { Button } from './Button';
import { Icon } from './Icon';

export function Dialog({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      aria-label={title}
      className="m-auto w-[min(480px,calc(100vw-32px))] rounded-card border border-border bg-surface p-0 text-fg backdrop:bg-black/40"
    >
      <div className="flex items-center justify-between gap-3 border-b border-border px-[18px] py-3.5">
        <h2 className="m-0 text-base font-semibold">{title}</h2>
        <Button size="icon" aria-label="Close" onClick={onClose} className="size-8">
          <Icon name="close" size={14} />
        </Button>
      </div>
      <div className="p-[18px]">{children}</div>
    </dialog>
  );
}
