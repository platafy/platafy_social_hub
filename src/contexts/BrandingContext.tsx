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
  logo_url: "https://sabzbazyxfxorrfshhgf.supabase.co/storage/v1/object/public/media/branding/logo-65aaac69-3248-446c-b846-fc602d67e8e5-1788795478376.png",
  favicon_url: "https://sabzbazyxfxorrfshhgf.supabase.co/storage/v1/object/public/media/branding/favicon-65aaac69-3248-446c-b846-fc602d67e8e5-1788795485699.png",
};

const STORAGE_KEY = "platafy_branding_settings";

export function sanitizeBranding(raw: any): BrandingSettings {
  if (!raw || typeof raw !== "object") return DEFAULT_BRANDING;
  const isLegacy = raw.app_name === "Social Hub" || raw.primary_color === "#ff451a";
  return {
    app_name: isLegacy ? DEFAULT_BRANDING.app_name : (raw.app_name || DEFAULT_BRANDING.app_name),
    app_tagline: raw.app_tagline || DEFAULT_BRANDING.app_tagline,
    primary_color: isLegacy ? DEFAULT_BRANDING.primary_color : (raw.primary_color || DEFAULT_BRANDING.primary_color),
    logo_url: (isLegacy || !raw.logo_url) ? DEFAULT_BRANDING.logo_url : raw.logo_url,
    favicon_url: (isLegacy || !raw.favicon_url) ? DEFAULT_BRANDING.favicon_url : raw.favicon_url,
  };
}

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

  // Iniciar do localStorage ou default sanitizado
  const [branding, setBranding] = useState<BrandingSettings>(() => {
    try {
      const cached = localStorage.getItem(STORAGE_KEY);
      if (cached) {
        const parsed = sanitizeBranding(JSON.parse(cached));
        applyBrandingToDOM(parsed);
        return parsed;
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

  // 1. Carregar a identidade global da plataforma (platform_branding) para todos os usuários
  useEffect(() => {
    let isMounted = true;
    (async () => {
      try {
        const { data, error } = await (supabase.from("platform_branding" as any) as any)
          .select("branding")
          .eq("id", 1)
          .maybeSingle();

        if (error) {
          console.warn("Erro ao buscar platform_branding:", error);
          return;
        }

        if (data?.branding && isMounted) {
          const remoteBranding = sanitizeBranding(data.branding);

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
        console.error("Falha ao carregar platform_branding:", err);
      }
    })();

    return () => {
      isMounted = false;
    };
  }, []);

  // 2. Se o usuário estiver logado e seu tenant tiver branding personalizado, sincroniza
  useEffect(() => {
    if (!tenantId || !session) return;

    let isMounted = true;
    (async () => {
      try {
        const { data, error } = await (supabase.from("tenants" as any) as any)
          .select("branding, name")
          .eq("id", tenantId)
          .maybeSingle();

        if (error || !data || !isMounted) return;

        // Se o tenant tiver branding customizado e não for o script legado
        if (data.branding && data.branding.app_name && data.branding.app_name !== "Social Hub") {
          const tenantBranding = sanitizeBranding({
            ...branding,
            app_name: data.name || branding.app_name,
            ...data.branding,
          });

          startTransition(() => {
            setBranding(tenantBranding);
          });
          applyBrandingToDOM(tenantBranding);
          try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(tenantBranding));
          } catch {
            // ignore
          }
        }
      } catch (err) {
        console.warn("Falha ao sincronizar branding do tenant:", err);
      }
    })();

    return () => {
      isMounted = false;
    };
  }, [tenantId, session]);

  // Atualizar configurações White Label (Super Admin)
  const updateBranding = async (newSettings: Partial<BrandingSettings>): Promise<boolean> => {
    const updated: BrandingSettings = {
      ...branding,
      ...newSettings,
    };

    setLoading(true);
    try {
      // 1. Atualizar a tabela global da plataforma para todos os clientes
      const { error: platformError } = await (supabase.from("platform_branding" as any) as any)
        .upsert({
          id: 1,
          branding: updated,
          updated_at: new Date().toISOString(),
        });

      if (platformError) {
        console.warn("Erro ao salvar platform_branding:", platformError);
      }

      // 2. Atualizar também o tenant do administrador
      if (tenantId) {
        await (supabase.from("tenants" as any) as any)
          .update({
            branding: updated,
            name: updated.app_name || undefined,
          })
          .eq("id", tenantId);
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
