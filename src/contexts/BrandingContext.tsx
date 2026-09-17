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
  // Resend E-mails Transacionais
  resend_api_key?: string;
  resend_from_email?: string;
  email_recovery_subject?: string;
  email_recovery_html?: string;
}

export const DEFAULT_RECOVERY_EMAIL_SUBJECT = "Redefinição de Senha - {{app_name}}";

export const DEFAULT_RECOVERY_EMAIL_HTML = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Recuperação de Senha</title>
</head>
<body style="margin: 0; padding: 0; background-color: #070b14; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased;">
  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #070b14; padding: 40px 15px;">
    <tr>
      <td align="center">
        <!-- Container Principal -->
        <table width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 540px; background-color: #0f172a; border: 1px solid #1e293b; border-radius: 20px; overflow: hidden; box-shadow: 0 20px 40px rgba(0,0,0,0.6);">
          
          <!-- Top Accent Line -->
          <tr>
            <td height="4" style="background: linear-gradient(90deg, #f59e0b, #ea580c);"></td>
          </tr>

          <!-- Header / Logo -->
          <tr>
            <td style="padding: 36px 36px 20px 36px; text-align: center;">
              <div style="display: inline-block; padding: 6px 18px; background-color: rgba(245, 158, 11, 0.12); border: 1px solid rgba(245, 158, 11, 0.25); border-radius: 999px; margin-bottom: 16px;">
                <span style="color: #f59e0b; font-size: 14px; font-weight: 800; letter-spacing: 0.5px;">{{app_name}}</span>
              </div>
              <h1 style="margin: 0 0 8px 0; color: #ffffff; font-size: 24px; font-weight: 800; letter-spacing: -0.5px;">
                Recuperação de Senha
              </h1>
              <p style="margin: 0; color: #94a3b8; font-size: 14px;">
                Instruções para redefinir o acesso à sua conta
              </p>
            </td>
          </tr>

          <!-- Conteúdo Principal -->
          <tr>
            <td style="padding: 10px 36px 30px 36px;">
              <p style="color: #e2e8f0; font-size: 15px; line-height: 1.6; margin: 0 0 16px 0;">
                Olá,
              </p>
              <p style="color: #cbd5e1; font-size: 14px; line-height: 1.6; margin: 0 0 24px 0;">
                Recebemos uma solicitação para redefinir a senha da sua conta no <strong>{{app_name}}</strong>. Para cadastrar uma nova senha e restabelecer seu acesso, clique no botão abaixo:
              </p>

              <!-- Botão CTA -->
              <table width="100%" border="0" cellspacing="0" cellpadding="0" style="margin: 28px 0;">
                <tr>
                  <td align="center">
                    <a href="{{ .ConfirmationURL }}" target="_blank" rel="noopener noreferrer" style="display: inline-block; background: linear-gradient(135deg, #f59e0b, #ea580c); color: #090d16; font-weight: 800; font-size: 15px; text-decoration: none; padding: 14px 32px; border-radius: 12px; box-shadow: 0 4px 15px rgba(245, 158, 11, 0.35); text-align: center;">
                      Redefinir Minha Senha &rarr;
                    </a>
                  </td>
                </tr>
              </table>

              <!-- Aviso de Segurança -->
              <div style="background-color: rgba(30, 41, 59, 0.7); border: 1px solid #334155; border-radius: 12px; padding: 16px; margin: 24px 0;">
                <p style="margin: 0; color: #94a3b8; font-size: 12px; line-height: 1.5;">
                  🔒 <strong>Dica de Segurança:</strong> Este link é de uso único e expira em breve. Se você não solicitou a redefinição de senha, nenhuma ação é necessária e sua conta permanece segura.
                </p>
              </div>

              <!-- Link alternativo se o botão falhar -->
              <p style="color: #64748b; font-size: 11px; line-height: 1.5; margin: 20px 0 0 0; word-break: break-all;">
                Se o botão acima não funcionar, copie e cole o link a seguir no seu navegador:<br>
                <a href="{{ .ConfirmationURL }}" style="color: #f59e0b; text-decoration: underline;">{{ .ConfirmationURL }}</a>
              </p>
            </td>
          </tr>

          <!-- Rodapé -->
          <tr>
            <td style="padding: 24px 36px; background-color: #090d16; border-top: 1px solid #1e293b; text-align: center;">
              <p style="margin: 0 0 6px 0; color: #64748b; font-size: 12px;">
                © {{ano}} {{app_name}} • Todos os direitos reservados.
              </p>
              <p style="margin: 0; color: #475569; font-size: 11px;">
                Este é um e-mail transacional automático. Por favor, não responda diretamente a esta mensagem.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

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
  email_recovery_subject: DEFAULT_RECOVERY_EMAIL_SUBJECT,
  email_recovery_html: DEFAULT_RECOVERY_EMAIL_HTML,
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
    resend_api_key: raw.resend_api_key !== undefined ? raw.resend_api_key : DEFAULT_BRANDING.resend_api_key,
    resend_from_email: raw.resend_from_email !== undefined ? raw.resend_from_email : DEFAULT_BRANDING.resend_from_email,
    email_recovery_subject: raw.email_recovery_subject !== undefined ? raw.email_recovery_subject : DEFAULT_BRANDING.email_recovery_subject,
    email_recovery_html: raw.email_recovery_html !== undefined ? raw.email_recovery_html : DEFAULT_BRANDING.email_recovery_html,
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
