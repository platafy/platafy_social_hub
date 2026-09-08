import { useState, useRef } from "react";
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
  Globe, Video
} from "lucide-react";


const PRESET_COLORS = [
  { name: "Laranja Platafy", hex: "#ff451a" },
  { name: "Azul Royal", hex: "#2563eb" },
  { name: "Roxo Tech", hex: "#7c3aed" },
  { name: "Verde Esmeralda", hex: "#10b981" },
  { name: "Rosa Coral", hex: "#f43f5e" },
  { name: "Índigo Profundo", hex: "#4f46e5" },
  { name: "Turquesa Cyber", hex: "#06b6d4" },
  { name: "Grafite Minimal", hex: "#1e293b" },
];

export function WhiteLabelSettings() {
  const { branding, updateBranding, resetToDefault, applyBrandColors } = useBranding();
  const { tenantId, isSuperAdmin } = useAuth();

  if (!isSuperAdmin) return null;

  const [appName, setAppName] = useState(branding.app_name);
  const [appTagline, setAppTagline] = useState(branding.app_tagline);
  const [primaryColor, setPrimaryColor] = useState(branding.primary_color);
  const [logoUrl, setLogoUrl] = useState(branding.logo_url);
  const [faviconUrl, setFaviconUrl] = useState(branding.favicon_url);
  const [tutorialVideoUrl, setTutorialVideoUrl] = useState(branding.tutorial_video_url || "/criar-conta.mp4");

  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingFavicon, setUploadingFavicon] = useState(false);

  const logoFileInputRef = useRef<HTMLInputElement>(null);
  const faviconFileInputRef = useRef<HTMLInputElement>(null);

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

  function handleColorChange(newColor: string) {
    setPrimaryColor(newColor);
    applyBrandColors(newColor);
  }

  async function handleSave() {
    setSaving(true);
    await updateBranding({
      app_name: appName.trim() || DEFAULT_BRANDING.app_name,
      app_tagline: appTagline.trim(),
      primary_color: primaryColor || DEFAULT_BRANDING.primary_color,
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
    setPrimaryColor(DEFAULT_BRANDING.primary_color);
    setLogoUrl(DEFAULT_BRANDING.logo_url);
    setFaviconUrl(DEFAULT_BRANDING.favicon_url);
    setTutorialVideoUrl(DEFAULT_BRANDING.tutorial_video_url || "/criar-conta.mp4");
    applyBrandColors(DEFAULT_BRANDING.primary_color);
    setSaving(false);
  }

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

        <CardContent className="space-y-6">
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

          {/* 2. Cores da Marca */}
          <div className="space-y-3 pt-2 border-t border-border/50">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-semibold flex items-center gap-1.5">
                <Palette className="h-4 w-4 text-primary" />
                Cor Primária da Interface
              </Label>
              <span className="text-xs font-mono font-semibold px-2 py-0.5 rounded bg-muted">
                {primaryColor}
              </span>
            </div>

            {/* Paleta Rápida */}
            <div className="flex flex-wrap gap-2.5 items-center">
              {PRESET_COLORS.map((col) => (
                <button
                  key={col.hex}
                  type="button"
                  onClick={() => handleColorChange(col.hex)}
                  className={`group relative h-9 w-9 rounded-full transition-all flex items-center justify-center border-2 ${
                    primaryColor.toLowerCase() === col.hex.toLowerCase()
                      ? "border-foreground scale-110 shadow-md"
                      : "border-transparent hover:scale-105"
                  }`}
                  style={{ backgroundColor: col.hex }}
                  title={col.name}
                >
                  {primaryColor.toLowerCase() === col.hex.toLowerCase() && (
                    <Check className="h-4 w-4 text-white drop-shadow-sm" />
                  )}
                </button>
              ))}

              {/* Seletor Customizado Nativo */}
              <div className="flex items-center gap-2 ml-2 pl-2 border-l border-border">
                <input
                  type="color"
                  value={primaryColor}
                  onChange={(e) => handleColorChange(e.target.value)}
                  className="h-9 w-9 rounded-lg cursor-pointer border border-border bg-transparent p-0.5"
                  title="Escolha qualquer cor personalizada"
                />
                <Input
                  value={primaryColor}
                  onChange={(e) => handleColorChange(e.target.value)}
                  placeholder="#000000"
                  className="w-24 h-9 font-mono text-xs uppercase"
                  maxLength={7}
                />
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
                <div className="h-16 w-16 rounded-xl border border-border/80 bg-muted/30 flex items-center justify-center overflow-hidden p-1">
                  <img
                    src={faviconUrl || "/favicon.svg"}
                    alt="Favicon preview"
                    className="h-8 w-8 object-contain"
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).src = "/favicon.svg";
                    }}
                  />
                </div>
                <div className="space-y-1.5 flex-1">
                  <input
                    type="file"
                    ref={faviconFileInputRef}
                    accept="image/png,image/x-icon,image/svg+xml"
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

          {/* 4. Live Preview Box */}
          <div className="space-y-2 pt-2 border-t border-border/50">
            <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
              <Eye className="h-3.5 w-3.5" />
              Pré-visualização em Tempo Real (Live Preview)
            </Label>
            <div className="rounded-xl border border-border bg-card/80 p-4 shadow-sm space-y-4">
              {/* Simulação de Header */}
              <div className="flex items-center justify-between border-b border-border/40 pb-3">
                <div className="flex items-center gap-2.5">
                  <img
                    src={logoUrl || "/logo.png"}
                    alt="Logo"
                    className="h-7 w-7 object-contain rounded"
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).src = "/logo.png";
                    }}
                  />
                  <span className="text-lg font-black tracking-tight text-foreground">
                    {appName || "PLATAFY Social"}
                  </span>
                  {appTagline && (
                    <span
                      className="text-xs font-bold px-1.5 py-0.5 rounded uppercase tracking-wider"
                      style={{
                        backgroundColor: `${primaryColor}20`,
                        color: primaryColor,
                      }}
                    >
                      {appTagline}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    className="px-3 py-1.5 text-xs font-semibold rounded-lg text-white shadow-sm transition-all"
                    style={{ backgroundColor: primaryColor }}
                  >
                    Botão de Ação
                  </button>
                  <button
                    type="button"
                    className="px-3 py-1.5 text-xs font-medium rounded-lg border border-border text-foreground hover:bg-muted"
                  >
                    Cancelar
                  </button>
                </div>
              </div>

              {/* Simulação de elemento com badge e texto */}
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Título da aba: <strong className="text-foreground">{appName || "PLATAFY Social"}{appTagline ? ` ${appTagline}` : ""} - Gestão Inteligente</strong></span>
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: primaryColor }} />
                  Tema Ativo
                </span>
              </div>
            </div>
          </div>
        </CardContent>

        <CardFooter className="flex justify-end gap-3 pt-2 border-t border-border/40">
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
