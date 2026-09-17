import { useState, useRef, useEffect } from "react";
import { 
  useBranding, 
  DEFAULT_BRANDING, 
  DEFAULT_RECOVERY_EMAIL_HTML, 
  DEFAULT_RECOVERY_EMAIL_SUBJECT 
} from "@/contexts/BrandingContext";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { 
  Sparkles, Upload, RotateCcw, Check, Palette, Eye, EyeOff, AlertCircle, Image as ImageIcon,
  Sun, Moon, LogIn, Type, LayoutGrid, Save, Loader2, RefreshCw,
  Share2, MessageCircle, ExternalLink, CheckCheck, ShieldCheck, Mail,
  Code, Smartphone, Monitor, Copy
} from "lucide-react";

const PRESET_LIGHT_COLORS = [
  { name: "Azul Platafy", hex: "#4d5b9a" },
  { name: "Laranja Platafy", hex: "#fca102" },
  { name: "Azul Royal", hex: "#2563eb" },
  { name: "Roxo Tech", hex: "#7c3aed" },
  { name: "Verde Esmeralda", hex: "#059669" },
  { name: "Rosa Coral", hex: "#e11d48" },
  { name: "Índigo Profundo", hex: "#4338ca" },
  { name: "Grafite Minimal", hex: "#1e293b" },
];

const PRESET_DARK_COLORS = [
  { name: "Laranja Ouro", hex: "#fca102" },
  { name: "Índigo Neon", hex: "#6366f1" },
  { name: "Ciano Cyber", hex: "#06b6d4" },
  { name: "Verde Neon", hex: "#10b981" },
  { name: "Violeta Tech", hex: "#8b5cf6" },
  { name: "Rosa Flamingo", hex: "#f43f5e" },
  { name: "Azul Celeste", hex: "#38bdf8" },
  { name: "Âmbar Solar", hex: "#f59e0b" },
];

function SecureUrlField({
  value,
  onChange,
  placeholder = "Ou cole a URL direta de uma imagem externa",
  label,
  className,
}: {
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  label?: string;
  className?: string;
}) {
  const [showInput, setShowInput] = useState(false);
  const isSupabase = Boolean(value && value.includes(".supabase.co"));

  if (isSupabase && !showInput) {
    return (
      <div className={`space-y-1.5 ${className || ""}`}>
        {label && <Label className="text-xs">{label}</Label>}
        <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-xs shadow-xs">
          <div className="flex items-center gap-2 text-emerald-400 font-medium">
            <ShieldCheck className="h-4 w-4 text-emerald-400 shrink-0" />
            <span>Imagem protegida no Storage da Plataforma</span>
          </div>
          <button
            type="button"
            onClick={() => setShowInput(true)}
            className="text-[11px] text-muted-foreground hover:text-foreground underline ml-2 transition-colors cursor-pointer"
          >
            Editar link externo
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`space-y-1.5 ${className || ""}`}>
      {label && (
        <div className="flex items-center justify-between">
          <Label className="text-xs">{label}</Label>
          {isSupabase && (
            <button
              type="button"
              onClick={() => setShowInput(false)}
              className="text-[10px] text-emerald-400 hover:underline cursor-pointer"
            >
              Ocultar URL segura
            </button>
          )}
        </div>
      )}
      <div className="relative">
        <Input
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-8 text-xs font-mono pr-16"
        />
        {isSupabase && !label && (
          <button
            type="button"
            onClick={() => setShowInput(false)}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-emerald-400 hover:underline bg-card/90 px-1.5 py-0.5 rounded border border-emerald-500/20 cursor-pointer"
          >
            Ocultar
          </button>
        )}
      </div>
    </div>
  );
}

