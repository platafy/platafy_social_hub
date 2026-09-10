import { createContext, useContext, useEffect, useState, useCallback, useTransition } from "react";
import type { ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export interface BrandingSettings {
  app_name: string;
  app_tagline: string;
  primary_color: string; // fallback / compatibilidade legado
  primary_color_light: string;
  primary_color_dark: string;
  logo_url: string;
  favicon_url: string;
  tutorial_video_url?: string;
  // Login customization fields
  login_headline?: string;
  login_subheadline?: string;
  login_stats_enabled?: boolean;
  login_logo_position?: "left" | "right" | "top";
  login_bg_image_url?: string;
  login_bg_layout?: "split-left" | "split-right" | "fullscreen";
  footer_text?: string;
  // SEO & Compartilhamento Social (WhatsApp / Open Graph)
  og_image_url?: string;
  og_title?: string;
  og_description?: string;
}

export const DEFAULT_BRANDING: BrandingSettings = {
  app_name: "PLATAFY Social",
  app_tagline: "Hub",
  primary_color: "#fca102",
  primary_color_light: "#4d5b9a",
  primary_color_dark: "#fca102",
  logo_url: "https://sabzbazyxfxorrfshhgf.supabase.co/storage/v1/object/public/media/branding/logo-65aaac69-3248-446c-b846-fc602d67e8e5-1788896633632.png",
  favicon_url: "https://sabzbazyxfxorrfshhgf.supabase.co/storage/v1/object/public/media/branding/favicon-65aaac69-3248-446c-b846-fc602d67e8e5-1788896641236.png",
  tutorial_video_url: "/criar-conta.mp4",
  login_headline: "Transforme Conversas em\nVendas com Agentes de IA",
  login_subheadline: "A PLATAFY reúne Agentes de Inteligência Artificial, automação de atendimento, CRM, WhatsApp e múltiplos canais para acelerar o crescimento da sua empresa 24 horas por dia.",
  login_stats_enabled: false,
  login_logo_position: "right",
  login_bg_image_url: "/login-bg.webp",
  login_bg_layout: "split-left",
  footer_text: "© 2026 PLATAFY. Todos os direitos reservados.",
  og_image_url: "https://sabzbazyxfxorrfshhgf.supabase.co/storage/v1/object/public/media/branding/og-default.jpg",
  og_title: "PLATAFY Social Hub - Gestão Inteligente de Redes Sociais",
  og_description: "Automatize comentários, DMs e publicações multicanais com Inteligência Artificial.",
};

const STORAGE_KEY = "platafy_branding_settings";

export function sanitizeBranding(raw: any): BrandingSettings {
  if (!raw || typeof raw !== "object") return DEFAULT_BRANDING;
  const isLegacy = raw.app_name === "Social Hub" || raw.primary_color === "#ff451a";

  const fallbackColor = isLegacy
    ? DEFAULT_BRANDING.primary_color
    : (raw.primary_color || DEFAULT_BRANDING.primary_color);

  const colorLight = raw.primary_color_light
    ? raw.primary_color_light
    : (raw.primary_color && raw.primary_color !== "#ff451a" && raw.primary_color !== "#fca102"
        ? raw.primary_color
        : DEFAULT_BRANDING.primary_color_light);

  const colorDark = raw.primary_color_dark
    ? raw.primary_color_dark
    : (raw.primary_color && raw.primary_color !== "#ff451a"
        ? raw.primary_color
        : DEFAULT_BRANDING.primary_color_dark);

  return {
    app_name: isLegacy ? DEFAULT_BRANDING.app_name : (raw.app_name || DEFAULT_BRANDING.app_name),
    app_tagline: raw.app_tagline || DEFAULT_BRANDING.app_tagline,
    primary_color: fallbackColor,
    primary_color_light: colorLight || DEFAULT_BRANDING.primary_color_light,
    primary_color_dark: colorDark || DEFAULT_BRANDING.primary_color_dark,
    logo_url: (isLegacy || !raw.logo_url) ? DEFAULT_BRANDING.logo_url : raw.logo_url,
    favicon_url: (isLegacy || !raw.favicon_url) ? DEFAULT_BRANDING.favicon_url : raw.favicon_url,
    tutorial_video_url: raw.tutorial_video_url || DEFAULT_BRANDING.tutorial_video_url,
    login_headline: raw.login_headline !== undefined ? raw.login_headline : DEFAULT_BRANDING.login_headline,
    login_subheadline: raw.login_subheadline !== undefined ? raw.login_subheadline : DEFAULT_BRANDING.login_subheadline,
    login_stats_enabled: raw.login_stats_enabled !== undefined ? !!raw.login_stats_enabled : DEFAULT_BRANDING.login_stats_enabled,
    login_logo_position: raw.login_logo_position || DEFAULT_BRANDING.login_logo_position,
    login_bg_image_url: raw.login_bg_image_url !== undefined ? raw.login_bg_image_url : DEFAULT_BRANDING.login_bg_image_url,
    login_bg_layout: raw.login_bg_layout || DEFAULT_BRANDING.login_bg_layout,
    footer_text: raw.footer_text || DEFAULT_BRANDING.footer_text,
    og_image_url: raw.og_image_url !== undefined ? raw.og_image_url : DEFAULT_BRANDING.og_image_url,
    og_title: raw.og_title !== undefined ? raw.og_title : DEFAULT_BRANDING.og_title,
    og_description: raw.og_description !== undefined ? raw.og_description : DEFAULT_BRANDING.og_description,
  };
}

interface BrandingContextType {
  branding: BrandingSettings;
  loading: boolean;
  activePrimaryColor: string;
  updateBranding: (newSettings: Partial<BrandingSettings>) => Promise<boolean>;
  resetToDefault: () => Promise<boolean>;
  applyBrandColors: (lightColor?: string, darkColor?: string) => void;
}

const BrandingContext = createContext<BrandingContextType | undefined>(undefined);

export function applyBrandingToDOM(settings: BrandingSettings) {
  if (typeof document === "undefined") return;

  const lightColor = settings.primary_color_light || settings.primary_color || DEFAULT_BRANDING.primary_color_light;
  const darkColor = settings.primary_color_dark || settings.primary_color || DEFAULT_BRANDING.primary_color_dark;

  // 1. Limpar inline styles antigos no documentElement para não sobrepor as regras de tema
  document.documentElement.style.removeProperty("--primary");
  document.documentElement.style.removeProperty("--ring");
  document.documentElement.style.removeProperty("--accent");

  // 2. Injetar ou atualizar tag <style id="platafy-brand-theme-styles">
  let styleEl = document.getElementById("platafy-brand-theme-styles") as HTMLStyleElement | null;
  if (!styleEl) {
    styleEl = document.createElement("style");
    styleEl.id = "platafy-brand-theme-styles";
    document.head.appendChild(styleEl);
  }

  styleEl.textContent = `
    :root {
      --primary: ${lightColor} !important;
      --ring: ${lightColor} !important;
    }
    .dark {
      --primary: ${darkColor} !important;
      --ring: ${darkColor} !important;
    }
  `;

  // 3. Atualizar título da aba do navegador
  if (settings.app_name) {
    const tagline = settings.app_tagline ? ` ${settings.app_tagline}` : "";
    document.title = `${settings.app_name}${tagline} - Gestão Inteligente`;
  }

  // 4. Atualizar favicon
  if (settings.favicon_url) {
    let link = document.querySelector<HTMLLinkElement>("link[rel~='icon']");
    if (!link) {
      link = document.createElement("link");
      link.rel = "icon";
      document.getElementsByTagName("head")[0].appendChild(link);
    }
    link.href = settings.favicon_url;
  }

  // 5. Atualizar metatags Open Graph & Twitter dinamicamente no DOM
  const ogImg = settings.og_image_url || DEFAULT_BRANDING.og_image_url;
  const ogTit = settings.og_title || (settings.app_name ? `${settings.app_name} ${settings.app_tagline || ""}`.trim() : DEFAULT_BRANDING.og_title);
  const ogDesc = settings.og_description || DEFAULT_BRANDING.og_description;

  const updateOrCreateMeta = (selector: string, attr: "property" | "name", key: string, content: string) => {
    let meta = document.querySelector<HTMLMetaElement>(selector);
    if (!meta) {
      meta = document.createElement("meta");
      meta.setAttribute(attr, key);
      document.head.appendChild(meta);
    }
    meta.setAttribute("content", content);
  };

  if (ogImg) {
    updateOrCreateMeta("meta[property='og:image']", "property", "og:image", ogImg);
    updateOrCreateMeta("meta[property='og:image:secure_url']", "property", "og:image:secure_url", ogImg);
    updateOrCreateMeta("meta[name='twitter:image']", "name", "twitter:image", ogImg);
  }
  if (ogTit) {
    updateOrCreateMeta("meta[property='og:title']", "property", "og:title", ogTit);
    updateOrCreateMeta("meta[name='twitter:title']", "name", "twitter:title", ogTit);
  }
  if (ogDesc) {
    updateOrCreateMeta("meta[property='og:description']", "property", "og:description", ogDesc);
    updateOrCreateMeta("meta[name='twitter:description']", "name", "twitter:description", ogDesc);
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

  // Cor primária ativa conforme tema resolvido
  const [activePrimaryColor, setActivePrimaryColor] = useState<string>(() => {
    if (typeof document !== "undefined" && document.documentElement.classList.contains("dark")) {
      return branding.primary_color_dark || branding.primary_color || DEFAULT_BRANDING.primary_color_dark;
    }
    return branding.primary_color_light || branding.primary_color || DEFAULT_BRANDING.primary_color_light;
  });

  // Atualizar cor ativa quando o tema escuro/claro mudar em tempo real
  useEffect(() => {
    const updateActiveColor = () => {
      const isDark = document.documentElement.classList.contains("dark");
      setActivePrimaryColor(
        isDark
          ? (branding.primary_color_dark || branding.primary_color || DEFAULT_BRANDING.primary_color_dark)
          : (branding.primary_color_light || branding.primary_color || DEFAULT_BRANDING.primary_color_light)
      );
    };

    updateActiveColor();

    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === "attributes" && mutation.attributeName === "class") {
          updateActiveColor();
        }
      }
    });

    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });

    return () => observer.disconnect();
  }, [branding]);

  const applyBrandColors = useCallback((lightColor?: string, darkColor?: string) => {
    if (typeof document === "undefined") return;
    const lColor = lightColor || branding.primary_color_light || branding.primary_color || DEFAULT_BRANDING.primary_color_light;
    const dColor = darkColor || branding.primary_color_dark || branding.primary_color || DEFAULT_BRANDING.primary_color_dark;

    document.documentElement.style.removeProperty("--primary");
    document.documentElement.style.removeProperty("--ring");
    document.documentElement.style.removeProperty("--accent");

    let styleEl = document.getElementById("platafy-brand-theme-styles") as HTMLStyleElement | null;
    if (!styleEl) {
      styleEl = document.createElement("style");
      styleEl.id = "platafy-brand-theme-styles";
      document.head.appendChild(styleEl);
    }

    styleEl.textContent = `
      :root {
        --primary: ${lColor} !important;
        --ring: ${lColor} !important;
      }
      .dark {
        --primary: ${dColor} !important;
        --ring: ${dColor} !important;
      }
    `;

    const isDark = document.documentElement.classList.contains("dark");
    setActivePrimaryColor(isDark ? dColor : lColor);
  }, [branding]);

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
      primary_color: newSettings.primary_color_dark || newSettings.primary_color_light || newSettings.primary_color || branding.primary_color,
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

      // 2. Atualizar também o tenant do administrador se existir
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
        activePrimaryColor,
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
