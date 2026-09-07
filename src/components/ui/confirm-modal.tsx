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

  const iconBg =
    variant === "danger"
      ? "bg-red-500/10 text-red-600 dark:text-red-400"
      : variant === "warning"
      ? "bg-amber-500/10 text-amber-600 dark:text-amber-400"
      : "bg-primary/10 text-primary";

  const confirmClass =
    variant === "danger"
      ? "bg-destructive text-white hover:bg-destructive/90"
      : variant === "warning"
      ? "bg-amber-600 text-white hover:bg-amber-700"
      : "";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={onCancel}
      aria-modal="true"
      role="dialog"
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-xs transition-opacity animate-in fade-in" />

      {/* Panel */}
      <div
        className="relative z-10 w-full max-w-md rounded-2xl border border-border/80 bg-card shadow-2xl p-6 space-y-4 animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Icon + title */}
        <div className="flex items-center gap-3">
          <div className={`shrink-0 h-10 w-10 rounded-xl flex items-center justify-center ${iconBg}`}>
            <AlertTriangle className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-foreground tracking-tight">{title}</h2>
          </div>
        </div>

        {/* Message */}
        <p className="text-sm text-muted-foreground leading-relaxed pl-1">{message}</p>

        {/* Actions */}
        <div className="flex justify-end gap-2.5 pt-2 border-t border-border/40">
          <Button variant="outline" size="sm" onClick={onCancel} className="font-medium">
            {cancelLabel}
          </Button>
          <Button size="sm" className={`font-semibold ${confirmClass}`} onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
