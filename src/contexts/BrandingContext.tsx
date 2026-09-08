import { createContext, useContext, useEffect, useState, useCallback, useTransition } from "react";
import type { ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export interface BrandingSettings {
  app_name: string;
  app_tagline: string;
  primary_color: string;
  logo_url: string;
  favicon_url: string;
}

export const DEFAULT_BRANDING: BrandingSettings = {
  app_name: "PLATAFY Social",
  app_tagline: "Hub",
  primary_color: "#4d5b9a",
  logo_url: "",
  favicon_url: "",
};

const STORAGE_KEY = "platafy_branding_settings";

interface BrandingContextType {
  branding: BrandingSettings;
  loading: boolean;
  updateBranding: (newSettings: Partial<BrandingSettings>) => Promise<boolean>;
  resetToDefault: () => Promise<boolean>;
  applyBrandColors: (primaryColor: string) => void;
}

const BrandingContext = createContext<BrandingContextType | undefined>(undefined);

function applyBrandingToDOM(settings: BrandingSettings) {
  if (typeof document === "undefined") return;

  // 1. Injetar cores CSS primárias e acentos no :root
  if (settings.primary_color) {
    document.documentElement.style.setProperty("--primary", settings.primary_color);
    document.documentElement.style.setProperty("--ring", settings.primary_color);
    document.documentElement.style.setProperty("--accent", settings.primary_color);
  }

  // 2. Atualizar título da aba do navegador
  if (settings.app_name) {
    const tagline = settings.app_tagline ? ` ${settings.app_tagline}` : "";
    document.title = `${settings.app_name}${tagline} - Gestão Inteligente`;
  }

  // 3. Atualizar favicon
  if (settings.favicon_url) {
    let link = document.querySelector<HTMLLinkElement>("link[rel~='icon']");
    if (!link) {
      link = document.createElement("link");
      link.rel = "icon";
      document.getElementsByTagName("head")[0].appendChild(link);
    }
    link.href = settings.favicon_url;
  }
}

export function BrandingProvider({ children }: { children: ReactNode }) {
  const { tenantId, session } = useAuth();
  const [, startTransition] = useTransition();

  // Iniciar do localStorage para aplicação instantânea (zero layout shift)
  const [branding, setBranding] = useState<BrandingSettings>(() => {
    try {
      const cached = localStorage.getItem(STORAGE_KEY);
      if (cached) {
        const parsed = JSON.parse(cached);
        applyBrandingToDOM(parsed);
        return { ...DEFAULT_BRANDING, ...parsed };
      }
    } catch {
      // ignore
    }
    applyBrandingToDOM(DEFAULT_BRANDING);
    return DEFAULT_BRANDING;
  });

  const [loading, setLoading] = useState(false);

  const applyBrandColors = useCallback((primaryColor: string) => {
    if (typeof document === "undefined") return;
    document.documentElement.style.setProperty("--primary", primaryColor);
    document.documentElement.style.setProperty("--ring", primaryColor);
    document.documentElement.style.setProperty("--accent", primaryColor);
  }, []);

  // Carregar do Supabase quando o tenant estiver disponível
  useEffect(() => {
    if (!tenantId || !session) return;

    let isMounted = true;
    (async () => {
      try {
        const { data, error } = await (supabase.from("tenants" as any) as any)
          .select("branding, name")
          .eq("id", tenantId)
          .maybeSingle();

        if (error) {
          console.warn("Erro ao buscar branding do tenant:", error);
          return;
        }

        if (data && isMounted) {
          const remoteBranding: BrandingSettings = {
            ...DEFAULT_BRANDING,
            app_name: data.name || DEFAULT_BRANDING.app_name,
            ...(data.branding || {}),
          };

          startTransition(() => {
            setBranding(remoteBranding);
          });
          applyBrandingToDOM(remoteBranding);
          try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(remoteBranding));
          } catch {
            // ignore
          }
        }
      } catch (err) {
        console.error("Falha ao carregar branding:", err);
      }
    })();

    return () => {
      isMounted = false;
    };
  }, [tenantId, session]);

  // Atualizar configurações White Label
  const updateBranding = async (newSettings: Partial<BrandingSettings>): Promise<boolean> => {
    const updated: BrandingSettings = {
      ...branding,
      ...newSettings,
    };

    setLoading(true);
    try {
      if (tenantId) {
        const { error } = await (supabase.from("tenants" as any) as any)
          .update({
            branding: updated,
            name: updated.app_name || undefined,
          })
          .eq("id", tenantId);

        if (error) throw error;
      }


      setBranding(updated);
      applyBrandingToDOM(updated);
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      } catch {
        // ignore
      }

      toast.success("Identidade visual White Label atualizada com sucesso!");
      return true;
    } catch (err: any) {
      console.error("Erro ao salvar branding:", err);
      toast.error(err.message || "Erro ao salvar personalização.");
      return false;
    } finally {
      setLoading(false);
    }
  };

  // Restaurar padrões
  const resetToDefault = async (): Promise<boolean> => {
    return await updateBranding(DEFAULT_BRANDING);
  };

  return (
    <BrandingContext.Provider
      value={{
        branding,
        loading,
        updateBranding,
        resetToDefault,
        applyBrandColors,
      }}
    >
      {children}
    </BrandingContext.Provider>
  );
}

export function useBranding() {
  const context = useContext(BrandingContext);
  if (!context) {
    throw new Error("useBranding deve ser usado dentro de um BrandingProvider");
  }
  return context;
}
