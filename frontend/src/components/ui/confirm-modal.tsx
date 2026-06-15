import { Button } from './button';

interface ConfirmModalProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  confirmVariant?: 'primary' | 'danger';
  onConfirm: () => void;
  onCancel: () => void;
}

/** Lightweight confirm dialog — backdrop + a card with cancel/confirm actions. */
export function ConfirmModal({
  open,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  confirmVariant = 'primary',
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[110] grid place-items-center bg-[rgba(4,6,10,0.72)] backdrop-blur-[2px] p-[24px]" onClick={onCancel}>
      <div
        className="w-full max-w-[440px] bg-[#11141c] border border-[rgba(255,255,255,0.1)] rounded-[16px] shadow-[0_24px_80px_rgba(0,0,0,0.6)] overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        <div className="p-[20px_22px]">
          <div className="text-[15px] font-semibold text-white">{title}</div>
          <div className="text-[13px] text-[#98a1b3] mt-[6px] leading-[1.5]">{message}</div>
        </div>
        <div className="p-[14px_22px] border-t border-[rgba(255,255,255,0.07)] flex justify-end gap-[10px]">
          <Button variant="ghost" onClick={onCancel}>{cancelLabel}</Button>
          <Button variant={confirmVariant} onClick={onConfirm}>{confirmLabel}</Button>
        </div>
      </div>
    </div>
  );
}
