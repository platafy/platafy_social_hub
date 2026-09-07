import { createContext, useContext, useEffect, useState, useCallback, useTransition } from "react";
import type { ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export interface Plan {
  id: string;
  name: string;
  slug: string;
  description: string;
  price: number;
  currency: string;
  interval: string;
  features: string[];
  limits: Record<string, any>;
  is_popular: boolean;
}

export type SubscriptionStatus = "trialing" | "active" | "past_due" | "canceled" | "none";

export interface SubscriptionData {
  id?: string;
  status: SubscriptionStatus;
  plan_id?: string | null;
  plan?: Plan | null;
  trial_ends_at?: string | null;
  current_period_end?: string | null;
  daysRemaining: number;
  isAccessAllowed: boolean;
}

interface SubscriptionContextType {
  plans: Plan[];
  subscription: SubscriptionData | null;
  loading: boolean;
  checkoutLoading: boolean;
  createCheckout: (planId: string) => Promise<string | null>;
  refreshSubscription: () => Promise<void>;
}

const SubscriptionContext = createContext<SubscriptionContextType | undefined>(undefined);

export const DEFAULT_PLANS: Plan[] = [
  {
    id: "7159e5c6-c75e-4979-a033-115de7036285",
    name: "Starter",
    slug: "starter",
    description: "Perfeito para autônomos e pequenos criadores de conteúdo",
    price: 47.00,
    currency: "BRL",
    interval: "monthly",
    features: [
      "Até 3 redes sociais conectadas",
      "50 posts agendados por mês",
      "Inbox e DMs unificados",
      "Gestão de até 100 contatos",
      "Suporte por e-mail"
    ],
    limits: { max_channels: 3, max_posts: 50, max_contacts: 100, ai_automations: false },
    is_popular: false
  },
  {
    id: "b46eb6f2-b29b-4d40-ba37-2ecf82989436",
    name: "Pro",
    slug: "pro",
    description: "O mais recomendado para empresas, profissionais e criadores em crescimento",
    price: 97.00,
    currency: "BRL",
    interval: "monthly",
    features: [
      "Até 10 redes sociais conectadas",
      "Publicações e agendamentos ilimitados",
      "Automação com IA (Gemini, OpenAI, Claude)",
      "Moderação inteligente de comentários",
      "CRM completo de contatos",
      "Suporte prioritário"
    ],
    limits: { max_channels: 10, max_posts: -1, max_contacts: 1000, ai_automations: true },
    is_popular: true
  },
  {
    id: "d3f7413c-7b11-425f-9d95-cf39fc2d0b59",
    name: "Agência",
    slug: "agency",
    description: "Para agências e negócios que gerenciam múltiplas marcas e clientes",
    price: 197.00,
    currency: "BRL",
    interval: "monthly",
    features: [
      "Redes sociais ilimitadas",
      "Múltiplas contas Zernio integradas",
      "Automação com IA com todas as LLMs",
      "Personalização White Label completa",
      "Acesso prioritário a novos recursos",
      "Gerente de conta dedicado"
    ],
    limits: { max_channels: -1, max_posts: -1, max_contacts: -1, ai_automations: true, white_label: true },
    is_popular: false
  }
];

export function SubscriptionProvider({ children }: { children: ReactNode }) {
  const { tenantId, session } = useAuth();
  const [plans, setPlans] = useState<Plan[]>(DEFAULT_PLANS);
  const [subscription, setSubscription] = useState<SubscriptionData | null>(null);
  const [loading, setLoading] = useState(false);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [, startTransition] = useTransition();

  // 1. Carregar lista de planos públicos
  const fetchPlans = useCallback(async () => {
    try {
      const { data, error } = await (supabase.from("plans" as any) as any)
        .select("*")
        .eq("is_active", true)
        .order("price", { ascending: true });

      if (error) {
        console.warn("Erro ao buscar planos remotos (usando padrão):", error);
        return;
      }
      if (data && data.length > 0) {
        setPlans(data as Plan[]);
      }
    } catch (err) {
      console.warn("Erro ao buscar planos:", err);
    }
  }, []);

  // 2. Carregar dados da assinatura do tenant
  const fetchSubscription = useCallback(async () => {
    if (!tenantId || !session) {
      setSubscription(null);
      setLoading(false);
      return;
    }

    try {
      const { data: sub, error } = await (supabase.from("subscriptions" as any) as any)
        .select("*, plan:plans(*)")
        .eq("tenant_id", tenantId)
        .maybeSingle();

      if (error && error.code !== "PGRST116") {
        console.warn("Erro ao buscar assinatura:", error);
      }

      const now = new Date();

      if (sub) {
        let isAccessAllowed = false;
        let daysRemaining = 0;

        if (sub.status === "active") {
          // Ativo se a data de expiração for no futuro (ou sem expiração definida)
          if (!sub.current_period_end || new Date(sub.current_period_end) > now) {
            isAccessAllowed = true;
            if (sub.current_period_end) {
              const diffTime = Math.abs(new Date(sub.current_period_end).getTime() - now.getTime());
              daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            }
          }
        } else if (sub.status === "trialing") {
          if (sub.trial_ends_at && new Date(sub.trial_ends_at) > now) {
            isAccessAllowed = true;
            const diffTime = Math.abs(new Date(sub.trial_ends_at).getTime() - now.getTime());
            daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
          }
        }

        const subData: SubscriptionData = {
          id: sub.id,
          status: sub.status as SubscriptionStatus,
          plan_id: sub.plan_id,
          plan: sub.plan as Plan,
          trial_ends_at: sub.trial_ends_at,
          current_period_end: sub.current_period_end,
          daysRemaining,
          isAccessAllowed,
        };

        startTransition(() => {
          setSubscription(subData);
        });
      } else {
        // Sem registro de assinatura
        setSubscription({
          status: "none",
          daysRemaining: 0,
          isAccessAllowed: false,
        });
      }
    } catch (err) {
      console.error("Erro ao calcular status de assinatura:", err);
    } finally {
      setLoading(false);
    }
  }, [tenantId, session]);

  useEffect(() => {
    fetchPlans();
  }, [fetchPlans]);

  useEffect(() => {
    fetchSubscription();
  }, [fetchSubscription]);

  // 3. Criar checkout no Mercado Pago
  const createCheckout = async (planId: string): Promise<string | null> => {
    setCheckoutLoading(true);
    try {
      const origin = window.location.origin;
      const { data, error } = await supabase.functions.invoke("mercadopago-checkout", {
        body: { plan_id: planId, origin },
      });

      if (error) {
        throw new Error(error.message || "Erro ao conectar com Mercado Pago");
      }

      if (data?.error) {
        throw new Error(data.error);
      }

      const checkoutUrl = data?.init_point || data?.sandbox_init_point;
      if (!checkoutUrl) {
        throw new Error("URL de checkout não retornada pelo Mercado Pago");
      }

      return checkoutUrl;
    } catch (err: any) {
      console.error("Falha no checkout:", err);
      toast.error(err.message || "Erro ao iniciar pagamento no Mercado Pago.");
      return null;
    } finally {
      setCheckoutLoading(false);
    }
  };

  return (
    <SubscriptionContext.Provider
      value={{
        plans,
        subscription,
        loading,
        checkoutLoading,
        createCheckout,
        refreshSubscription: fetchSubscription,
      }}
    >
      {children}
    </SubscriptionContext.Provider>
  );
}

export function useSubscription() {
  const context = useContext(SubscriptionContext);
  if (!context) {
    throw new Error("useSubscription deve ser usado dentro de um SubscriptionProvider");
  }
  return context;
}
