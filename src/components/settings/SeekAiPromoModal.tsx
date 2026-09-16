import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Sparkles, Gift, ExternalLink, X, CheckCircle2, Zap } from "lucide-react";

interface SeekAiPromoModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SEEKAI_PROMO_STORAGE_KEY = "platafy_seekai_promo_dismissed";

export function SeekAiPromoModal({ isOpen, onClose }: SeekAiPromoModalProps) {
  const [alreadyRegistered, setAlreadyRegistered] = useState(false);

  useEffect(() => {
    if (isOpen) {
      const isDismissed = localStorage.getItem(SEEKAI_PROMO_STORAGE_KEY) === "true";
      setAlreadyRegistered(isDismissed);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleCheckboxChange = (checked: boolean) => {
    setAlreadyRegistered(checked);
    if (checked) {
      localStorage.setItem(SEEKAI_PROMO_STORAGE_KEY, "true");
    } else {
      localStorage.removeItem(SEEKAI_PROMO_STORAGE_KEY);
    }
  };

  const handleClaimBonus = () => {
    window.open("https://platafy.com/seekai", "_blank", "noopener,noreferrer");
    if (alreadyRegistered) {
      localStorage.setItem(SEEKAI_PROMO_STORAGE_KEY, "true");
    }
    onClose();
  };

  const handleClose = () => {
    if (alreadyRegistered) {
      localStorage.setItem(SEEKAI_PROMO_STORAGE_KEY, "true");
    }
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4 animate-in fade-in duration-200"
      onClick={handleClose}
    >
      <div
        className="relative w-full max-w-lg rounded-3xl border border-primary/30 bg-card/95 backdrop-blur-md shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 text-foreground"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Decorative Top Accent Glow */}
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-amber-500 via-primary to-purple-600" />
        <div className="absolute -top-24 -right-24 w-48 h-48 bg-primary/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-amber-500/15 rounded-full blur-3xl pointer-events-none" />

        {/* Close button */}
        <button
          onClick={handleClose}
          className="absolute top-4 right-4 p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition-colors cursor-pointer z-10"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="p-6 sm:p-7 space-y-5">
          {/* Badge & Title */}
          <div className="space-y-2">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/25">
              <Gift className="w-3.5 h-3.5" />
              <span>BÔNUS EXCLUSIVO DE BOAS-VINDAS</span>
            </div>

            <h2 className="text-xl sm:text-2xl font-extrabold tracking-tight text-foreground leading-snug">
              Ganhe <span className="bg-gradient-to-r from-amber-500 via-primary to-purple-600 bg-clip-text text-transparent">U$ 200,00</span> em créditos para diversas LLMs!
            </h2>
            <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
              Turbine as automações do <strong>PLATAFY SOCIAL HUB</strong>. Com o <strong>SeekAI</strong>, você conecta os melhores modelos de IA em uma única chave de API unificada de alta velocidade.
            </p>
          </div>

          {/* Benefits Box */}
          <div className="p-4 rounded-2xl bg-secondary/35 border border-border/70 space-y-2.5">
            <div className="flex items-start gap-2.5">
              <div className="p-1 rounded-lg bg-emerald-500/10 text-emerald-500 shrink-0 mt-0.5">
                <CheckCircle2 className="w-3.5 h-3.5" />
              </div>
              <p className="text-xs text-muted-foreground">
                <strong className="text-foreground">U$ 200,00 em créditos gratuitos:</strong> Bônus liberado ao se cadastrar pelo link oficial de parceria.
              </p>
            </div>

            <div className="flex items-start gap-2.5">
              <div className="p-1 rounded-lg bg-primary/10 text-primary shrink-0 mt-0.5">
                <Zap className="w-3.5 h-3.5" />
              </div>
              <p className="text-xs text-muted-foreground">
                <strong className="text-foreground">Múltiplos modelos em uma chave:</strong> GPT-4o, Claude 3.5 Sonnet, Gemini 1.5 Pro, DeepSeek V3 e Llama 3.
              </p>
            </div>

            <div className="flex items-start gap-2.5">
              <div className="p-1 rounded-lg bg-purple-500/10 text-purple-500 shrink-0 mt-0.5">
                <Sparkles className="w-3.5 h-3.5" />
              </div>
              <p className="text-xs text-muted-foreground">
                <strong className="text-foreground">Configuração em 1 clique:</strong> Copie sua chave no SeekAI e adicione aqui em <em>Configurações &gt; Provedores de IA</em>.
              </p>
            </div>
          </div>

          {/* CTA Button */}
          <div className="space-y-3 pt-1">
            <Button
              onClick={handleClaimBonus}
              className="w-full h-11 bg-gradient-to-r from-amber-500 via-primary to-purple-600 hover:opacity-95 text-white font-bold text-sm rounded-xl shadow-lg shadow-primary/20 flex items-center justify-center gap-2 cursor-pointer transition-all"
            >
              <span>Cadastrar no SeekAI e Resgatar U$ 200</span>
              <ExternalLink className="w-4 h-4" />
            </Button>
          </div>

          {/* Checkbox "Já me cadastrei" */}
          <div className="flex items-center justify-between pt-2 border-t border-border/60 gap-3">
            <label className="flex items-center gap-2.5 cursor-pointer select-none group">
              <input
                type="checkbox"
                id="seekai_already_registered"
                checked={alreadyRegistered}
                onChange={(e) => handleCheckboxChange(e.target.checked)}
                className="w-4 h-4 rounded border-border bg-background accent-primary cursor-pointer transition-all"
              />
              <span className="text-xs text-muted-foreground group-hover:text-foreground font-medium transition-colors">
                Já me cadastrei <span className="text-[11px] text-muted-foreground/70">(não mostrar novamente)</span>
              </span>
            </label>

            <button
              onClick={handleClose}
              className="text-xs text-muted-foreground hover:text-foreground hover:underline font-medium cursor-pointer shrink-0"
            >
              Agora não
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