export function WhiteLabelSettings() {
  const { branding, updateBranding, resetToDefault, applyBrandColors } = useBranding();
  const { tenantId, isSuperAdmin, user } = useAuth();

  if (!isSuperAdmin) return null;

  // Aba ativa nas configurações de Identidade Visual
  const [activeTab, setActiveTab] = useState<string>("login");

  // Marca
  const [appName, setAppName] = useState(branding.app_name);
  const [appTagline, setAppTagline] = useState(branding.app_tagline);
  const [logoUrl, setLogoUrl] = useState(branding.logo_url);
  const [faviconUrl, setFaviconUrl] = useState(branding.favicon_url);
  const [tutorialVideoUrl, setTutorialVideoUrl] = useState(branding.tutorial_video_url || "/criar-conta.mp4");
  const [footerText, setFooterText] = useState(branding.footer_text || "© 2026 PLATAFY. Todos os direitos reservados.");

  // Cores Light e Dark
  const [primaryColorLight, setPrimaryColorLight] = useState(
    branding.primary_color_light || "#4d5b9a"
  );
  const [primaryColorDark, setPrimaryColorDark] = useState(
    branding.primary_color_dark || branding.primary_color || "#fca102"
  );

  // Login
  const [loginHeadline, setLoginHeadline] = useState(
    branding.login_headline || "Transforme Conversas em\nVendas com Agentes de IA"
  );
  const [loginSubheadline, setLoginSubheadline] = useState(
    branding.login_subheadline ||
      "A PLATAFY reúne Agentes de Inteligência Artificial, automação de atendimento, CRM, WhatsApp e múltiplos canais para acelerar o crescimento da sua empresa 24 horas por dia."
  );
  const [loginStatsEnabled, setLoginStatsEnabled] = useState(!!branding.login_stats_enabled);
  const [loginLogoPosition, setLoginLogoPosition] = useState<"left" | "right" | "top">(
    branding.login_logo_position || "right"
  );
  const [loginBgImageUrl, setLoginBgImageUrl] = useState(
    branding.login_bg_image_url || "/login-bg.webp"
  );
  const [loginBgLayout, setLoginBgLayout] = useState<"split-left" | "split-right" | "fullscreen">(
    branding.login_bg_layout || "split-left"
  );

  // Tipografia & Widgets
  const [fontFamily, setFontFamily] = useState("Inter");
  const [poweredByText, setPoweredByText] = useState("Powered by PLATAFY");
  const [hideWidgetBranding, setHideWidgetBranding] = useState(false);

  // SEO & Compartilhamento Social (WhatsApp / Open Graph)
  const [ogImageUrl, setOgImageUrl] = useState(
    branding.og_image_url || "https://sabzbazyxfxorrfshhgf.supabase.co/storage/v1/object/public/media/branding/og-default.jpg"
  );
  const [ogTitle, setOgTitle] = useState(
    branding.og_title || `${branding.app_name || "PLATAFY"} - Gestão Inteligente`
  );
  const [ogDescription, setOgDescription] = useState(
    branding.og_description || "Automatize comentários, DMs e publicações multicanais com Inteligência Artificial."
  );

  // Resend E-mails Transacionais & Templates
  const [resendApiKey, setResendApiKey] = useState(branding.resend_api_key || "");
  const [resendFromEmail, setResendFromEmail] = useState(
    branding.resend_from_email || "PLATAFY Social Hub <onboarding@resend.dev>"
  );
  const [emailRecoverySubject, setEmailRecoverySubject] = useState(
    branding.email_recovery_subject || DEFAULT_RECOVERY_EMAIL_SUBJECT
  );
  const [emailRecoveryHtml, setEmailRecoveryHtml] = useState(
    branding.email_recovery_html || DEFAULT_RECOVERY_EMAIL_HTML
  );
  const [emailEditorTab, setEmailEditorTab] = useState<"code" | "preview">("code");
  const [previewDevice, setPreviewDevice] = useState<"desktop" | "mobile">("desktop");
  const [testEmailType, setTestEmailType] = useState<"recovery_template" | "connection">("recovery_template");
  const [testingResend, setTestingResend] = useState(false);
  const [testEmailAddress, setTestEmailAddress] = useState("");
  const [showResendApiKey, setShowResendApiKey] = useState(false);

  // Estados de upload e salvamento
  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingFavicon, setUploadingFavicon] = useState(false);
  const [uploadingLoginBg, setUploadingLoginBg] = useState(false);
  const [uploadingOgImage, setUploadingOgImage] = useState(false);

  const [previewTheme, setPreviewTheme] = useState<"light" | "dark">(() => {
    if (typeof document !== "undefined" && document.documentElement.classList.contains("dark")) {
      return "dark";
    }
    return "light";
  });

  const logoFileInputRef = useRef<HTMLInputElement>(null);
  const faviconFileInputRef = useRef<HTMLInputElement>(null);
  const loginBgFileInputRef = useRef<HTMLInputElement>(null);
  const loginOgImageFileInputRef = useRef<HTMLInputElement>(null);
  const seoOgImageFileInputRef = useRef<HTMLInputElement>(null);

  // Sincronizar com branding global quando houver mudanças externas
  useEffect(() => {
    setAppName(branding.app_name);
    setAppTagline(branding.app_tagline);
    setPrimaryColorLight(branding.primary_color_light || "#4d5b9a");
    setPrimaryColorDark(branding.primary_color_dark || branding.primary_color || "#fca102");
    setLogoUrl(branding.logo_url);
    setFaviconUrl(branding.favicon_url);
    setTutorialVideoUrl(branding.tutorial_video_url || "/criar-conta.mp4");
    setFooterText(branding.footer_text || "© 2026 PLATAFY. Todos os direitos reservados.");

    setLoginHeadline(branding.login_headline || "Transforme Conversas em\nVendas com Agentes de IA");
    setLoginSubheadline(
      branding.login_subheadline ||
        "A PLATAFY reúne Agentes de Inteligência Artificial, automação de atendimento, CRM, WhatsApp e múltiplos canais para acelerar o crescimento da sua empresa 24 horas por dia."
    );
    setLoginStatsEnabled(!!branding.login_stats_enabled);
    setLoginLogoPosition(branding.login_logo_position || "right");
    setLoginBgImageUrl(branding.login_bg_image_url || "/login-bg.webp");
    setLoginBgLayout(branding.login_bg_layout || "split-left");
    setOgImageUrl(branding.og_image_url || "https://sabzbazyxfxorrfshhgf.supabase.co/storage/v1/object/public/media/branding/og-default.jpg");
    setOgTitle(branding.og_title || `${branding.app_name || "PLATAFY"} - Gestão Inteligente`);
    setOgDescription(branding.og_description || "Automatize comentários, DMs e publicações multicanais com Inteligência Artificial.");
    setResendApiKey(branding.resend_api_key || "");
    setResendFromEmail(branding.resend_from_email || "PLATAFY Social Hub <onboarding@resend.dev>");
    setEmailRecoverySubject(branding.email_recovery_subject || DEFAULT_RECOVERY_EMAIL_SUBJECT);
    setEmailRecoveryHtml(branding.email_recovery_html || DEFAULT_RECOVERY_EMAIL_HTML);
  }, [branding]);

  // Upload no Supabase Storage
  async function handleFileUpload(file: File, type: "logo" | "favicon" | "login_bg" | "og_image") {
    if (!file) return;

    if (file.size > 6 * 1024 * 1024) {
      toast.error("O arquivo deve ter no máximo 6MB.");
      return;
    }

    if (type === "logo") setUploadingLogo(true);
    else if (type === "favicon") setUploadingFavicon(true);
    else if (type === "login_bg") setUploadingLoginBg(true);
    else setUploadingOgImage(true);

    try {
      const ext = file.name.split(".").pop() || "png";
      const fileName = `branding/${type}-${tenantId || "default"}-${Date.now()}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("media")
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: publicUrlData } = supabase.storage
        .from("media")
        .getPublicUrl(fileName);

      const url = publicUrlData.publicUrl;
      if (type === "logo") {
        setLogoUrl(url);
        toast.success("Logotipo enviado com sucesso!");
      } else if (type === "favicon") {
        setFaviconUrl(url);
        toast.success("Favicon enviado com sucesso!");
      } else if (type === "login_bg") {
        setLoginBgImageUrl(url);
        toast.success("Imagem de fundo do login enviada com sucesso!");
      } else {
        setOgImageUrl(url);
        toast.success("Imagem em destaque (Open Graph/WhatsApp) enviada com sucesso!");
      }
    } catch (err: any) {
      console.error("Erro no upload:", err);
      toast.error(err.message || "Erro ao fazer upload da imagem.");
    } finally {
      if (type === "logo") setUploadingLogo(false);
      else if (type === "favicon") setUploadingFavicon(false);
      else if (type === "login_bg") setUploadingLoginBg(false);
      else setUploadingOgImage(false);
    }
  }

  function handleLightColorChange(newColor: string) {
    setPrimaryColorLight(newColor);
    applyBrandColors(newColor, primaryColorDark);
  }

  function handleDarkColorChange(newColor: string) {
    setPrimaryColorDark(newColor);
    applyBrandColors(primaryColorLight, newColor);
  }

  async function handleSave() {
    setSaving(true);
    await updateBranding({
      app_name: appName.trim() || DEFAULT_BRANDING.app_name,
      app_tagline: appTagline.trim(),
      primary_color: primaryColorDark || primaryColorLight,
      primary_color_light: primaryColorLight,
      primary_color_dark: primaryColorDark,
      logo_url: logoUrl.trim(),
      favicon_url: faviconUrl.trim(),
      tutorial_video_url: tutorialVideoUrl.trim() || "/criar-conta.mp4",
      footer_text: footerText.trim(),
      login_headline: loginHeadline,
      login_subheadline: loginSubheadline,
      login_stats_enabled: loginStatsEnabled,
      login_logo_position: loginLogoPosition,
      login_bg_image_url: loginBgImageUrl.trim(),
      login_bg_layout: loginBgLayout,
      og_image_url: ogImageUrl.trim(),
      og_title: ogTitle.trim(),
      og_description: ogDescription.trim(),
      resend_api_key: resendApiKey.trim(),
      resend_from_email: resendFromEmail.trim(),
      email_recovery_subject: emailRecoverySubject.trim(),
      email_recovery_html: emailRecoveryHtml,
    });
    setSaving(false);
  }

  async function handleReset() {
    if (!confirm("Deseja restaurar a identidade visual para as configurações padrão?")) return;
    setSaving(true);
    await resetToDefault();
    setAppName(DEFAULT_BRANDING.app_name);
    setAppTagline(DEFAULT_BRANDING.app_tagline);
    setPrimaryColorLight(DEFAULT_BRANDING.primary_color_light);
    setPrimaryColorDark(DEFAULT_BRANDING.primary_color_dark);
    setLogoUrl(DEFAULT_BRANDING.logo_url);
    setFaviconUrl(DEFAULT_BRANDING.favicon_url);
    setTutorialVideoUrl(DEFAULT_BRANDING.tutorial_video_url || "/criar-conta.mp4");
    setFooterText(DEFAULT_BRANDING.footer_text || "© 2026 PLATAFY. Todos os direitos reservados.");
    setLoginHeadline(DEFAULT_BRANDING.login_headline || "Transforme Conversas em\nVendas com Agentes de IA");
    setLoginSubheadline(DEFAULT_BRANDING.login_subheadline || "");
    setLoginStatsEnabled(!!DEFAULT_BRANDING.login_stats_enabled);
    setLoginLogoPosition(DEFAULT_BRANDING.login_logo_position || "right");
    setLoginBgImageUrl(DEFAULT_BRANDING.login_bg_image_url || "/login-bg.webp");
    setLoginBgLayout(DEFAULT_BRANDING.login_bg_layout || "split-left");
    setOgImageUrl(DEFAULT_BRANDING.og_image_url || "https://sabzbazyxfxorrfshhgf.supabase.co/storage/v1/object/public/media/branding/og-default.jpg");
    setOgTitle(DEFAULT_BRANDING.og_title || `${DEFAULT_BRANDING.app_name || "PLATAFY"} - Gestão Inteligente`);
    setOgDescription(DEFAULT_BRANDING.og_description || "Automatize comentários, DMs e publicações multicanais com Inteligência Artificial.");
    setResendApiKey("");
    setResendFromEmail("PLATAFY Social Hub <onboarding@resend.dev>");
    setEmailRecoverySubject(DEFAULT_RECOVERY_EMAIL_SUBJECT);
    setEmailRecoveryHtml(DEFAULT_RECOVERY_EMAIL_HTML);
    applyBrandColors(DEFAULT_BRANDING.primary_color_light, DEFAULT_BRANDING.primary_color_dark);
    setSaving(false);
  }

  async function handleTestResend() {
    const targetEmail = (testEmailAddress.trim() || user?.email || "").toLowerCase();
    if (!targetEmail) {
      toast.error("Informe um endereço de e-mail para receber o teste.");
      return;
    }
    if (!resendApiKey.trim()) {
      toast.error("Informe a Chave de API do Resend antes de disparar o teste.");
      return;
    }

    setTestingResend(true);
    try {
      const { data, error } = await supabase.functions.invoke("recuperacao-senha", {
        body: {
          action: "test-resend",
          email: targetEmail,
          resend_api_key: resendApiKey.trim(),
          resend_from_email: resendFromEmail.trim(),
          test_type: testEmailType,
          subject: emailRecoverySubject.trim(),
          template_html: emailRecoveryHtml,
        },
      });

      if (error || data?.error) {
        throw new Error(data?.error || error?.message || "Falha ao enviar e-mail de teste pelo Resend");
      }

      toast.success(`E-mail de teste (${testEmailType === "recovery_template" ? "Template Personalizado" : "Teste Simples"}) enviado para ${targetEmail}! Verifique sua caixa de entrada.`);
    } catch (err: any) {
      toast.error(err.message || "Erro ao conectar com a API do Resend.");
    } finally {
      setTestingResend(false);
    }
  }

  function getRenderedPreviewHtml() {
    const fallbackUrl = "https://platafy.com/#/redefinir-senha?token=exemplo-token-demonstrativo";
    const curYear = new Date().getFullYear().toString();
    const cleanAppName = appName.trim() || "PLATAFY Social Hub";
    const cleanLogo = logoUrl.trim();

    let html = emailRecoveryHtml || DEFAULT_RECOVERY_EMAIL_HTML;
    html = html.replace(/\{\{\s*\.ConfirmationURL\s*\}\}/g, fallbackUrl);
    html = html.replace(/\{\{\s*app_name\s*\}\}/g, cleanAppName);
    html = html.replace(/\{\{\s*logo_url\s*\}\}/g, cleanLogo);
    html = html.replace(/\{\{\s*email\s*\}\}/g, testEmailAddress.trim() || user?.email || "cliente@empresa.com");
    html = html.replace(/\{\{\s*ano\s*\}\}/g, curYear);
    return html;
  }

  function handleCopySupabaseTemplate() {
    navigator.clipboard.writeText(emailRecoveryHtml);
    toast.success("Template HTML copiado com sucesso!", {
      description: "Agora cole no Supabase Dashboard: Authentication -> Email Templates -> Reset Password.",
      duration: 6000,
    });
  }

  function handleRestoreDefaultTemplate() {
    if (confirm("Deseja restaurar o template oficial de e-mail em português?")) {
      setEmailRecoverySubject(DEFAULT_RECOVERY_EMAIL_SUBJECT);
      setEmailRecoveryHtml(DEFAULT_RECOVERY_EMAIL_HTML);
      toast.success("Template restaurado para a versão padrão!");
    }
  }

  function handleInsertVariable(variableStr: string) {
    navigator.clipboard.writeText(variableStr);
    toast.info(`Variável copiada: ${variableStr}`, {
      description: "Cole onde desejar dentro do código HTML.",
    });
  }

  const currentPreviewColor = previewTheme === "dark" ? primaryColorDark : primaryColorLight;

  return (
    <div className="space-y-6">
      {/* Header Superior idêntico à Imagem de Referência */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/80 pb-5">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            Identidade Visual
          </h1>
          <p className="text-sm text-muted-foreground">
            Personalize toda a aparência da plataforma
          </p>
        </div>
        <Button
          onClick={handleSave}
          disabled={saving || uploadingLogo || uploadingFavicon || uploadingLoginBg}
          className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold px-5 py-2.5 rounded-xl flex items-center gap-2 shadow-sm transition-all"
        >
          {saving ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin text-slate-950" />
              Salvando...
            </>
          ) : (
            <>
              <Save className="h-4 w-4 text-slate-950" />
              Salvar Configurações
            </>
          )}
        </Button>
      </div>

      {/* Tabs Container */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        {/* Barra de Abas */}
        <TabsList className="w-full bg-slate-900/80 border border-slate-800 p-1.5 rounded-xl flex gap-1 overflow-x-auto">
          <TabsTrigger value="marca" className="flex items-center gap-2">
            <Sparkles className="h-4 w-4" />
            Marca
          </TabsTrigger>
          <TabsTrigger value="cores" className="flex items-center gap-2">
            <Palette className="h-4 w-4" />
            Cores
          </TabsTrigger>
          <TabsTrigger value="tipografia" className="flex items-center gap-2">
            <Type className="h-4 w-4" />
            Tipografia
          </TabsTrigger>
          <TabsTrigger value="login" className="flex items-center gap-2">
            <LogIn className="h-4 w-4" />
            Login
          </TabsTrigger>
          <TabsTrigger value="widgets" className="flex items-center gap-2">
            <LayoutGrid className="h-4 w-4" />
            Widgets
          </TabsTrigger>
          <TabsTrigger value="seo" className="flex items-center gap-2">
            <Share2 className="h-4 w-4" />
            SEO & Redes
          </TabsTrigger>
          <TabsTrigger value="resend" className="flex items-center gap-2">
            <Mail className="h-4 w-4" />
            E-mails & Resend
          </TabsTrigger>
        </TabsList>

        {/* ========================================================= */}
        {/* ABA: LOGIN (Foco do usuário / Imagem 2)                   */}
        {/* ========================================================= */}
        <TabsContent value="login" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Coluna Esquerda: Conteúdo */}
            <Card className="border border-border/70 bg-card shadow-sm">
              <CardHeader className="pb-4">
                <CardTitle className="text-lg font-bold">Conteúdo</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="loginHeadline">Título Principal</Label>
                  <Input
                    id="loginHeadline"
                    value={loginHeadline}
                    onChange={(e) => setLoginHeadline(e.target.value)}
                    placeholder="Transforme Conversas em Vendas com Agentes de IA"
                    className="h-10"
                  />
                  <p className="text-xs text-muted-foreground">Use \n para quebra de linha</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="loginSubheadline">Subtítulo</Label>
                  <Textarea
                    id="loginSubheadline"
                    value={loginSubheadline}
                    onChange={(e) => setLoginSubheadline(e.target.value)}
                    rows={4}
                    placeholder="Texto descritivo exibido abaixo do título..."
                    className="leading-relaxed"
                  />
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-border/50">
                  <div className="space-y-0.5">
                    <Label className="text-sm font-medium">Mostrar Estatísticas</Label>
                    <p className="text-xs text-muted-foreground">Cards de métricas no login</p>
                  </div>
                  <Switch
                    checked={loginStatsEnabled}
                    onCheckedChange={setLoginStatsEnabled}
                  />
                </div>

                <div className="space-y-2 pt-2 border-t border-border/50">
                  <Label htmlFor="loginLogoPosition">Posição do Bloco do Logo</Label>
                  <select
                    id="loginLogoPosition"
                    value={loginLogoPosition}
                    onChange={(e) => setLoginLogoPosition(e.target.value as any)}
                    className="w-full h-10 px-3 rounded-lg bg-background border border-input text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    <option value="left">Esquerda</option>
                    <option value="right">Direita</option>
                    <option value="top">Topo</option>
                  </select>
                </div>
              </CardContent>
            </Card>

            {/* Coluna Direita: Imagem de Fundo */}
            <Card className="border border-border/70 bg-card shadow-sm">
              <CardHeader className="pb-4">
                <CardTitle className="text-lg font-bold">Imagem de Fundo</CardTitle>
                <CardDescription className="text-xs">
                  Substitui o gradiente da lateral do login por uma imagem.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="space-y-2">
                  <Label>Imagem de Fundo do Login</Label>
                  <div className="p-3 border border-border/80 rounded-xl bg-muted/20 space-y-3">
                    {/* Visual Preview */}
                    <div className="relative w-full h-36 rounded-lg overflow-hidden border border-border/60 bg-black/40 flex items-center justify-center group">
                      {loginBgImageUrl ? (
                        <img
                          src={loginBgImageUrl}
                          alt="Login background preview"
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            (e.currentTarget as HTMLImageElement).src = "/login-bg.webp";
                          }}
                        />
                      ) : (
                        <div className="flex flex-col items-center text-muted-foreground text-xs">
                          <ImageIcon className="h-8 w-8 mb-1 opacity-50" />
                          <span>Nenhuma imagem configurada (usa gradiente)</span>
                        </div>
                      )}
                    </div>

                    {/* Controles de Upload e Ações */}
                    <input
                      type="file"
                      ref={loginBgFileInputRef}
                      accept="image/png,image/jpeg,image/webp,image/jpg"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleFileUpload(file, "login_bg");
                      }}
                    />

                    <div className="flex flex-wrap gap-2 pt-1">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => loginBgFileInputRef.current?.click()}
                        disabled={uploadingLoginBg}
                        className="text-xs gap-1.5"
                      >
                        <Upload className="h-3.5 w-3.5" />
                        {uploadingLoginBg ? "Enviando..." : "Upload Nova Imagem"}
                      </Button>

                      {loginBgImageUrl !== "/login-bg.webp" && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setLoginBgImageUrl("/login-bg.webp")}
                          className="text-xs gap-1.5"
                        >
                          <RefreshCw className="h-3.5 w-3.5 text-amber-500" />
                          Usar Imagem Oficial Platafy
                        </Button>
                      )}

                      {loginBgImageUrl && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => setLoginBgImageUrl("")}
                          className="text-xs text-muted-foreground hover:text-destructive"
                        >
                          Remover
                        </Button>
                      )}
                    </div>

                    <SecureUrlField
                      placeholder="Ou cole a URL direta de uma imagem externa"
                      value={loginBgImageUrl}
                      onChange={setLoginBgImageUrl}
                    />

                    <p className="text-[11px] text-muted-foreground">
                      Recomendado: 1920x1080px, JPG. Deixe vazio para usar o gradiente.
                    </p>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="loginBgLayout">Posicionamento da Imagem</Label>
                  <select
                    id="loginBgLayout"
                    value={loginBgLayout}
                    onChange={(e) => setLoginBgLayout(e.target.value as any)}
                    className="w-full h-10 px-3 rounded-lg bg-background border border-input text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    <option value="split-left">Lado esquerdo (formulário à direita)</option>
                    <option value="split-right">Lado direito (formulário à esquerda)</option>
                    <option value="fullscreen">Tela inteira (atrás do formulário)</option>
                  </select>
                  <p className="text-xs text-muted-foreground">
                    Define onde a imagem aparece na tela de login.
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Card Adicional na Aba Login: Imagem de Destaque no Compartilhamento Social */}
          <Card className="border border-border/70 bg-card shadow-sm mt-6">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg font-bold flex items-center gap-2">
                    <Share2 className="w-5 h-5 text-amber-500" />
                    Imagem de Destaque (Redes Sociais)
                  </CardTitle>
                  <CardDescription className="text-xs mt-1">
                    Exibida em destaque quando qualquer link de <strong>Login</strong> (<code>#/login</code>) ou <strong>Cadastro</strong> (<code>#/cadastro</code>) for enviado no WhatsApp, Facebook, LinkedIn ou Twitter/X.
                  </CardDescription>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setActiveTab("seo")}
                  className="text-xs gap-1 border-amber-500/30 text-amber-500 hover:bg-amber-500/10"
                >
                  Ver Simulador WhatsApp
                  <ExternalLink className="w-3.5 h-3.5" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
                {/* Visual Preview */}
                <div className="relative w-full h-44 rounded-xl overflow-hidden border border-border/80 bg-slate-950 flex items-center justify-center group shadow-inner">
                  {ogImageUrl ? (
                    <img
                      src={ogImageUrl}
                      alt="Open Graph preview"
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        (e.currentTarget as HTMLImageElement).src = "https://sabzbazyxfxorrfshhgf.supabase.co/storage/v1/object/public/media/branding/og-default.jpg";
                      }}
                    />
                  ) : (
                    <div className="flex flex-col items-center text-muted-foreground text-xs p-4 text-center">
                      <ImageIcon className="h-8 w-8 mb-2 opacity-50" />
                      <span>Nenhuma imagem de destaque configurada</span>
                    </div>
                  )}
                  <div className="absolute top-2 right-2 px-2 py-0.5 rounded-md bg-black/70 backdrop-blur-sm text-[10px] font-mono text-amber-400 border border-amber-500/30">
                    Proporção 16:9 (1200x630)
                  </div>
                </div>

                {/* Controles de Ação e Upload */}
                <div className="md:col-span-2 space-y-3">
                  {/* Input de Arquivo Oculto para a Aba Login */}
                  <input
                    type="file"
                    ref={loginOgImageFileInputRef}
                    accept="image/png,image/jpeg,image/webp,image/jpg"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        handleFileUpload(file, "og_image");
                        e.target.value = "";
                      }
                    }}
                  />

                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => loginOgImageFileInputRef.current?.click()}
                      disabled={uploadingOgImage}
                      className="text-xs gap-1.5 bg-primary/5 hover:bg-primary/10 border-primary/30"
                    >
                      <Upload className="h-3.5 w-3.5 text-primary" />
                      {uploadingOgImage ? "Enviando..." : "Upload Imagem Destaque"}
                    </Button>

                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setOgImageUrl("https://sabzbazyxfxorrfshhgf.supabase.co/storage/v1/object/public/media/branding/og-default.jpg")}
                      className="text-xs gap-1.5"
                    >
                      <RefreshCw className="h-3.5 w-3.5 text-amber-500" />
                      Usar Imagem Oficial Platafy
                    </Button>

                    {ogImageUrl && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setOgImageUrl("")}
                        className="text-xs text-muted-foreground hover:text-destructive"
                      >
                        Remover
                      </Button>
                    )}
                  </div>

                  <SecureUrlField
                    label="URL da imagem (Open Graph / WhatsApp):"
                    placeholder="Ou cole a URL direta de uma imagem externa (https://...)"
                    value={ogImageUrl}
                    onChange={setOgImageUrl}
                  />

                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    💡 <strong>Dica de alta conversão:</strong> Recomendamos imagens de <strong>1200x630 pixels</strong> (proporção 1.91:1) em formato JPG ou PNG de até 1MB para renderização perfeita no WhatsApp Desktop, iOS e Android.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ========================================================= */}
        {/* ABA: MARCA                                                */}
        {/* ========================================================= */}
        <TabsContent value="marca" className="space-y-6">
          <Card className="border border-border/70 bg-card shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg font-bold">Identidade da Marca</CardTitle>
              <CardDescription>
                Customize o nome, logotipo e favicon exibidos em toda a aplicação.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="appName" className="text-sm font-semibold">
                    Nome da Plataforma / Marca
                  </Label>
                  <Input
                    id="appName"
                    placeholder="Ex: Platafy Social"
                    value={appName}
                    onChange={(e) => setAppName(e.target.value)}
                    className="h-10"
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Substitui o nome exibido no cabeçalho e na aba do navegador.
                  </p>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="appTagline" className="text-sm font-semibold">
                    Badge / Tagline (Opcional)
                  </Label>
                  <Input
                    id="appTagline"
                    placeholder="Ex: Hub, Pro, Desk"
                    value={appTagline}
                    onChange={(e) => setAppTagline(e.target.value)}
                    className="h-10"
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Pequena tag estilizada ao lado do nome principal.
                  </p>
                </div>
              </div>

              {/* Logotipo e Favicon */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-4 border-t border-border/50">
                <div className="space-y-2">
                  <Label className="text-sm font-semibold">Logotipo Principal</Label>
                  <div className="p-3 border border-border/80 rounded-xl bg-muted/20 flex items-center gap-4">
                    <div className="h-14 w-14 rounded-lg bg-background border flex items-center justify-center overflow-hidden shrink-0">
                      <img
                        src={logoUrl || "/logo.png"}
                        alt="Logo"
                        className="max-h-full max-w-full object-contain p-1"
                      />
                    </div>
                    <div className="space-y-1.5 flex-1">
                      <input
                        type="file"
                        ref={logoFileInputRef}
                        accept="image/png,image/jpeg,image/svg+xml,image/webp"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleFileUpload(file, "logo");
                        }}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => logoFileInputRef.current?.click()}
                        disabled={uploadingLogo}
                        className="text-xs gap-1.5"
                      >
                        <Upload className="h-3.5 w-3.5" />
                        {uploadingLogo ? "Enviando..." : "Upload Logo"}
                      </Button>
                      <SecureUrlField
                        placeholder="Ou URL direta do logo"
                        value={logoUrl}
                        onChange={setLogoUrl}
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-semibold">Favicon</Label>
                  <div className="p-3 border border-border/80 rounded-xl bg-muted/20 flex items-center gap-4">
                    <div className="h-14 w-14 rounded-lg bg-background border flex items-center justify-center overflow-hidden shrink-0">
                      <img
                        src={faviconUrl || "/favicon.ico"}
                        alt="Favicon"
                        className="max-h-full max-w-full object-contain p-1"
                      />
                    </div>
                    <div className="space-y-1.5 flex-1">
                      <input
                        type="file"
                        ref={faviconFileInputRef}
                        accept="image/png,image/x-icon,image/svg+xml,image/jpeg,image/webp"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleFileUpload(file, "favicon");
                        }}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => faviconFileInputRef.current?.click()}
                        disabled={uploadingFavicon}
                        className="text-xs gap-1.5"
                      >
                        <Upload className="h-3.5 w-3.5" />
                        {uploadingFavicon ? "Enviando..." : "Upload Favicon"}
                      </Button>
                      <SecureUrlField
                        placeholder="Ou URL direta do favicon"
                        value={faviconUrl}
                        onChange={setFaviconUrl}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Rodapé e Vídeo Tutorial */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-border/50">
                <div className="space-y-1.5">
                  <Label htmlFor="footerText" className="text-sm font-semibold">
                    Texto do Rodapé
                  </Label>
                  <Input
                    id="footerText"
                    value={footerText}
                    onChange={(e) => setFooterText(e.target.value)}
                    placeholder="© 2026 PLATAFY. Todos os direitos reservados."
                    className="h-10"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="tutorialVideoUrl" className="text-sm font-semibold">
                    Vídeo Tutorial (Guia de Uso)
                  </Label>
                  <Input
                    id="tutorialVideoUrl"
                    value={tutorialVideoUrl}
                    onChange={(e) => setTutorialVideoUrl(e.target.value)}
                    placeholder="/criar-conta.mp4 ou URL do YouTube"
                    className="h-10 text-xs font-mono"
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ========================================================= */}
        {/* ABA: CORES                                                */}
        {/* ========================================================= */}
        <TabsContent value="cores" className="space-y-6">
          <Card className="border border-border/70 bg-card shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg font-bold">Cores da Interface</CardTitle>
              <CardDescription>
                Configure paletas primárias independentes para o Modo Claro e para o Modo Escuro.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                {/* Paleta Light */}
                <div className="p-4 rounded-2xl border border-border/80 bg-muted/20 space-y-3.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 rounded-lg bg-amber-500/10 text-amber-500">
                        <Sun className="h-4 w-4" />
                      </div>
                      <div>
                        <Label className="text-xs font-bold uppercase tracking-wider text-foreground">
                          Cor Primária (Modo Claro)
                        </Label>
                        <p className="text-[11px] text-muted-foreground">
                          Ativa quando o tema Claro estiver em uso.
                        </p>
                      </div>
                    </div>
                    <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-background border border-border/60">
                      {primaryColorLight}
                    </span>
                  </div>

                  <div className="space-y-1.5">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                      Cores Recomendadas para Fundo Claro
                    </span>
                    <div className="flex flex-wrap gap-2 items-center">
                      {PRESET_LIGHT_COLORS.map((col) => {
                        const isSelected = primaryColorLight.toLowerCase() === col.hex.toLowerCase();
                        return (
                          <button
                            key={col.hex}
                            type="button"
                            onClick={() => handleLightColorChange(col.hex)}
                            className={`group relative h-8 w-8 rounded-full transition-all flex items-center justify-center border-2 ${
                              isSelected
                                ? "border-foreground scale-110 shadow-md ring-2 ring-primary/30"
                                : "border-transparent hover:scale-105"
                            }`}
                            style={{ backgroundColor: col.hex }}
                            title={`${col.name} (${col.hex})`}
                          >
                            {isSelected && <Check className="h-3.5 w-3.5 text-white drop-shadow-sm" />}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-border/50 gap-2">
                    <input
                      type="color"
                      value={primaryColorLight}
                      onChange={(e) => handleLightColorChange(e.target.value)}
                      className="h-8 w-14 rounded cursor-pointer border border-border bg-transparent"
                    />
                    <Input
                      value={primaryColorLight}
                      onChange={(e) => handleLightColorChange(e.target.value)}
                      placeholder="#4d5b9a"
                      className="h-8 font-mono text-xs max-w-[120px]"
                    />
                  </div>
                </div>

                {/* Paleta Dark */}
                <div className="p-4 rounded-2xl border border-border/80 bg-muted/20 space-y-3.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-400">
                        <Moon className="h-4 w-4" />
                      </div>
                      <div>
                        <Label className="text-xs font-bold uppercase tracking-wider text-foreground">
                          Cor Primária (Modo Escuro)
                        </Label>
                        <p className="text-[11px] text-muted-foreground">
                          Ativa quando o tema Escuro estiver em uso.
                        </p>
                      </div>
                    </div>
                    <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-background border border-border/60">
                      {primaryColorDark}
                    </span>
                  </div>

                  <div className="space-y-1.5">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                      Cores Recomendadas para Fundo Escuro
                    </span>
                    <div className="flex flex-wrap gap-2 items-center">
                      {PRESET_DARK_COLORS.map((col) => {
                        const isSelected = primaryColorDark.toLowerCase() === col.hex.toLowerCase();
                        return (
                          <button
                            key={col.hex}
                            type="button"
                            onClick={() => handleDarkColorChange(col.hex)}
                            className={`group relative h-8 w-8 rounded-full transition-all flex items-center justify-center border-2 ${
                              isSelected
                                ? "border-foreground scale-110 shadow-md ring-2 ring-primary/30"
                                : "border-transparent hover:scale-105"
                            }`}
                            style={{ backgroundColor: col.hex }}
                            title={`${col.name} (${col.hex})`}
                          >
                            {isSelected && <Check className="h-3.5 w-3.5 text-white drop-shadow-sm" />}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-border/50 gap-2">
                    <input
                      type="color"
                      value={primaryColorDark}
                      onChange={(e) => handleDarkColorChange(e.target.value)}
                      className="h-8 w-14 rounded cursor-pointer border border-border bg-transparent"
                    />
                    <Input
                      value={primaryColorDark}
                      onChange={(e) => handleDarkColorChange(e.target.value)}
                      placeholder="#fca102"
                      className="h-8 font-mono text-xs max-w-[120px]"
                    />
                  </div>
                </div>
              </div>

              {/* Preview em Tempo Real */}
              <div className="space-y-3 pt-2 border-t border-border/50">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                    <Eye className="h-3.5 w-3.5" />
                    Pré-visualização
                  </Label>
                  <div className="inline-flex rounded-xl bg-muted p-1 border border-border">
                    <button
                      type="button"
                      onClick={() => setPreviewTheme("light")}
                      className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold ${
                        previewTheme === "light" ? "bg-card text-foreground shadow-xs" : "text-muted-foreground"
                      }`}
                    >
                      <Sun className="h-3 w-3 text-amber-500" /> Claro
                    </button>
                    <button
                      type="button"
                      onClick={() => setPreviewTheme("dark")}
                      className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold ${
                        previewTheme === "dark" ? "bg-card text-foreground shadow-xs" : "text-muted-foreground"
                      }`}
                    >
                      <Moon className="h-3 w-3 text-indigo-400" /> Escuro
                    </button>
                  </div>
                </div>

                <div
                  className={`rounded-2xl border p-5 shadow-sm space-y-4 ${
                    previewTheme === "dark"
                      ? "bg-slate-950 border-slate-800 text-slate-100"
                      : "bg-white border-stone-200 text-stone-900"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <img src={logoUrl || "/logo.png"} alt="Logo" className="h-8 w-8 object-contain rounded" />
                      <span className="text-lg font-black tracking-tight">{appName || "PLATAFY Social"}</span>
                    </div>
                    <button
                      type="button"
                      className="px-4 py-2 text-xs font-bold rounded-xl text-white shadow-sm"
                      style={{ backgroundColor: currentPreviewColor }}
                    >
                      Botão Demonstrativo
                    </button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ========================================================= */}
        {/* ABA: TIPOGRAFIA                                           */}
        {/* ========================================================= */}
        <TabsContent value="tipografia" className="space-y-6">
          <Card className="border border-border/70 bg-card shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg font-bold">Tipografia & Fontes</CardTitle>
              <CardDescription>
                Ajuste a família de fontes primária exibida em toda a plataforma.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="space-y-2 max-w-md">
                <Label htmlFor="fontFamily">Fonte Principal</Label>
                <select
                  id="fontFamily"
                  value={fontFamily}
                  onChange={(e) => setFontFamily(e.target.value)}
                  className="w-full h-10 px-3 rounded-lg bg-background border border-input text-sm text-foreground"
                >
                  <option value="Inter">Inter (Padrão Moderno)</option>
                  <option value="Lato">Lato (Harmoniosa)</option>
                  <option value="Roboto">Roboto (Clássica)</option>
                  <option value="Outfit">Outfit (Tecnologia & Inovação)</option>
                  <option value="Poppins">Poppins (Geométrica)</option>
                </select>
              </div>

              <div
                className="p-5 rounded-xl border border-border/80 bg-muted/20 space-y-3"
                style={{ fontFamily: `${fontFamily}, system-ui, sans-serif` }}
              >
                <h2 className="text-2xl font-bold">Demonstração de Tipografia ({fontFamily})</h2>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  O PLATAFY Social Hub reúne inteligência artificial, automações multicanais e gestão unificada de redes sociais para acelerar a sua produtividade e escala.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ========================================================= */}
        {/* ABA: WIDGETS                                              */}
        {/* ========================================================= */}
        <TabsContent value="widgets" className="space-y-6">
          <Card className="border border-border/70 bg-card shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg font-bold">Widgets & Elementos Públicos</CardTitle>
              <CardDescription>
                Controle a exibição de marca em embeds e componentes compartilhados.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="space-y-2 max-w-md">
                <Label htmlFor="poweredBy">Texto "Powered by"</Label>
                <Input
                  id="poweredBy"
                  value={poweredByText}
                  onChange={(e) => setPoweredByText(e.target.value)}
                  placeholder="Powered by PLATAFY"
                />
              </div>

              <div className="flex items-center justify-between p-4 border border-border/60 rounded-xl bg-muted/10 max-w-lg">
                <div>
                  <Label>Ocultar marca em widgets</Label>
                  <p className="text-xs text-muted-foreground">Remove rodapé dos componentes públicos</p>
                </div>
                <Switch
                  checked={hideWidgetBranding}
                  onCheckedChange={setHideWidgetBranding}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ========================================================= */}
        {/* ABA: SEO & COMPARTILHAMENTO SOCIAL (WHATSAPP / OPEN GRAPH)*/}
        {/* ========================================================= */}
        <TabsContent value="seo" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Coluna Esquerda: Edição de Metadados e Imagem */}
            <Card className="border border-border/70 bg-card shadow-sm">
              <CardHeader>
                <CardTitle className="text-lg font-bold flex items-center gap-2">
                  <Share2 className="w-5 h-5 text-amber-500" />
                  Meta Tags & Compartilhamento Social
                </CardTitle>
                <CardDescription className="text-xs">
                  Configure o título, descrição e imagem em destaque exibidos quando os links da plataforma (como <code>/#/login</code> e <code>/#/cadastro</code>) forem compartilhados no WhatsApp e redes sociais.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="ogTitle">Título de Compartilhamento (og:title)</Label>
                  <Input
                    id="ogTitle"
                    value={ogTitle}
                    onChange={(e) => setOgTitle(e.target.value)}
                    placeholder="PLATAFY Social Hub - Gestão Inteligente de Redes Sociais"
                    className="h-10 text-sm"
                  />
                  <p className="text-[11px] text-muted-foreground">Exibido em negrito no card de preview do WhatsApp.</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="ogDescription">Descrição de Compartilhamento (og:description)</Label>
                  <Textarea
                    id="ogDescription"
                    value={ogDescription}
                    onChange={(e) => setOgDescription(e.target.value)}
                    rows={3}
                    placeholder="Automatize comentários, DMs e publicações multicanais com Inteligência Artificial..."
                    className="text-sm leading-relaxed"
                  />
                  <p className="text-[11px] text-muted-foreground">Subtítulo explicativo que acompanha o card social.</p>
                </div>

                {/* Imagem em Destaque */}
                <div className="space-y-3 pt-3 border-t border-border/50">
                  <Label className="text-sm font-semibold flex items-center justify-between">
                    <span>Imagem em Destaque (WhatsApp / Open Graph)</span>
                    <span className="text-[11px] font-mono text-amber-400">1200x630 (16:9)</span>
                  </Label>

                  {/* Visual Preview */}
                  <div className="relative w-full h-40 rounded-xl overflow-hidden border border-border/80 bg-slate-950 flex items-center justify-center group">
                    {ogImageUrl ? (
                      <img
                        src={ogImageUrl}
                        alt="Open Graph Preview"
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          (e.currentTarget as HTMLImageElement).src = "https://sabzbazyxfxorrfshhgf.supabase.co/storage/v1/object/public/media/branding/og-default.jpg";
                        }}
                      />
                    ) : (
                      <div className="flex flex-col items-center text-muted-foreground text-xs p-4 text-center">
                        <ImageIcon className="h-8 w-8 mb-2 opacity-50" />
                        <span>Nenhuma imagem em destaque configurada</span>
                      </div>
                    )}
                  </div>

                  {/* Input de Arquivo Oculto */}
                  <input
                    type="file"
                    ref={seoOgImageFileInputRef}
                    accept="image/png,image/jpeg,image/webp,image/jpg"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        handleFileUpload(file, "og_image");
                        e.target.value = "";
                      }
                    }}
                  />

                  {/* Botões de Ação */}
                  <div className="flex flex-wrap gap-2 pt-1">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => seoOgImageFileInputRef.current?.click()}
                      disabled={uploadingOgImage}
                      className="text-xs gap-1.5 bg-primary/5 hover:bg-primary/10 border-primary/30"
                    >
                      <Upload className="h-3.5 w-3.5 text-primary" />
                      {uploadingOgImage ? "Enviando..." : "Upload Imagem Destaque"}
                    </Button>

                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setOgImageUrl("https://sabzbazyxfxorrfshhgf.supabase.co/storage/v1/object/public/media/branding/og-default.jpg")}
                      className="text-xs gap-1.5"
                    >
                      <RefreshCw className="h-3.5 w-3.5 text-amber-500" />
                      Usar Imagem Oficial Platafy
                    </Button>

                    {ogImageUrl && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setOgImageUrl("")}
                        className="text-xs text-muted-foreground hover:text-destructive"
                      >
                        Remover
                      </Button>
                    )}
                  </div>

                  <SecureUrlField
                    placeholder="Ou cole a URL direta da imagem (ex: https://...)"
                    value={ogImageUrl}
                    onChange={setOgImageUrl}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Coluna Direita: Simulador Realista de Compartilhamento no WhatsApp */}
            <div className="space-y-4">
              <Card className="border border-border/70 bg-card shadow-sm">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base font-bold flex items-center gap-2">
                      <MessageCircle className="w-5 h-5 text-emerald-500" />
                      Simulador em Tempo Real: WhatsApp
                    </CardTitle>
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                      Visualização Fiel
                    </span>
                  </div>
                  <CardDescription className="text-xs">
                    Veja exatamente como seu cliente visualizará o card ao receber o link no WhatsApp.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {/* Container estilo tela do WhatsApp */}
                  <div className="p-4 rounded-2xl bg-[#0b141a] border border-emerald-950/40 relative overflow-hidden shadow-2xl">
                    {/* Background pattern sutil do WhatsApp */}
                    <div className="absolute inset-0 opacity-5 pointer-events-none bg-[radial-gradient(#25d366_1px,transparent_1px)] [background-size:16px_16px]" />

                    {/* Balão de mensagem enviada (verde escuro do WhatsApp) */}
                    <div className="relative max-w-[340px] sm:max-w-[380px] ml-auto rounded-2xl rounded-tr-none bg-[#005c4b] text-white p-2 text-xs shadow-lg space-y-2 border border-emerald-700/30">
                      {/* Card de Preview de Link */}
                      <div className="rounded-xl overflow-hidden bg-[#025142] border border-emerald-600/30">
                        {/* Imagem do Preview */}
                        <div className="relative w-full h-44 bg-black/50 overflow-hidden flex items-center justify-center">
                          {ogImageUrl ? (
                            <img
                              src={ogImageUrl}
                              alt="WhatsApp Preview"
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                (e.currentTarget as HTMLImageElement).src = "https://sabzbazyxfxorrfshhgf.supabase.co/storage/v1/object/public/media/branding/og-default.jpg";
                              }}
                            />
                          ) : (
                            <div className="flex flex-col items-center justify-center text-emerald-200/50 p-4">
                              <ImageIcon className="w-8 h-8 mb-1" />
                              <span className="text-[10px]">Sem imagem de destaque</span>
                            </div>
                          )}
                        </div>

                        {/* Textos do Card de Preview */}
                        <div className="p-2.5 space-y-1 bg-[#025142]">
                          <span className="text-[10px] uppercase font-bold tracking-wider text-emerald-200/80 block">
                            socialhub.platafy.com
                          </span>
                          <h4 className="font-bold text-sm text-white line-clamp-1 leading-snug">
                            {ogTitle || "PLATAFY Social Hub - Gestão Inteligente"}
                          </h4>
                          <p className="text-[11px] text-emerald-100/70 line-clamp-2 leading-relaxed">
                            {ogDescription || "Automatize comentários, DMs e publicações multicanais com Inteligência Artificial."}
                          </p>
                        </div>
                      </div>

                      {/* Texto que acompanha a mensagem no WhatsApp */}
                      <div className="px-1 pt-1 text-[12px] text-emerald-50 leading-relaxed">
                        Por favor faça o cadastro no <strong>{appName || "PLATAFY SOCIAL HUB"}</strong> no link abaixo: 👇👇
                        <br />
                        <span className="text-cyan-300 underline font-mono text-[11px] break-all">
                          https://socialhub.platafy.com/#/cadastro
                        </span>
                      </div>

                      {/* Hora e checks azuis do WhatsApp */}
                      <div className="flex items-center justify-end gap-1 text-[10px] text-emerald-200/70 pt-0.5 pr-1">
                        <span>14:48</span>
                        <CheckCheck className="w-3.5 h-3.5 text-cyan-400 inline" />
                      </div>
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-muted/20 border border-border/60 text-xs text-muted-foreground flex items-center gap-2.5">
                    <Check className="w-4 h-4 text-emerald-500 shrink-0" />
                    <span>
                      Compatível também com <strong>Facebook Messenger</strong>, <strong>Instagram Direct</strong>, <strong>Telegram</strong> e <strong>Twitter/X</strong>.
                    </span>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        {/* ========================================================= */}
        {/* ABA: E-MAILS & RESEND (Recuperação de Senha & Transacional)*/}
        {/* ========================================================= */}
        <TabsContent value="resend" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Coluna Esquerda: Credenciais Resend */}
            <div className="space-y-6">
              <Card className="border border-border/70 bg-card shadow-sm">
                <CardHeader className="pb-4">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg font-bold flex items-center gap-2">
                      <Mail className="h-5 w-5 text-amber-500" />
                      Configuração Resend API
                    </CardTitle>
                    <span className="text-[11px] bg-amber-500/10 text-amber-500 border border-amber-500/20 px-2 py-0.5 rounded-full font-semibold">
                      100 e-mails/dia grátis
                    </span>
                  </div>
                  <CardDescription className="text-xs">
                    Conecte sua conta do <a href="https://resend.com" target="_blank" rel="noopener noreferrer" className="underline text-amber-500 font-semibold hover:text-amber-400">Resend.com</a> para enviar e-mails de recuperação de senha com alta taxa de entrega e 0 risco de spam.
                  </CardDescription>
                </CardHeader>

                <CardContent className="space-y-4">
                  {/* Chave de API */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="resendApiKey" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        Chave de API do Resend (API Key)
                      </Label>
                      <a
                        href="https://resend.com/api-keys"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[11px] text-amber-500 hover:underline inline-flex items-center gap-1"
                      >
                        Gerar Chave no Resend <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                    <div className="relative">
                      <Input
                        id="resendApiKey"
                        type={showResendApiKey ? "text" : "password"}
                        value={resendApiKey}
                        onChange={(e) => setResendApiKey(e.target.value)}
                        placeholder="re_12345678_xxxxxxxxxxxxxxxx"
                        className="h-10 pr-10 font-mono text-xs bg-background"
                      />
                      <button
                        type="button"
                        onClick={() => setShowResendApiKey(!showResendApiKey)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        tabIndex={-1}
                      >
                        {showResendApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      Começa geralmente com <code className="font-mono text-amber-400">re_</code>. Você pode gerar gratuitamente no painel do Resend.
                    </p>
                  </div>

                  {/* E-mail Remetente */}
                  <div className="space-y-2">
                    <Label htmlFor="resendFromEmail" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Remetente Oficial (From Email)
                    </Label>
                    <Input
                      id="resendFromEmail"
                      value={resendFromEmail}
                      onChange={(e) => setResendFromEmail(e.target.value)}
                      placeholder="PLATAFY Social Hub <suporte@seudominio.com>"
                      className="h-10 text-xs bg-background"
                    />
                    <p className="text-[11px] text-muted-foreground">
                      No modo de testes sem domínio próprio use: <code className="font-mono text-amber-400">PLATAFY Social Hub &lt;onboarding@resend.dev&gt;</code>. Para produção, adicione seu domínio próprio no Resend (até 3 domínios inclusos no plano grátis).
                    </p>
                  </div>

                  {/* Status Informativo */}
                  <div className={`p-3 rounded-xl border text-xs flex items-center gap-2.5 ${
                    resendApiKey.trim()
                      ? "bg-emerald-500/10 border-emerald-500/25 text-emerald-600 dark:text-emerald-400"
                      : "bg-amber-500/10 border-amber-500/25 text-amber-600 dark:text-amber-400"
                  }`}>
                    {resendApiKey.trim() ? (
                      <>
                        <Check className="w-4 h-4 text-emerald-500 shrink-0" />
                        <span>Chave informada. Salve as alterações para ativar no sistema.</span>
                      </>
                    ) : (
                      <>
                        <AlertCircle className="w-4 h-4 text-amber-500 shrink-0" />
                        <span>Chave pendente. O sistema usará o serviço nativo do Supabase até que a chave seja configurada.</span>
                      </>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Card de Teste Interativo */}
              <Card className="border border-border/70 bg-card shadow-sm">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-bold flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-amber-500" />
                    Testar Disparo via Resend
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Envie um e-mail de teste em tempo real para validar sua chave e pré-visualizar a entrega na sua caixa de entrada.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3.5">
                  {/* Tipo de teste */}
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-muted-foreground">Tipo de Envio do Teste</Label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setTestEmailType("recovery_template")}
                        className={`p-2 rounded-lg border text-xs text-left transition-all ${
                          testEmailType === "recovery_template"
                            ? "border-amber-500 bg-amber-500/10 font-semibold text-amber-400"
                            : "border-border/60 bg-background/50 text-muted-foreground hover:border-border"
                        }`}
                      >
                        <div className="font-medium text-foreground text-xs">Template HTML</div>
                        <div className="text-[10px] text-muted-foreground">E-mail completo em português</div>
                      </button>
                      <button
                        type="button"
                        onClick={() => setTestEmailType("connection")}
                        className={`p-2 rounded-lg border text-xs text-left transition-all ${
                          testEmailType === "connection"
                            ? "border-amber-500 bg-amber-500/10 font-semibold text-amber-400"
                            : "border-border/60 bg-background/50 text-muted-foreground hover:border-border"
                        }`}
                      >
                        <div className="font-medium text-foreground text-xs">Conexão Básica</div>
                        <div className="text-[10px] text-muted-foreground">Apenas teste de API</div>
                      </button>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="testEmailAddress" className="text-xs">Destinatário do Teste</Label>
                    <div className="flex gap-2">
                      <Input
                        id="testEmailAddress"
                        type="email"
                        value={testEmailAddress}
                        onChange={(e) => setTestEmailAddress(e.target.value)}
                        placeholder={user?.email || "seu-email@dominio.com"}
                        className="h-10 text-xs bg-background"
                      />
                      <Button
                        type="button"
                        onClick={handleTestResend}
                        disabled={testingResend || !resendApiKey.trim()}
                        className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold shrink-0 text-xs px-4"
                      >
                        {testingResend ? (
                          <>
                            <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                            Enviando...
                          </>
                        ) : (
                          <>
                            <Mail className="h-3.5 w-3.5 mr-1.5" />
                            Disparar Teste
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Coluna Direita: Guia & Instruções Supabase SMTP */}
            <div className="space-y-6">
              {/* Benefícios Resend */}
              <Card className="border border-border/70 bg-card shadow-sm">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-bold flex items-center gap-2">
                    <ShieldCheck className="h-4 w-4 text-emerald-500" />
                    Vantagens do Resend.com
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2.5 text-xs text-muted-foreground">
                  <div className="flex items-start gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-amber-500 mt-1.5 shrink-0" />
                    <span><strong>100 e-mails por dia gratuitos:</strong> Mais que suficiente para recuperação de senha e e-mails operacionais.</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-amber-500 mt-1.5 shrink-0" />
                    <span><strong>Até 3 domínios verificados:</strong> Permite enviar de remetentes corporativos (@platafy.com).</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-amber-500 mt-1.5 shrink-0" />
                    <span><strong>Template HTML Oficial:</strong> Layout moderno escuro com logo PLATAFY SOCIAL HUB, botão CTA em degradê e avisos de segurança.</span>
                  </div>
                </CardContent>
              </Card>

              {/* Guia SMTP Supabase Dashboard */}
              <Card className="border border-border/70 bg-card shadow-sm">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-bold flex items-center gap-2">
                    <LayoutGrid className="h-4 w-4 text-primary" />
                    Configurar também no Supabase (Custom SMTP)
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Se desejar que todos os e-mails nativos do Supabase também passem pelo Resend:
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-2.5 text-xs text-muted-foreground font-mono">
                  <div className="bg-slate-950/80 p-3 rounded-xl border border-slate-800 space-y-1.5">
                    <p className="text-amber-400 font-bold font-sans">1. Acesse o Supabase Dashboard:</p>
                    <p className="text-[11px] font-sans">Project Settings &rarr; Authentication &rarr; SMTP Settings &rarr; Ative &ldquo;Enable Custom SMTP&rdquo;</p>
                    <div className="pt-2 text-[11px] space-y-1">
                      <div><span className="text-slate-400">Sender Email:</span> <span className="text-white">seu-email@dominio.com</span></div>
                      <div><span className="text-slate-400">Sender Name:</span> <span className="text-white">PLATAFY Social Hub</span></div>
                      <div><span className="text-slate-400">Host:</span> <span className="text-amber-400">smtp.resend.com</span></div>
                      <div><span className="text-slate-400">Port:</span> <span className="text-amber-400">465 (SSL) ou 587 (TLS)</span></div>
                      <div><span className="text-slate-400">User:</span> <span className="text-white">resend</span></div>
                      <div><span className="text-slate-400">Password:</span> <span className="text-amber-400">&lt;Sua API Key do Resend&gt;</span></div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Card Principal: Editor de Template HTML */}
          <Card className="border border-border/70 bg-card shadow-sm overflow-hidden">
            <CardHeader className="pb-4 border-b border-border/60">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <Mail className="h-5 w-5 text-amber-500" />
                    <CardTitle className="text-lg font-bold">
                      Editor de Template de E-mail (Recuperação de Senha)
                    </CardTitle>
                    <span className="text-[11px] bg-amber-500/10 text-amber-500 border border-amber-500/20 px-2 py-0.5 rounded-full font-semibold">
                      HTML &amp; Tradução
                    </span>
                  </div>
                  <CardDescription className="text-xs mt-1">
                    Personalize o assunto e o layout HTML do e-mail em português enviado quando o usuário solicita a redefinição de senha.
                  </CardDescription>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleRestoreDefaultTemplate}
                    className="text-xs gap-1.5"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    Restaurar Padrão
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    onClick={handleCopySupabaseTemplate}
                    className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs gap-1.5 shadow-sm"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    Copiar HTML para Supabase
                  </Button>
                </div>
              </div>
            </CardHeader>

            <CardContent className="p-6 space-y-6">
              {/* Linha do Assunto (Subject) */}
              <div className="space-y-2">
                <Label htmlFor="emailRecoverySubject" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Assunto do E-mail (Subject)
                </Label>
                <Input
                  id="emailRecoverySubject"
                  value={emailRecoverySubject}
                  onChange={(e) => setEmailRecoverySubject(e.target.value)}
                  placeholder="Redefinição de Senha - {{app_name}}"
                  className="h-10 text-sm bg-background font-medium"
                />
                <p className="text-[11px] text-muted-foreground">
                  Você pode usar a tag <code className="font-mono text-amber-400">{"{{app_name}}"}</code> no assunto para inserir o nome da sua marca automaticamente.
                </p>
              </div>

              {/* Tags / Variáveis Dinâmicas */}
              <div className="space-y-2 p-3.5 rounded-xl bg-muted/40 border border-border/60">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Variáveis Dinâmicas Disponíveis (clique em uma tag para copiar)
                  </Label>
                  <span className="text-[10px] text-muted-foreground">Compatível com Supabase &amp; Resend</span>
                </div>
                <div className="flex flex-wrap gap-2 pt-1">
                  {[
                    { tag: "{{ .ConfirmationURL }}", desc: "Link de redefinição de senha" },
                    { tag: "{{app_name}}", desc: "Nome da plataforma White Label" },
                    { tag: "{{logo_url}}", desc: "URL do logotipo" },
                    { tag: "{{email}}", desc: "E-mail do usuário destinatário" },
                    { tag: "{{ano}}", desc: "Ano vigente (ex: 2026)" },
                  ].map((item) => (
                    <button
                      key={item.tag}
                      type="button"
                      onClick={() => handleInsertVariable(item.tag)}
                      title={`Copiar ${item.tag} - ${item.desc}`}
                      className="group flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-background border border-border/80 text-xs font-mono text-foreground hover:border-amber-500 hover:text-amber-400 hover:bg-amber-500/5 transition-all cursor-pointer"
                    >
                      <Copy className="w-3 h-3 text-muted-foreground group-hover:text-amber-400" />
                      <span>{item.tag}</span>
                      <span className="text-[10px] text-muted-foreground group-hover:text-amber-400/80 hidden sm:inline">({item.desc})</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Barra de Ferramentas de Visualização (Código vs Preview ao Vivo) */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/60 pb-3">
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant={emailEditorTab === "code" ? "default" : "outline"}
                    onClick={() => setEmailEditorTab("code")}
                    className={`text-xs gap-1.5 ${
                      emailEditorTab === "code" ? "bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold" : ""
                    }`}
                  >
                    <Code className="w-3.5 h-3.5" />
                    Código HTML
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={emailEditorTab === "preview" ? "default" : "outline"}
                    onClick={() => setEmailEditorTab("preview")}
                    className={`text-xs gap-1.5 ${
                      emailEditorTab === "preview" ? "bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold" : ""
                    }`}
                  >
                    <Eye className="w-3.5 h-3.5" />
                    Pré-visualização ao Vivo
                  </Button>
                </div>

                {emailEditorTab === "preview" && (
                  <div className="flex items-center gap-1 bg-muted/60 p-1 rounded-lg border border-border/60">
                    <Button
                      type="button"
                      size="sm"
                      variant={previewDevice === "desktop" ? "secondary" : "ghost"}
                      onClick={() => setPreviewDevice("desktop")}
                      className="text-xs h-7 px-2.5 gap-1"
                    >
                      <Monitor className="w-3 h-3" />
                      Desktop
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant={previewDevice === "mobile" ? "secondary" : "ghost"}
                      onClick={() => setPreviewDevice("mobile")}
                      className="text-xs h-7 px-2.5 gap-1"
                    >
                      <Smartphone className="w-3 h-3" />
                      Mobile (375px)
                    </Button>
                  </div>
                )}
              </div>

              {/* Área do Editor / Preview */}
              {emailEditorTab === "code" ? (
                <div className="space-y-2">
                  <div className="relative rounded-xl border border-slate-800 bg-[#070b14] overflow-hidden focus-within:border-amber-500/80 focus-within:ring-1 focus-within:ring-amber-500/50 transition-all">
                    <div className="flex items-center justify-between px-4 py-2 bg-slate-900/80 border-b border-slate-800 text-[11px] text-slate-400 font-mono">
                      <span>HTML Document • UTF-8</span>
                      <span>{emailRecoveryHtml.length} caracteres</span>
                    </div>
                    <textarea
                      value={emailRecoveryHtml}
                      onChange={(e) => setEmailRecoveryHtml(e.target.value)}
                      rows={22}
                      spellCheck={false}
                      placeholder="Cole ou edite seu template HTML aqui..."
                      className="w-full font-mono text-xs leading-relaxed bg-[#070b14] text-slate-200 p-4 border-0 outline-none resize-y selection:bg-amber-500/30 selection:text-white"
                    />
                  </div>
                  <p className="text-[11px] text-muted-foreground flex items-center gap-1.5">
                    <CheckCheck className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                    Template formatado em tabelas responsivas inline, otimizado para Gmail, Outlook, Apple Mail e modo escuro nativo.
                  </p>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center p-6 bg-slate-950/60 rounded-xl border border-border/60 min-h-[600px] overflow-hidden">
                  <div
                    className={`w-full transition-all duration-300 ${
                      previewDevice === "desktop"
                        ? "max-w-[650px] shadow-2xl rounded-2xl overflow-hidden border border-slate-800"
                        : "max-w-[380px] shadow-2xl rounded-[36px] border-[8px] border-slate-800 p-1.5 bg-slate-900"
                    }`}
                  >
                    {previewDevice === "mobile" && (
                      <div className="w-20 h-4 bg-slate-800 rounded-full mx-auto my-1" />
                    )}
                    <iframe
                      srcDoc={getRenderedPreviewHtml()}
                      className="w-full h-[580px] bg-[#070b14] border-0 rounded-xl"
                      sandbox="allow-same-origin"
                      title="Pré-visualização do E-mail"
                    />
                  </div>
                </div>
              )}

              {/* Caixa de Orientação: Sincronização no Supabase Auth */}
              <div className="p-4 rounded-xl border border-amber-500/30 bg-amber-500/5 space-y-2.5">
                <div className="flex items-center gap-2 text-amber-500 font-bold text-xs uppercase tracking-wider">
                  <ExternalLink className="w-4 h-4" />
                  Como sincronizar este e-mail em português no Supabase Auth
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Por padrão, o Supabase envia o e-mail de recuperação em inglês (&ldquo;Reset your password&rdquo;). Para que seus usuários recebam este template traduzido e formatado:
                </p>
                <ol className="text-xs text-muted-foreground space-y-1.5 list-decimal list-inside font-medium">
                  <li>
                    Clique em <strong className="text-foreground">&ldquo;Copiar HTML para Supabase&rdquo;</strong> no botão acima.
                  </li>
                  <li>
                    Acesse o <a href="https://supabase.com/dashboard" target="_blank" rel="noopener noreferrer" className="text-amber-500 hover:underline inline-flex items-center gap-0.5">Supabase Dashboard <ExternalLink className="w-3 h-3 inline" /></a> &rarr; <strong>Authentication</strong> &rarr; <strong>Email Templates</strong> &rarr; <strong>&ldquo;Reset Password&rdquo;</strong>.
                  </li>
                  <li>
                    No campo <strong>Subject</strong>, insira: <code className="font-mono text-amber-400 bg-background/80 px-1 py-0.5 rounded">Redefinição de Senha - {"{{ .Data.app_name }}"}</code> (ou apenas &ldquo;Redefinição de Senha&rdquo;).
                  </li>
                  <li>
                    No campo <strong>Message (HTML)</strong>, selecione todo o texto em inglês, apague e <strong>cole o código HTML</strong> copiado.
                  </li>
                  <li>
                    Clique em <strong>Save Changes</strong> no Supabase!
                  </li>
                </ol>
                <p className="text-[11px] text-amber-400/90 pt-1">
                  ✓ Pronto! Todos os disparos de recuperação de senha passarão a chegar aos usuários 100% em português com a sua identidade visual.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Footer com botão de restauração e salvar */}
      <div className="flex items-center justify-between pt-4 border-t border-border/40">
        <Button
          variant="outline"
          size="sm"
          onClick={handleReset}
          disabled={saving}
          className="gap-1.5 text-xs text-muted-foreground hover:text-foreground"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          Restaurar Padrão
        </Button>

        <Button
          onClick={handleSave}
          disabled={saving || uploadingLogo || uploadingFavicon || uploadingLoginBg}
          className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold px-6 py-2.5 rounded-xl flex items-center gap-2 shadow-sm"
        >
          {saving ? "Salvando..." : "Salvar Configurações"}
        </Button>
      </div>
    </div>
  );
}
