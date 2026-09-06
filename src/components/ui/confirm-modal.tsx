import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ConfirmModalProps {
  open: boolean;
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "danger" | "warning" | "default";
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmModal({
  open,
  title = "Confirmar ação",
  message,
  confirmLabel = "Confirmar",
  cancelLabel = "Cancelar",
  variant = "danger",
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  if (!open) return null;

  const iconColor =
    variant === "danger"
      ? "text-red-400"
      : variant === "warning"
      ? "text-amber-400"
      : "text-primary";

  const confirmClass =
    variant === "danger"
      ? "bg-red-600 hover:bg-red-700 text-white border-red-600"
      : variant === "warning"
      ? "bg-amber-500 hover:bg-amber-600 text-white border-amber-500"
      : "";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      onClick={onCancel}
      aria-modal="true"
      role="dialog"
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      {/* Panel */}
      <div
        className="relative z-10 w-full max-w-sm mx-4 rounded-xl border border-border bg-card shadow-2xl p-6 space-y-4 animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Icon + title */}
        <div className="flex items-center gap-3">
          <div className={`shrink-0 ${iconColor}`}>
            <AlertTriangle className="h-6 w-6" />
          </div>
          <h2 className="text-base font-semibold text-foreground">{title}</h2>
        </div>

        {/* Message */}
        <p className="text-sm text-muted-foreground leading-relaxed">{message}</p>

        {/* Actions */}
        <div className="flex justify-end gap-2 pt-1">
          <Button variant="outline" size="sm" onClick={onCancel}>
            {cancelLabel}
          </Button>
          <Button size="sm" className={confirmClass} onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
