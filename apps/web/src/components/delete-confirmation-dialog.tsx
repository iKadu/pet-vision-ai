'use client';

import { useEffect, useId, useRef, type ReactNode } from 'react';
import { AlertTriangle, LoaderCircle, Trash2, X } from 'lucide-react';
import { createPortal } from 'react-dom';

type DeleteConfirmationDialogProps = {
  open: boolean;
  title: string;
  description: ReactNode;
  confirmLabel: string;
  pending?: boolean;
  error?: string | null;
  onCancel: () => void;
  onConfirm: () => void;
};

/** Confirma ações destrutivas sem recorrer ao alerta nativo do navegador. */
export function DeleteConfirmationDialog({
  open,
  title,
  description,
  confirmLabel,
  pending = false,
  error,
  onCancel,
  onConfirm,
}: DeleteConfirmationDialogProps) {
  const cancelButtonRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    if (!open) return;

    const previouslyFocused = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
    const previousOverflow = document.body.style.overflow;
    const frameId = window.requestAnimationFrame(() => cancelButtonRef.current?.focus());
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !pending) onCancel();
    };

    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.cancelAnimationFrame(frameId);
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
      previouslyFocused?.focus();
    };
  }, [onCancel, open, pending]);

  if (!open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center bg-black/55 p-4 backdrop-blur-sm sm:items-center"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !pending) onCancel();
      }}
    >
      <section
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        className="w-full max-w-md overflow-hidden rounded-[28px] border border-destructive/25 bg-card shadow-[0_24px_80px_oklch(0_0_0_/_0.32)]"
      >
        <div className="flex items-start justify-between gap-4 border-b border-border/80 px-5 py-5 sm:px-6">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-destructive/10 text-destructive">
              <AlertTriangle className="h-5 w-5" aria-hidden="true" />
            </span>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-destructive">Ação irreversível</p>
              <h2 id={titleId} className="mt-1 text-lg font-semibold tracking-[-0.03em] text-card-foreground">{title}</h2>
            </div>
          </div>
          <button
            type="button"
            onClick={onCancel}
            disabled={pending}
            className="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-lg text-muted-foreground transition hover:bg-surface-raised hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
            aria-label="Fechar confirmação"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="px-5 py-5 sm:px-6">
          <p id={descriptionId} className="text-sm leading-6 text-muted-foreground">{description}</p>
          {error && <p role="alert" className="mt-4 rounded-xl border border-destructive/20 bg-destructive/[0.07] px-3 py-2.5 text-xs leading-5 text-destructive">{error}</p>}
        </div>

        <div className="flex flex-col-reverse gap-2 border-t border-border/80 bg-surface-raised/45 px-5 py-4 sm:flex-row sm:justify-end sm:px-6">
          <button
            ref={cancelButtonRef}
            type="button"
            onClick={onCancel}
            disabled={pending}
            className="inline-flex h-10 cursor-pointer items-center justify-center rounded-xl border border-border bg-card px-4 text-sm font-semibold text-card-foreground transition hover:bg-surface-raised disabled:cursor-not-allowed disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={pending}
            className="inline-flex h-10 cursor-pointer items-center justify-center gap-2 rounded-xl bg-destructive px-4 text-sm font-semibold text-destructive-foreground shadow-[0_8px_18px_color-mix(in_oklch,var(--destructive)_20%,transparent)] transition hover:bg-destructive/90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {pending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
            {pending ? 'Excluindo...' : confirmLabel}
          </button>
        </div>
      </section>
    </div>,
    document.body,
  );
}
