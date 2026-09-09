import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useSubscription, DEFAULT_PLANS } from "@/contexts/SubscriptionContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { toast } from "sonner";
import {
  CreditCard,
  CheckCircle2,
  RefreshCw,
  ShieldCheck,
  Zap,
  Sparkles,
  Plus,
  Trash2,
  ExternalLink,
  Eye,
  Sliders,
  DollarSign,
  ArrowRight,
  RotateCcw,
  Users
} from "lucide-react";
import { Link } from "react-router-dom";

interface PlanFormState {
  id: string;
  name: string;
  slug: string;
  description: string;
  price: number;
  currency: string;
  interval: string;
  features: string[];
  limits: {
    max_profiles?: number;
    max_channels?: number;
    max_posts?: number;
    max_contacts?: number;
    ai_automations?: boolean;
    white_label?: boolean;
    [key: string]: any;
  };
  is_popular: boolean;
  is_active: boolean;
}

export function SuperAdminPlans() {
  const { isSuperAdmin } = useAuth();
  const { refreshPlans } = useSubscription();

  const [plans, setPlans] = useState<PlanFormState[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingPlanId, setSavingPlanId] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<"editor" | "preview">("editor");

  // Carregar planos do banco de dados
  const loadPlans = async () => {
    setLoading(true);
    try {
      const { data, error } = await (supabase.from("plans" as any) as any)
        .select("*")
        .order("price", { ascending: true });

      if (error) {
        console.warn("Erro ao buscar planos:", error);
        toast.error("Não foi possível carregar os planos remotos. Usando valores locais.");
        setPlans(DEFAULT_PLANS.map(p => ({ ...p, is_active: true })));
        return;
      }

      if (data && data.length > 0) {
        setPlans(
          data.map((p: any) => ({
            id: p.id,
            name: p.name || "",
            slug: p.slug || "",
            description: p.description || "",
            price: Number(p.price) || 0,
            currency: p.currency || "BRL",
            interval: p.interval || "monthly",
            features: Array.isArray(p.features) ? p.features : [],
            limits: typeof p.limits === "object" && p.limits !== null ? p.limits : {},
            is_popular: Boolean(p.is_popular),
            is_active: p.is_active !== undefined ? Boolean(p.is_active) : true,
          }))
        );
      } else {
        setPlans(DEFAULT_PLANS.map(p => ({ ...p, is_active: true })));
      }
    } catch (err: any) {
      console.error("Erro inesperado ao carregar planos:", err);
      toast.error(err.message || "Erro ao carregar planos");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isSuperAdmin) {
      loadPlans();
    }
  }, [isSuperAdmin]);

  if (!isSuperAdmin) return null;

  // Atualizar campo genérico de um plano
  const handleUpdateField = (planId: string, field: keyof PlanFormState, value: any) => {
    setPlans(prev =>
      prev.map(plan => {
        if (plan.id === planId) {
          // Se marcar este como popular, desmarca os outros para manter apenas 1 destaque
          if (field === "is_popular" && value === true) {
            // Apenas atualiza este
          }
          return { ...plan, [field]: value };
        }
        if (field === "is_popular" && value === true) {
          return { ...plan, is_popular: false };
        }
        return plan;
      })
    );
  };

  // Atualizar campo de limites
  const handleUpdateLimit = (planId: string, limitKey: string, value: any) => {
    setPlans(prev =>
      prev.map(plan => {
        if (plan.id === planId) {
          return {
            ...plan,
            limits: {
              ...plan.limits,
              [limitKey]: value,
            },
          };
        }
        return plan;
      })
    );
  };

  // Manipulação de recursos/features
  const handleAddFeature = (planId: string) => {
    setPlans(prev =>
      prev.map(plan => {
        if (plan.id === planId) {
          return {
            ...plan,
            features: [...plan.features, "Novo benefício do plano"],
          };
        }
        return plan;
      })
    );
  };

  const handleUpdateFeature = (planId: string, index: number, value: string) => {
    setPlans(prev =>
      prev.map(plan => {
        if (plan.id === planId) {
          const updated = [...plan.features];
          updated[index] = value;
          return { ...plan, features: updated };
        }
        return plan;
      })
    );
  };

  const handleRemoveFeature = (planId: string, index: number) => {
    setPlans(prev =>
      prev.map(plan => {
        if (plan.id === planId) {
          return {
            ...plan,
            features: plan.features.filter((_, i) => i !== index),
          };
        }
        return plan;
      })
    );
  };

  // Restaurar valores padrão para um plano específico
  const handleResetToDefault = (planId: string) => {
    const defaultPlan = DEFAULT_PLANS.find(p => p.id === planId);
    if (!defaultPlan) return;

    setPlans(prev =>
      prev.map(plan => {
        if (plan.id === planId) {
          return { ...defaultPlan, is_active: true };
        }
        return plan;
      })
    );
    toast.info(`Valores originais restaurados para o plano ${defaultPlan.name}. Clique em Salvar para persistir.`);
  };

  // Salvar plano no backend e Supabase
  const handleSavePlan = async (plan: PlanFormState) => {
    setSavingPlanId(plan.id);

    try {
      // 1. Tentar salvar via Edge Function admin-clients (com auditoria oficial)
      let edgeSuccess = false;
      try {
        const { data, error } = await supabase.functions.invoke("admin-clients", {
          body: {
            action: "save-plan",
            id: plan.id,
            name: plan.name,
            description: plan.description,
            price: Number(plan.price),
            features: plan.features,
            limits: plan.limits,
            is_popular: plan.is_popular,
            is_active: plan.is_active,
          },
        });

        if (!error && (data?.success || data?.plan)) {
          edgeSuccess = true;
        } else if (error) {
          console.warn("Edge function save-plan avisou:", error);
        }
      } catch (e) {
        console.warn("Falha ao invocar admin-clients para save-plan, tentando fallback direto:", e);
      }

      // 2. Se a edge function não respondeu com sucesso, atualizar direto via Supabase (com a nova RLS)
      if (!edgeSuccess) {
        const { error: dbError } = await (supabase.from("plans" as any) as any)
          .update({
            name: plan.name,
            description: plan.description,
            price: Number(plan.price),
            features: plan.features,
            limits: plan.limits,
            is_popular: plan.is_popular,
            is_active: plan.is_active,
          })
          .eq("id", plan.id);

        if (dbError) throw dbError;
      }

      // 3. Atualizar contexto global de assinatura para que /planos sincronize na hora
      await refreshPlans();

      toast.success(`Plano "${plan.name}" salvo com sucesso!`, {
        description: `Novo valor: R$ ${Number(plan.price).toFixed(2).replace(".", ",")} / mês já em vigor no checkout e na página de planos.`,
      });
    } catch (err: any) {
      console.error("Erro ao salvar plano:", err);
      toast.error(err.message || "Erro ao salvar alterações do plano.");
    } finally {
      setSavingPlanId(null);
    }
  };

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Cabeçalho Principal do Super Admin */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/80 pb-6">
        <div>
          <div className="flex items-center gap-2.5 mb-1.5">
            <div className="p-2 rounded-xl bg-primary/10 text-primary">
              <CreditCard className="w-6 h-6" />
            </div>
            <h1 className="text-2xl font-extrabold tracking-tight text-foreground">
              Planos & Preços (SaaS)
            </h1>
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-primary/10 text-primary border border-primary/25">
              <ShieldCheck className="w-3.5 h-3.5" /> Super Admin
            </span>
          </div>
          <p className="text-sm text-muted-foreground max-w-3xl">
            Edite em tempo real os <strong>valores em R$</strong>, títulos, descrições, status e benefícios de cada plano.
            As mudanças são refletidas <strong>instantaneamente</strong> na página pública de vendas e no checkout do Mercado Pago.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <div className="inline-flex rounded-xl bg-muted p-1 border border-border">
            <button
              type="button"
              onClick={() => setActiveView("editor")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeView === "editor"
                  ? "bg-card text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Sliders className="h-3.5 w-3.5" /> Editor
            </button>
            <button
              type="button"
              onClick={() => setActiveView("preview")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeView === "preview"
                  ? "bg-card text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Eye className="h-3.5 w-3.5" /> Preview Ao Vivo
            </button>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={loadPlans}
            disabled={loading}
            className="text-xs border-border"
          >
            <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${loading ? "animate-spin" : ""}`} />
            Recarregar
          </Button>

          <Link to="/planos" target="_blank" rel="noreferrer">
            <Button size="sm" className="text-xs font-semibold gap-1.5">
              <span>Abrir /planos</span>
              <ExternalLink className="h-3.5 w-3.5" />
            </Button>
          </Link>
        </div>
      </div>

      {/* Cards de Resumo & Destaques de Preços */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {plans.map(plan => (
          <div
            key={plan.id}
            className={`p-4 rounded-2xl border transition-all ${
              plan.is_popular
                ? "bg-primary/5 border-primary/40 shadow-xs"
                : "bg-card border-border/70"
            }`}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                {plan.name}
              </span>
              {plan.is_popular && (
                <span className="text-[10px] uppercase font-black bg-primary text-primary-foreground px-2 py-0.5 rounded-full flex items-center gap-1">
                  <Zap className="h-2.5 w-2.5 fill-current" /> Destaque
                </span>
              )}
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-xs font-semibold text-muted-foreground">R$</span>
              <span className="text-2xl font-black text-foreground">
                {Number(plan.price).toFixed(2).replace(".", ",")}
              </span>
              <span className="text-xs text-muted-foreground font-medium">/mês</span>
            </div>
            <p className="text-[11px] text-muted-foreground mt-1 truncate">
              {plan.description}
            </p>
          </div>
        ))}
      </div>

      {/* Visualização: Preview Ao Vivo (como os clientes veem) */}
      {activeView === "preview" && (
        <div className="space-y-4 p-6 rounded-3xl border border-primary/20 bg-muted/20">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-bold text-foreground">
              <Eye className="h-4 w-4 text-primary" />
              <span>Prévia em Tempo Real da Página Pública (/planos)</span>
            </div>
            <span className="text-xs text-muted-foreground">
              Atualiza instantaneamente conforme você altera valores
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-stretch pt-4">
            {plans.map(plan => (
              <Card
                key={plan.id}
                className={`relative flex flex-col justify-between rounded-3xl transition-all duration-300 border-2 ${
                  plan.is_popular
                    ? "border-primary shadow-xl scale-[1.02] z-10 bg-card"
                    : "border-border/70 bg-card/80"
                }`}
              >
                {plan.is_popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="bg-primary text-white text-[10px] font-extrabold uppercase tracking-wider px-3 py-0.5 rounded-full shadow-md flex items-center gap-1">
                      <Zap className="h-3 w-3 fill-current" /> Mais Escolhido
                    </span>
                  </div>
                )}

                <div>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-xl font-black">{plan.name}</CardTitle>
                      {!plan.is_active && (
                        <span className="text-[10px] bg-red-500/15 text-red-600 font-bold px-2 py-0.5 rounded-full">
                          Inativo
                        </span>
                      )}
                    </div>
                    <CardDescription className="text-xs text-muted-foreground min-h-[32px]">
                      {plan.description}
                    </CardDescription>
                  </CardHeader>

                  <CardContent className="space-y-4">
                    <div className="flex items-baseline gap-1">
                      <span className="text-xs font-semibold text-muted-foreground">R$</span>
                      <span className="text-3xl font-black text-foreground">
                        {Number(plan.price).toFixed(2).replace(".", ",")}
                      </span>
                      <span className="text-xs text-muted-foreground font-medium">/mês</span>
                    </div>

                    <div className="space-y-2 pt-3 border-t border-border/40">
                      <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                        O que está incluído:
                      </p>
                      <ul className="space-y-2">
                        {plan.features.map((feat, idx) => (
                          <li key={idx} className="flex items-start gap-2 text-xs text-foreground/90">
                            <CheckCircle2 className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
                            <span>{feat}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </CardContent>
                </div>

                <CardFooter className="pt-3 border-t border-border/40">
                  <Button
                    className="w-full h-10 font-bold rounded-xl pointer-events-none"
                    variant={plan.is_popular ? "default" : "outline"}
                  >
                    Assinar {plan.name}
                  </Button>
                </CardFooter>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Visualização: Editor de Planos */}
      {activeView === "editor" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
          {plans.map(plan => {
            const isSaving = savingPlanId === plan.id;

            return (
              <Card
                key={plan.id}
                className={`border-2 transition-all duration-200 bg-card flex flex-col justify-between ${
                  plan.is_popular
                    ? "border-primary/60 shadow-md ring-1 ring-primary/20"
                    : "border-border/70 hover:border-border"
                }`}
              >
                {/* Header do Card com Destaque e Status */}
                <CardHeader className="pb-4">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <CardTitle className="text-xl font-black text-foreground">
                          {plan.name}
                        </CardTitle>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-muted text-muted-foreground">
                          {plan.slug}
                        </span>
                      </div>
                      <CardDescription className="text-xs mt-1 text-muted-foreground">
                        ID: {plan.id.slice(0, 8)}...
                      </CardDescription>
                    </div>

                    <div className="flex flex-col items-end gap-1.5">
                      <label className="flex items-center gap-1.5 cursor-pointer text-xs font-semibold text-foreground">
                        <input
                          type="checkbox"
                          checked={plan.is_popular}
                          onChange={e => handleUpdateField(plan.id, "is_popular", e.target.checked)}
                          className="rounded border-border text-primary focus:ring-primary h-3.5 w-3.5"
                        />
                        <span>Mais Escolhido</span>
                      </label>
                      <label className="flex items-center gap-1.5 cursor-pointer text-xs font-semibold text-foreground">
                        <input
                          type="checkbox"
                          checked={plan.is_active}
                          onChange={e => handleUpdateField(plan.id, "is_active", e.target.checked)}
                          className="rounded border-border text-primary focus:ring-primary h-3.5 w-3.5"
                        />
                        <span className={plan.is_active ? "text-emerald-600" : "text-muted-foreground"}>
                          {plan.is_active ? "Ativo" : "Inativo"}
                        </span>
                      </label>
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="space-y-5 flex-1">
                  {/* Campo de Preço Mensal (O MAIS IMPORTANTE) */}
                  <div className="p-4 rounded-2xl bg-gradient-to-br from-primary/10 via-primary/5 to-transparent border-2 border-primary/30 space-y-2">
                    <Label className="text-xs font-bold uppercase tracking-wider text-foreground flex items-center justify-between">
                      <span className="flex items-center gap-1 text-primary">
                        <DollarSign className="h-4 w-4" /> Preço Mensal (R$)
                      </span>
                      <span className="text-[11px] font-normal text-muted-foreground">
                        Cobrado via Mercado Pago
                      </span>
                    </Label>

                    <div className="flex items-center gap-2">
                      <div className="relative flex-1">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold text-muted-foreground">
                          R$
                        </span>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          value={plan.price}
                          onChange={e => {
                            const val = parseFloat(e.target.value);
                            handleUpdateField(plan.id, "price", isNaN(val) ? 0 : val);
                          }}
                          className="pl-10 h-11 text-lg font-black bg-card border-primary/40 focus-visible:ring-primary"
                          placeholder="0,00"
                        />
                      </div>
                      <span className="text-xs font-semibold text-muted-foreground whitespace-nowrap">
                        / mês
                      </span>
                    </div>

                    <div className="flex items-center justify-between pt-1 text-[11px] text-muted-foreground">
                      <span>Exibição formatada:</span>
                      <strong className="text-foreground">
                        R$ {Number(plan.price).toFixed(2).replace(".", ",")}
                      </strong>
                    </div>
                  </div>

                  {/* Nome do Plano */}
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-foreground">
                      Nome de Exibição
                    </Label>
                    <Input
                      type="text"
                      value={plan.name}
                      onChange={e => handleUpdateField(plan.id, "name", e.target.value)}
                      className="h-9 text-sm"
                      placeholder="Ex: Starter, Pro..."
                    />
                  </div>

                  {/* Descrição do Plano */}
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-foreground">
                      Descrição Resumida
                    </Label>
                    <textarea
                      rows={2}
                      value={plan.description}
                      onChange={e => handleUpdateField(plan.id, "description", e.target.value)}
                      className="w-full text-xs rounded-xl border border-input bg-card px-3 py-2 text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary resize-none"
                      placeholder="Descrição atrativa para o cliente..."
                    />
                  </div>

                  {/* Limites Técnicos */}
                  <div className="space-y-3 pt-3 border-t border-border/50">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                        Limites da Plataforma
                      </Label>
                      <span className="text-[10px] text-muted-foreground">(-1 = ilimitado)</span>
                    </div>

                    {/* Perfis Ativos (Unidade Principal do Limite Comercial) */}
                    <div className="p-3 rounded-xl bg-violet-500/10 border border-violet-500/20 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <Label className="text-xs font-bold text-violet-700 dark:text-violet-300 flex items-center gap-1.5">
                          <Users className="h-3.5 w-3.5" /> Perfis Ativos
                        </Label>
                        <span className="text-[10px] font-bold text-violet-600 dark:text-violet-400">
                          {plan.limits?.max_profiles === -1
                            ? "Ilimitados"
                            : `${plan.limits?.max_profiles ?? (plan.slug === 'starter' ? 1 : plan.slug === 'pro' ? 5 : 1)} perfis × 2 = até ${(plan.limits?.max_profiles ?? (plan.slug === 'starter' ? 1 : plan.slug === 'pro' ? 5 : 1)) * 2} contas`}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Input
                          type="number"
                          value={plan.limits?.max_profiles !== undefined ? plan.limits.max_profiles : (plan.limits?.max_channels === -1 ? -1 : Math.max(1, Math.ceil((plan.limits?.max_channels || 2) / 2)))}
                          onChange={e => {
                            const val = parseInt(e.target.value);
                            const numProfiles = isNaN(val) ? 0 : val;
                            handleUpdateLimit(plan.id, "max_profiles", numProfiles);
                            const derivedChannels = numProfiles === -1 ? -1 : numProfiles * 2;
                            handleUpdateLimit(plan.id, "max_channels", derivedChannels);
                          }}
                          className="h-8 text-xs font-bold bg-background border-violet-500/40 focus-visible:ring-violet-500"
                        />
                        <span className="text-[11px] text-muted-foreground whitespace-nowrap">
                          {plan.limits?.max_profiles === -1 ? "Ilimitados" : "Perfis Ativos"}
                        </span>
                      </div>
                      <p className="text-[10px] text-muted-foreground leading-tight">
                        Cada Perfil Ativo permite até 2 contas gratuitas conectadas através do Zernio.
                      </p>
                    </div>

                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <span className="text-[10px] text-muted-foreground block mb-1">Contas Sociais</span>
                        <Input
                          type="number"
                          value={plan.limits?.max_channels !== undefined ? plan.limits.max_channels : ((plan.limits?.max_profiles ?? 1) === -1 ? -1 : (plan.limits?.max_profiles ?? 1) * 2)}
                          onChange={e =>
                            handleUpdateLimit(plan.id, "max_channels", parseInt(e.target.value) || 0)
                          }
                          className="h-8 text-xs font-medium"
                        />
                      </div>
                      <div>
                        <span className="text-[10px] text-muted-foreground block mb-1">Posts/mês</span>
                        <Input
                          type="number"
                          value={plan.limits?.max_posts !== undefined ? plan.limits.max_posts : 50}
                          onChange={e =>
                            handleUpdateLimit(plan.id, "max_posts", parseInt(e.target.value) || 0)
                          }
                          className="h-8 text-xs font-medium"
                        />
                      </div>
                      <div>
                        <span className="text-[10px] text-muted-foreground block mb-1">Contatos</span>
                        <Input
                          type="number"
                          value={plan.limits?.max_contacts !== undefined ? plan.limits.max_contacts : 100}
                          onChange={e =>
                            handleUpdateLimit(plan.id, "max_contacts", parseInt(e.target.value) || 0)
                          }
                          className="h-8 text-xs font-medium"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 pt-1">
                      <label className="flex items-center gap-2 p-2 rounded-xl border border-border/70 bg-muted/20 cursor-pointer text-xs">
                        <input
                          type="checkbox"
                          checked={Boolean(plan.limits?.ai_automations)}
                          onChange={e => handleUpdateLimit(plan.id, "ai_automations", e.target.checked)}
                          className="rounded border-border text-primary h-3.5 w-3.5"
                        />
                        <span className="font-semibold text-foreground">Automação IA</span>
                      </label>

                      <label className="flex items-center gap-2 p-2 rounded-xl border border-border/70 bg-muted/20 cursor-pointer text-xs">
                        <input
                          type="checkbox"
                          checked={Boolean(plan.limits?.white_label)}
                          onChange={e => handleUpdateLimit(plan.id, "white_label", e.target.checked)}
                          className="rounded border-border text-primary h-3.5 w-3.5"
                        />
                        <span className="font-semibold text-foreground">White Label</span>
                      </label>
                    </div>
                  </div>

                  {/* Lista de Benefícios (Features) */}
                  <div className="space-y-2.5 pt-3 border-t border-border/50">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                        Benefícios Inclusos ({plan.features.length})
                      </Label>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => handleAddFeature(plan.id)}
                        className="h-6 px-2 text-[11px] text-primary hover:text-primary font-bold gap-1"
                      >
                        <Plus className="h-3 w-3" /> Adicionar
                      </Button>
                    </div>

                    <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                      {plan.features.map((feat, idx) => (
                        <div key={idx} className="flex items-center gap-1.5">
                          <Input
                            type="text"
                            value={feat}
                            onChange={e => handleUpdateFeature(plan.id, idx, e.target.value)}
                            className="h-8 text-xs flex-1"
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRemoveFeature(plan.id, idx)}
                            className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10 shrink-0 rounded-lg"
                            title="Remover benefício"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                </CardContent>

                {/* Footer do Card com Botão de Salvar */}
                <CardFooter className="pt-4 border-t border-border/60 flex items-center justify-between gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => handleResetToDefault(plan.id)}
                    className="h-9 px-2.5 text-xs text-muted-foreground hover:text-foreground gap-1.5"
                    title="Restaurar valores padrão deste plano"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">Padrão</span>
                  </Button>

                  <Button
                    type="button"
                    onClick={() => handleSavePlan(plan)}
                    disabled={isSaving}
                    className="h-9 px-4 font-bold text-xs shadow-sm gap-1.5 flex-1"
                  >
                    {isSaving ? (
                      <>
                        <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                        <span>Salvando...</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        <span>Salvar Plano {plan.name}</span>
                      </>
                    )}
                  </Button>
                </CardFooter>
              </Card>
            );
          })}
        </div>
      )}

      {/* Rodapé Informativo */}
      <div className="p-4 rounded-2xl border border-border/70 bg-card/60 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-muted-foreground">
        <div className="flex items-center gap-2.5">
          <Sparkles className="h-4 w-4 text-primary shrink-0" />
          <span>
            <strong>Sincronização Ativa:</strong> As assinaturas recorrentes continuam ativas para os clientes que já assinaram; novos clientes e upgrades adotam imediatamente o novo valor configurado no checkout do Mercado Pago.
          </span>
        </div>
        <Link to="/planos" className="text-primary hover:underline font-semibold whitespace-nowrap flex items-center gap-1">
          <span>Ver página pública de planos</span>
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    </div>
  );
}
