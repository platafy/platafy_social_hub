import { useState, useRef, useEffect } from "react";
import { useBranding, DEFAULT_BRANDING } from "@/contexts/BrandingContext";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { 
  Sparkles, Upload, RotateCcw, Check, Palette, Eye, Image as ImageIcon,
  Video, Sun, Moon, Globe
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

  const [appName, setAppName] = useState(branding.app_name);
  const [appTagline, setAppTagline] = useState(branding.app_tagline);
  
  // Duas cores primárias independentes: Modo Light e Modo Dark
  const [primaryColorLight, setPrimaryColorLight] = useState(
    branding.primary_color_light || "#4d5b9a"
  );
  const [primaryColorDark, setPrimaryColorDark] = useState(
    branding.primary_color_dark || branding.primary_color || "#fca102"
  );

  const [logoUrl, setLogoUrl] = useState(branding.logo_url);
  const [faviconUrl, setFaviconUrl] = useState(branding.favicon_url);
  const [tutorialVideoUrl, setTutorialVideoUrl] = useState(branding.tutorial_video_url || "/criar-conta.mp4");

  const [previewTheme, setPreviewTheme] = useState<"light" | "dark">(() => {
    if (typeof document !== "undefined" && document.documentElement.classList.contains("dark")) {
      return "dark";
    }
    return "light";
  });

  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingFavicon, setUploadingFavicon] = useState(false);

  const logoFileInputRef = useRef<HTMLInputElement>(null);
  const faviconFileInputRef = useRef<HTMLInputElement>(null);

  // Sincronizar estados locais se o branding global for atualizado remotamente
  useEffect(() => {
    setAppName(branding.app_name);
    setAppTagline(branding.app_tagline);
    setPrimaryColorLight(branding.primary_color_light || "#4d5b9a");
    setPrimaryColorDark(branding.primary_color_dark || branding.primary_color || "#fca102");
    setLogoUrl(branding.logo_url);
    setFaviconUrl(branding.favicon_url);
    setTutorialVideoUrl(branding.tutorial_video_url || "/criar-conta.mp4");
  }, [branding]);

  // Manipular upload de arquivos de imagem no Supabase Storage
  async function handleFileUpload(file: File, type: "logo" | "favicon") {
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      toast.error("O arquivo deve ter no máximo 2MB.");
      return;
    }

    const isLogo = type === "logo";
    if (isLogo) setUploadingLogo(true);
    else setUploadingFavicon(true);

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
      if (isLogo) {
        setLogoUrl(url);
        toast.success("Logotipo enviado com sucesso!");
      } else {
        setFaviconUrl(url);
        toast.success("Favicon enviado com sucesso!");
      }
    } catch (err: any) {
      console.error("Erro no upload:", err);
      toast.error(err.message || "Erro ao fazer upload da imagem.");
    } finally {
      if (isLogo) setUploadingLogo(false);
      else setUploadingFavicon(false);
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
    applyBrandColors(DEFAULT_BRANDING.primary_color_light, DEFAULT_BRANDING.primary_color_dark);
    setSaving(false);
  }

  const currentPreviewColor = previewTheme === "dark" ? primaryColorDark : primaryColorLight;

  return (
    <div className="space-y-6">
      <Card className="border border-border/70 shadow-sm bg-card">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                <CardTitle className="text-xl">Personalização White Label</CardTitle>
              </div>
              <CardDescription>
                Customize a marca, o logotipo, o favicon e as cores da plataforma para os seus clientes.
              </CardDescription>
            </div>
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
          </div>
        </CardHeader>

        <CardContent className="space-y-7">
          {/* 1. Nome da Marca e Tagline */}
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

          {/* 2. Cores da Marca: Modo Light e Modo Dark */}
          <div className="space-y-4 pt-2 border-t border-border/50">
            <div>
              <div className="flex items-center gap-2">
                <Palette className="h-5 w-5 text-primary" />
                <h3 className="text-sm font-bold text-foreground">
                  Cores Primárias da Interface (Paletas Light & Dark)
                </h3>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Configure duas paletas independentes: uma cor primária sob medida para o <strong>Modo Claro</strong> e outra para o <strong>Modo Escuro</strong>.
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              {/* Paleta Modo Claro (Light) */}
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

                {/* Swatches Light */}
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
                          {isSelected && (
                            <Check className="h-3.5 w-3.5 text-white drop-shadow-sm" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Seletor Customizado Nativo */}
                <div className="flex items-center justify-between pt-2 border-t border-border/50 gap-2">
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={primaryColorLight}
                      onChange={(e) => handleLightColorChange(e.target.value)}
                      className="h-8 w-8 rounded-lg cursor-pointer border border-border bg-transparent p-0.5"
                      title="Escolha qualquer cor personalizada para Modo Claro"
                    />
                    <Input
                      value={primaryColorLight}
                      onChange={(e) => handleLightColorChange(e.target.value)}
                      placeholder="#000000"
                      className="w-24 h-8 font-mono text-xs uppercase"
                      maxLength={7}
                    />
                  </div>

                  {/* Mini Preview Card Claro */}
                  <div className="px-2.5 py-1.5 rounded-lg bg-stone-100 border border-stone-200 flex items-center gap-2">
                    <span
                      className="px-2 py-0.5 rounded text-[10px] font-bold text-white shadow-2xs"
                      style={{ backgroundColor: primaryColorLight }}
                    >
                      Botão
                    </span>
                    <span
                      className="text-[10px] font-bold px-1.5 py-0.2 rounded uppercase"
                      style={{ backgroundColor: `${primaryColorLight}20`, color: primaryColorLight }}
                    >
                      Tag
                    </span>
                  </div>
                </div>
              </div>

              {/* Paleta Modo Escuro (Dark) */}
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

                {/* Swatches Dark */}
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
                          {isSelected && (
                            <Check className="h-3.5 w-3.5 text-white drop-shadow-sm" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Seletor Customizado Nativo */}
                <div className="flex items-center justify-between pt-2 border-t border-border/50 gap-2">
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={primaryColorDark}
                      onChange={(e) => handleDarkColorChange(e.target.value)}
                      className="h-8 w-8 rounded-lg cursor-pointer border border-border bg-transparent p-0.5"
                      title="Escolha qualquer cor personalizada para Modo Escuro"
                    />
                    <Input
                      value={primaryColorDark}
                      onChange={(e) => handleDarkColorChange(e.target.value)}
                      placeholder="#000000"
                      className="w-24 h-8 font-mono text-xs uppercase"
                      maxLength={7}
                    />
                  </div>

                  {/* Mini Preview Card Escuro */}
                  <div className="px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-800 flex items-center gap-2">
                    <span
                      className="px-2 py-0.5 rounded text-[10px] font-bold text-white shadow-2xs"
                      style={{ backgroundColor: primaryColorDark }}
                    >
                      Botão
                    </span>
                    <span
                      className="text-[10px] font-bold px-1.5 py-0.2 rounded uppercase"
                      style={{ backgroundColor: `${primaryColorDark}25`, color: primaryColorDark }}
                    >
                      Tag
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* 3. Logotipo & Favicon */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-2 border-t border-border/50">
            {/* Logotipo */}
            <div className="space-y-3">
              <Label className="text-sm font-semibold flex items-center gap-1.5">
                <ImageIcon className="h-4 w-4 text-primary" />
                Logotipo Principal
              </Label>

              <div className="flex items-center gap-4">
                <div className="h-16 w-16 rounded-xl border border-border/80 bg-muted/30 flex items-center justify-center overflow-hidden p-1">
                  <img
                    src={logoUrl || "/logo.png"}
                    alt="Logo preview"
                    className="max-h-full max-w-full object-contain"
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).src = "/logo.png";
                    }}
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
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => logoFileInputRef.current?.click()}
                      disabled={uploadingLogo}
                      className="gap-1.5 text-xs"
                    >
                      <Upload className="h-3.5 w-3.5" />
                      {uploadingLogo ? "Enviando..." : "Upload Logo"}
                    </Button>
                    {logoUrl && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setLogoUrl("")}
                        className="text-xs text-muted-foreground hover:text-destructive"
                      >
                        Remover
                      </Button>
                    )}
                  </div>
                  <Input
                    placeholder="Ou cole a URL direta da imagem"
                    value={logoUrl}
                    onChange={(e) => setLogoUrl(e.target.value)}
                    className="h-8 text-xs"
                  />
                </div>
              </div>
            </div>

            {/* Favicon */}
            <div className="space-y-3">
              <Label className="text-sm font-semibold flex items-center gap-1.5">
                <Globe className="h-4 w-4 text-primary" />
                Favicon (Ícone do Navegador)
              </Label>

              <div className="flex items-center gap-4">
                <div className="h-16 w-16 rounded-xl border border-border/80 bg-muted/30 flex items-center justify-center overflow-hidden p-2">
                  <img
                    src={faviconUrl || "/favicon.ico"}
                    alt="Favicon preview"
                    className="max-h-full max-w-full object-contain"
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).src = "/favicon.ico";
                    }}
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
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => faviconFileInputRef.current?.click()}
                      disabled={uploadingFavicon}
                      className="gap-1.5 text-xs"
                    >
                      <Upload className="h-3.5 w-3.5" />
                      {uploadingFavicon ? "Enviando..." : "Upload Favicon"}
                    </Button>
                    {faviconUrl && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setFaviconUrl("")}
                        className="text-xs text-muted-foreground hover:text-destructive"
                      >
                        Remover
                      </Button>
                    )}
                  </div>
                  <Input
                    placeholder="Ou cole a URL direta do favicon"
                    value={faviconUrl}
                    onChange={(e) => setFaviconUrl(e.target.value)}
                    className="h-8 text-xs"
                  />
                </div>
              </div>
            </div>

            {/* Vídeo Tutorial do Guia de Uso */}
            <div className="space-y-3 sm:col-span-2 pt-4 border-t border-border/60">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-semibold flex items-center gap-1.5">
                  <Video className="h-4 w-4 text-primary" />
                  Vídeo Tutorial (Aba Guia de Uso)
                </Label>
                {tutorialVideoUrl && tutorialVideoUrl !== "/criar-conta.mp4" && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setTutorialVideoUrl("/criar-conta.mp4")}
                    className="text-xs text-muted-foreground hover:text-foreground h-7 px-2"
                  >
                    Restaurar Vídeo Original
                  </Button>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                Informe o link do vídeo tutorial exibido na seção <strong>"Guia de Uso & Configuração"</strong> para todos os clientes. Suporta vídeos do YouTube (ex: <code>https://www.youtube.com/watch?v=...</code> ou <code>https://youtu.be/...</code>), Vimeo, Loom ou link direto de vídeo MP4 (ex: <code>/criar-conta.mp4</code> ou URL do Supabase Storage).
              </p>
              <Input
                placeholder="Ex: https://www.youtube.com/watch?v=... ou /criar-conta.mp4"
                value={tutorialVideoUrl}
                onChange={(e) => setTutorialVideoUrl(e.target.value)}
                className="text-xs font-mono"
              />
            </div>
          </div>

          {/* 4. Live Preview Box com alternância de tema */}
          <div className="space-y-3 pt-2 border-t border-border/50">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                <Eye className="h-3.5 w-3.5" />
                Pré-visualização em Tempo Real (Live Preview)
              </Label>

              {/* Seletor de Tema para o Preview */}
              <div className="inline-flex rounded-xl bg-muted p-1 border border-border">
                <button
                  type="button"
                  onClick={() => setPreviewTheme("light")}
                  className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                    previewTheme === "light"
                      ? "bg-card text-foreground shadow-xs"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Sun className="h-3 w-3 text-amber-500" /> Modo Claro
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewTheme("dark")}
                  className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                    previewTheme === "dark"
                      ? "bg-card text-foreground shadow-xs"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Moon className="h-3 w-3 text-indigo-400" /> Modo Escuro
                </button>
              </div>
            </div>

            {/* Container do Preview Dinâmico */}
            <div
              className={`rounded-2xl border p-5 shadow-sm space-y-4 transition-all ${
                previewTheme === "dark"
                  ? "bg-slate-950 border-slate-800 text-slate-100"
                  : "bg-white border-stone-200 text-stone-900"
              }`}
            >
              {/* Simulação de Header */}
              <div
                className={`flex items-center justify-between border-b pb-3.5 ${
                  previewTheme === "dark" ? "border-slate-800" : "border-stone-200"
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <img
                    src={logoUrl || "/logo.png"}
                    alt="Logo"
                    className="h-8 w-8 object-contain rounded"
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).src = "/logo.png";
                    }}
                  />
                  <span
                    className={`text-lg font-black tracking-tight ${
                      previewTheme === "dark" ? "text-white" : "text-stone-900"
                    }`}
                  >
                    {appName || "PLATAFY Social"}
                  </span>
                  {appTagline && (
                    <span
                      className="text-xs font-bold px-2 py-0.5 rounded uppercase tracking-wider transition-colors"
                      style={{
                        backgroundColor: `${currentPreviewColor}20`,
                        color: currentPreviewColor,
                      }}
                    >
                      {appTagline}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    className="px-3.5 py-1.5 text-xs font-bold rounded-xl text-white shadow-sm transition-transform hover:scale-105 active:scale-95"
                    style={{ backgroundColor: currentPreviewColor }}
                  >
                    Botão de Ação
                  </button>
                  <button
                    type="button"
                    className={`px-3 py-1.5 text-xs font-medium rounded-xl border transition-colors ${
                      previewTheme === "dark"
                        ? "border-slate-800 text-slate-300 hover:bg-slate-900"
                        : "border-stone-300 text-stone-700 hover:bg-stone-100"
                    }`}
                  >
                    Cancelar
                  </button>
                </div>
              </div>

              {/* Simulação de elemento com badge e texto */}
              <div
                className={`flex flex-col sm:flex-row sm:items-center justify-between text-xs gap-2 pt-1 ${
                  previewTheme === "dark" ? "text-slate-400" : "text-stone-500"
                }`}
              >
                <span>
                  Título da aba:{" "}
                  <strong className={previewTheme === "dark" ? "text-white" : "text-stone-900"}>
                    {appName || "PLATAFY Social"}
                    {appTagline ? ` ${appTagline}` : ""} - Gestão Inteligente
                  </strong>
                </span>

                <div className="flex items-center gap-2">
                  <span
                    className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold"
                    style={{
                      backgroundColor: `${currentPreviewColor}18`,
                      color: currentPreviewColor,
                    }}
                  >
                    <span
                      className="h-2 w-2 rounded-full"
                      style={{ backgroundColor: currentPreviewColor }}
                    />
                    Paleta {previewTheme === "dark" ? "Escuro" : "Claro"} ({currentPreviewColor})
                  </span>
                </div>
              </div>
            </div>
          </div>
        </CardContent>

        <CardFooter className="flex justify-end gap-3 pt-4 border-t border-border/40">
          <Button
            onClick={handleSave}
            disabled={saving || uploadingLogo || uploadingFavicon}
            className="gap-2 px-6 font-semibold"
          >
            {saving ? "Salvando..." : "Salvar Configurações White Label"}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
