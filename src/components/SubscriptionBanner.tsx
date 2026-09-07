import { useSubscription } from "@/contexts/SubscriptionContext";
import { useAuth } from "@/contexts/AuthContext";
import { Link } from "react-router-dom";
import { Sparkles, AlertCircle, ArrowRight } from "lucide-react";

export function SubscriptionBanner() {
  const { session } = useAuth();
  const { subscription, loading } = useSubscription();

  if (!session || loading || !subscription) return null;

  // Se está ativo normalmente, não precisa de banner de aviso
  if (subscription.status === "active" && subscription.isAccessAllowed) {
    return null;
  }

  // Se está em período de testes (Trial)
  if (subscription.status === "trialing" && subscription.isAccessAllowed) {
    return (
      <div className="bg-gradient-to-r from-primary/15 via-primary/10 to-primary/15 border-b border-primary/20 px-4 py-2.5 text-xs sm:text-sm font-medium flex items-center justify-center gap-2 text-foreground">
        <Sparkles className="h-4 w-4 text-primary shrink-0 animate-pulse" />
        <span>
          Você está no <strong>Período de Teste Gratuito</strong>: restam{" "}
          <span className="font-bold text-primary">{subscription.daysRemaining} {subscription.daysRemaining === 1 ? "dia" : "dias"}</span>.
        </span>
        <Link
          to="/planos"
          className="ml-2 inline-flex items-center gap-1 font-semibold text-primary hover:underline"
        >
          Ver Planos <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    );
  }

  // Se expirou o trial ou assinatura
  if (!subscription.isAccessAllowed) {
    return (
      <div className="bg-destructive/15 border-b border-destructive/30 px-4 py-2.5 text-xs sm:text-sm font-medium flex items-center justify-center gap-2 text-destructive">
        <AlertCircle className="h-4 w-4 shrink-0" />
        <span>
          <strong>Acesso pausado:</strong> Seu período de testes ou assinatura encerrou.
        </span>
        <Link
          to="/planos"
          className="ml-2 inline-flex items-center gap-1 font-bold underline hover:opacity-90"
        >
          Assinar um Plano <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    );
  }

  return null;
}
