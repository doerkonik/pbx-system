"use client";

import { useState } from "react";
import { Modal } from "./Modal";
import { Button, type ButtonVariant } from "./Button";

export interface ConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  /** Called when the user confirms. May be async; a spinner shows while pending. */
  onConfirm: () => void | Promise<void>;
  title: React.ReactNode;
  description?: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Button variant for the confirm action. Defaults to "primary". */
  confirmVariant?: ButtonVariant;
  /** Convenience: sets confirmVariant to "danger" for destructive actions. */
  destructive?: boolean;
}

/** Confirmation dialog with an async-aware confirm button. */
export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  confirmVariant,
  destructive = false,
}: ConfirmDialogProps) {
  const [pending, setPending] = useState(false);

  const handleConfirm = async () => {
    try {
      setPending(true);
      await onConfirm();
      onClose();
    } finally {
      setPending(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={pending ? () => undefined : onClose}
      size="sm"
      title={title}
      description={description}
      disableBackdropClose={pending}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={pending}>
            {cancelLabel}
          </Button>
          <Button
            variant={confirmVariant ?? (destructive ? "danger" : "primary")}
            loading={pending}
            onClick={handleConfirm}
          >
            {confirmLabel}
          </Button>
        </>
      }
    />
  );
}
