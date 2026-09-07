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

export function SubscriptionProvider({ children }: { children: ReactNode }) {
  const { tenantId, session } = useAuth();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [subscription, setSubscription] = useState<SubscriptionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [, startTransition] = useTransition();

  // 1. Carregar lista de planos públicos
  const fetchPlans = useCallback(async () => {
    try {
      const { data, error } = await (supabase.from("plans" as any) as any)
        .select("*")
        .eq("is_active", true)
        .order("price", { ascending: true });

      if (error) throw error;
      if (data) {
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
