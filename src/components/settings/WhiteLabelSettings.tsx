import { useState, useRef, useEffect } from "react";
import { useBranding, DEFAULT_BRANDING } from "@/contexts/BrandingContext";
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
  Sparkles, Upload, RotateCcw, Check, Palette, Eye, Image as ImageIcon,
  Sun, Moon, LogIn, Type, LayoutGrid, Save, Loader2, RefreshCw,
  Share2, MessageCircle, ExternalLink, CheckCheck
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

export function WhiteLabelSettings() {
  const { branding, updateBranding, resetToDefault, applyBrandColors } = useBranding();
  const { tenantId, isSuperAdmin } = useAuth();

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
  const ogImageFileInputRef = useRef<HTMLInputElement>(null);

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
    applyBrandColors(DEFAULT_BRANDING.primary_color_light, DEFAULT_BRANDING.primary_color_dark);
    setSaving(false);
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

                    <Input
                      placeholder="Ou cole a URL direta da imagem"
                      value={loginBgImageUrl}
                      onChange={(e) => setLoginBgImageUrl(e.target.value)}
                      className="h-8 text-xs font-mono"
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
                    Imagem de Destaque ao Compartilhar Links de Login e Cadastro (WhatsApp / Redes)
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
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => ogImageFileInputRef.current?.click()}
                      disabled={uploadingOgImage}
                      className="text-xs gap-1.5 bg-primary/5 hover:bg-primary/10 border-primary/30"
                    >
                      <Upload className="h-3.5 w-3.5 text-primary" />
                      {uploadingOgImage ? "Enviando imagem..." : "Upload Nova Imagem em Destaque"}
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

                  <div className="space-y-1">
                    <Label className="text-xs">URL direta da imagem (Open Graph / WhatsApp):</Label>
                    <Input
                      placeholder="https://..."
                      value={ogImageUrl}
                      onChange={(e) => setOgImageUrl(e.target.value)}
                      className="h-8 text-xs font-mono"
                    />
                  </div>

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
                      <Input
                        placeholder="Ou URL direta do logo"
                        value={logoUrl}
                        onChange={(e) => setLogoUrl(e.target.value)}
                        className="h-8 text-xs"
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
                      <Input
                        placeholder="Ou URL direta do favicon"
                        value={faviconUrl}
                        onChange={(e) => setFaviconUrl(e.target.value)}
                        className="h-8 text-xs"
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
                    ref={ogImageFileInputRef}
                    accept="image/png,image/jpeg,image/webp,image/jpg"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleFileUpload(file, "og_image");
                    }}
                  />

                  {/* Botões de Ação */}
                  <div className="flex flex-wrap gap-2 pt-1">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => ogImageFileInputRef.current?.click()}
                      disabled={uploadingOgImage}
                      className="text-xs gap-1.5 bg-primary/5 hover:bg-primary/10 border-primary/30"
                    >
                      <Upload className="h-3.5 w-3.5 text-primary" />
                      {uploadingOgImage ? "Enviando..." : "Upload Nova Imagem"}
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

                  <Input
                    placeholder="Ou cole a URL direta da imagem (ex: https://...)"
                    value={ogImageUrl}
                    onChange={(e) => setOgImageUrl(e.target.value)}
                    className="h-8 text-xs font-mono"
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
