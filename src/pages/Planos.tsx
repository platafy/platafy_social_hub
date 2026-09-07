import { useEffect, useState } from "react";
import { useSearchParams, Link, useNavigate } from "react-router-dom";
import { useSubscription, type Plan } from "@/contexts/SubscriptionContext";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { 
  Check, Sparkles, ArrowLeft, ShieldCheck, Zap, CreditCard, 
  CheckCircle2, Clock
} from "lucide-react";

export default function Planos() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { session } = useAuth();
  const { plans, subscription, loading, checkoutLoading, createCheckout, refreshSubscription } = useSubscription();
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);

  const paymentStatus = searchParams.get("payment");

  useEffect(() => {
    if (paymentStatus === "success") {
      toast.success("Pagamento recebido! Atualizando sua assinatura...");
      const timer = setTimeout(() => {
        refreshSubscription();
      }, 3000);
      return () => clearTimeout(timer);
    } else if (paymentStatus === "pending") {
      toast.info("Pagamento em processamento. Sua assinatura será liberada assim que o PIX ou Cartão for confirmado.");
    } else if (paymentStatus === "failure") {
      toast.error("O pagamento não foi concluído. Tente novamente ou use outro método.");
    }
  }, [paymentStatus, refreshSubscription]);

  const handleSubscribe = async (plan: Plan) => {
    if (!session) {
      toast.info("Crie ou acerte sua conta para assinar este plano.");
      navigate(`/cadastro?plan=${plan.slug}`);
      return;
    }

    setSelectedPlanId(plan.id);
    const checkoutUrl = await createCheckout(plan.id);
    if (checkoutUrl) {
      // Redirecionar para o Checkout oficial do Mercado Pago
      window.location.href = checkoutUrl;
    }
  };

  return (
    <div className="min-h-[85vh] max-w-6xl mx-auto py-8 px-4 space-y-12">
      {/* Botão de Retorno */}
      <div className="flex items-center justify-between">
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors font-medium"
        >
          <ArrowLeft className="h-4 w-4" /> Voltar ao Painel
        </Link>
        {subscription?.isAccessAllowed && (
          <span className="text-xs bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-semibold px-3 py-1 rounded-full flex items-center gap-1.5">
            <CheckCircle2 className="h-3.5 w-3.5" />
            {subscription.status === "active" 
              ? `Plano Ativo: ${subscription.plan?.name || "Assinante"}`
              : `Período de Testes: ${subscription.daysRemaining} dias`}
          </span>
        )}
      </div>

      {/* Banner de Feedback de Pagamento */}
      {paymentStatus === "success" && (
        <div className="bg-emerald-500/15 border border-emerald-500/30 rounded-2xl p-6 text-center space-y-2">
          <CheckCircle2 className="h-10 w-10 text-emerald-500 mx-auto" />
          <h2 className="text-xl font-bold text-foreground">Pagamento Confirmado com Sucesso!</h2>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            Obrigado por assinar! Sua assinatura já está ativa e todos os recursos da plataforma estão liberados.
          </p>
          <div className="pt-2">
            <Link to="/">
              <Button className="font-semibold">Ir para o Painel Geral</Button>
            </Link>
          </div>
        </div>
      )}

      {paymentStatus === "pending" && (
        <div className="bg-amber-500/15 border border-amber-500/30 rounded-2xl p-6 text-center space-y-2">
          <Clock className="h-10 w-10 text-amber-500 mx-auto" />
          <h2 className="text-xl font-bold text-foreground">Pagamento em Processamento</h2>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            Se você pagou via PIX ou boleto, a confirmação leva apenas alguns segundos. Assim que o Mercado Pago aprovar, seu acesso será ativado automaticamente!
          </p>
        </div>
      )}

      {/* Cabeçalho da Página */}
      <div className="text-center space-y-4 max-w-2xl mx-auto">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-bold uppercase tracking-wider">
          <Sparkles className="h-3.5 w-3.5" /> Planos & Assinaturas
        </div>
        <h1 className="text-3xl sm:text-5xl font-black tracking-tight text-foreground">
          Escolha o plano ideal para alavancar seu negócio
        </h1>
        <p className="text-base text-muted-foreground">
          Assinatura mensal transparente via <strong>Mercado Pago</strong> com cancelamento a qualquer momento, sem fidelidade.
        </p>
      </div>

      {/* Grade de Planos */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-pulse">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-96 rounded-2xl bg-muted/60" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-stretch">
          {plans.map((plan) => {
            const isCurrentPlan = subscription?.status === "active" && subscription?.plan_id === plan.id;
            const isSubmitting = checkoutLoading && selectedPlanId === plan.id;

            return (
              <Card
                key={plan.id}
                className={`relative flex flex-col justify-between rounded-3xl transition-all duration-300 border-2 ${
                  plan.is_popular
                    ? "border-primary shadow-2xl scale-105 z-10 bg-card"
                    : "border-border/70 hover:border-border shadow-sm bg-card/80"
                }`}
              >
                {plan.is_popular && (
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
                    <span className="bg-primary text-white text-xs font-extrabold uppercase tracking-wider px-3.5 py-1 rounded-full shadow-md flex items-center gap-1.5">
                      <Zap className="h-3.5 w-3.5 fill-current" /> Mais Escolhido
                    </span>
                  </div>
                )}

                <div>
                  <CardHeader className="pb-4">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-2xl font-black">{plan.name}</CardTitle>
                      {isCurrentPlan && (
                        <span className="text-xs bg-emerald-500/15 text-emerald-600 font-bold px-2 py-0.5 rounded-full">
                          Plano Atual
                        </span>
                      )}
                    </div>
                    <CardDescription className="text-xs text-muted-foreground min-h-[36px]">
                      {plan.description}
                    </CardDescription>
                  </CardHeader>

                  <CardContent className="space-y-6">
                    {/* Preço */}
                    <div className="flex items-baseline gap-1">
                      <span className="text-xs font-semibold text-muted-foreground">R$</span>
                      <span className="text-4xl font-black text-foreground">
                        {Number(plan.price).toFixed(2).replace(".", ",")}
                      </span>
                      <span className="text-xs text-muted-foreground font-medium">/mês</span>
                    </div>

                    {/* Lista de Recursos */}
                    <div className="space-y-3 pt-4 border-t border-border/40">
                      <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                        O que está incluído:
                      </p>
                      <ul className="space-y-2.5">
                        {Array.isArray(plan.features) &&
                          plan.features.map((feature, idx) => (
                            <li key={idx} className="flex items-start gap-2.5 text-xs text-foreground/90">
                              <Check className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                              <span>{feature}</span>
                            </li>
                          ))}
                      </ul>
                    </div>
                  </CardContent>
                </div>

                <CardFooter className="pt-4 border-t border-border/40">
                  <Button
                    onClick={() => handleSubscribe(plan)}
                    disabled={checkoutLoading || isCurrentPlan}
                    className={`w-full h-11 font-bold rounded-xl transition-all ${
                      plan.is_popular ? "shadow-lg hover:opacity-95" : ""
                    }`}
                    variant={plan.is_popular ? "default" : "outline"}
                  >
                    {isSubmitting
                      ? "Conectando ao Mercado Pago..."
                      : isCurrentPlan
                      ? "Seu Plano Atual"
                      : `Assinar ${plan.name}`}
                  </Button>
                </CardFooter>
              </Card>
            );
          })}
        </div>
      )}

      {/* Garantias & Pagamento Seguro */}
      <div className="rounded-2xl border border-border/60 bg-muted/20 p-6 flex flex-col sm:flex-row items-center justify-around gap-6 text-center sm:text-left">
        <div className="flex items-center gap-3">
          <ShieldCheck className="h-8 w-8 text-primary shrink-0" />
          <div>
            <h4 className="text-sm font-bold text-foreground">Pagamento 100% Seguro</h4>
            <p className="text-xs text-muted-foreground">Processado com a segurança oficial do Mercado Pago</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <CreditCard className="h-8 w-8 text-primary shrink-0" />
          <div>
            <h4 className="text-sm font-bold text-foreground">PIX & Cartão de Crédito</h4>
            <p className="text-xs text-muted-foreground">Aprovação imediata com liberação instantânea</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Zap className="h-8 w-8 text-primary shrink-0" />
          <div>
            <h4 className="text-sm font-bold text-foreground">Cancele Quando Quiser</h4>
            <p className="text-xs text-muted-foreground">Sem contratos de fidelidade ou multas de rescisão</p>
          </div>
        </div>
      </div>

      {/* Perguntas Frequentes (FAQ) */}
      <div className="space-y-6 pt-4 border-t border-border/50 max-w-3xl mx-auto">
        <div className="text-center space-y-1">
          <h3 className="text-xl font-bold">Perguntas Frequentes</h3>
          <p className="text-xs text-muted-foreground">Tudo o que você precisa saber sobre a assinatura</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <div className="rounded-xl border border-border p-4 space-y-1.5 bg-card">
            <h4 className="font-bold text-foreground">Como funciona a cobrança?</h4>
            <p className="text-muted-foreground">
              A cobrança é mensal e renovada a cada 30 dias via Mercado Pago. Você pode pagar via PIX ou Cartão de Crédito.
            </p>
          </div>

          <div className="rounded-xl border border-border p-4 space-y-1.5 bg-card">
            <h4 className="font-bold text-foreground">Posso fazer upgrade de plano depois?</h4>
            <p className="text-muted-foreground">
              Sim! A qualquer momento você pode mudar para um plano superior pagando apenas a diferença.
            </p>
          </div>

          <div className="rounded-xl border border-border p-4 space-y-1.5 bg-card">
            <h4 className="font-bold text-foreground">Como cancelo minha assinatura?</h4>
            <p className="text-muted-foreground">
              Você pode cancelar a qualquer momento diretamente pelo painel ou na sua conta do Mercado Pago sem nenhuma burocracia.
            </p>
          </div>

          <div className="rounded-xl border border-border p-4 space-y-1.5 bg-card">
            <h4 className="font-bold text-foreground">Como funciona o suporte?</h4>
            <p className="text-muted-foreground">
              Nosso time atende via e-mail e canais integrados para auxiliar na configuração e uso de todas as automações.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
