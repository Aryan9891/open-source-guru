"use client";

import { type ReactNode, useEffect, useId, useRef } from "react";
import { buttonClasses } from "./Button";

/**
 * A modal asking to confirm an action. Built on the native <dialog>: focus stays inside and
 * starts on Cancel (the safe choice); Escape and a click on the backdrop cancel (unless `busy`).
 */
export function ConfirmDialog({
  open,
  title,
  children,
  confirmLabel,
  cancelLabel = "Cancel",
  variant = "primary",
  busy = false,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  children?: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  variant?: "primary" | "danger";
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  // A click on the dialog element itself is a click on the backdrop. (Keyboard users have
  // Escape, handled by `onCancel` below.)
  const cancel = useRef(onCancel);
  cancel.current = busy ? () => {} : onCancel;
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    const onClick = (event: MouseEvent) => {
      if (event.target === dialog) cancel.current();
    };
    dialog.addEventListener("click", onClick);
    return () => dialog.removeEventListener("click", onClick);
  }, []);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      // Escape: the parent decides whether the dialog closes.
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) onCancel();
      }}
      className="m-auto w-[calc(100%-2rem)] max-w-sm rounded-lg border border-border bg-surface p-0 text-foreground shadow-xl backdrop:bg-plum/50 backdrop:backdrop-blur-sm"
    >
      {/* Padding lives here: clicks on the <dialog> element itself mean the backdrop. */}
      <div className="p-6">
        <h2 id={titleId} className="font-display text-xl font-extrabold">
          {title}
        </h2>
        {children && <div className="mt-2 text-sm text-subtle">{children}</div>}
        <div className="mt-6 flex flex-wrap justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className={buttonClasses({ variant: "ghost" })}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className={buttonClasses({ variant })}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </dialog>
  );
}
