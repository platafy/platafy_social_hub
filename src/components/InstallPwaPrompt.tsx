import { useState, useEffect } from "react";
import { Download, X, Share, PlusSquare } from "lucide-react";
import { useBranding } from "@/contexts/BrandingContext";

export function InstallPwaPrompt() {
  const { branding } = useBranding();
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isIOS, setIsIOS] = useState(false);
  const [showPrompt, setShowPrompt] = useState(false);
  const [showIosGuide, setShowIosGuide] = useState(false);

  useEffect(() => {
    // 1. Verificar se já está rodando em modo standalone (já instalado)
    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as any).standalone === true;

    if (isStandalone) {
      return;
    }

    // 2. Verificar se o usuário já dispensou nesta sessão
    const dismissed = sessionStorage.getItem("pwa_prompt_dismissed");
    if (dismissed) {
      return;
    }

    // 3. Detectar iOS Safari
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIosDevice = /iphone|ipad|ipod/.test(userAgent);
    const isSafari = /safari/.test(userAgent) && !/chrome|crios|fxios/.test(userAgent);

    if (isIosDevice && isSafari) {
      setIsIOS(true);
      // Exibir aviso discreto para iOS após 3 segundos
      const timer = setTimeout(() => {
        setShowPrompt(true);
      }, 3000);
      return () => clearTimeout(timer);
    }

    // 4. Ouvir evento de instalação em navegadores Chromium (Android, Chrome, Edge, etc.)
    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowPrompt(true);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstall);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstall);
    };
  }, []);

  const handleInstallClick = async () => {
    if (isIOS) {
      setShowIosGuide(true);
      return;
    }

    if (!deferredPrompt) return;

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    console.log("[PWA] Resposta da instalação:", outcome);
    setDeferredPrompt(null);
    setShowPrompt(false);
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    setShowIosGuide(false);
    sessionStorage.setItem("pwa_prompt_dismissed", "true");
  };

  if (!showPrompt) return null;

  const appName = branding.app_name || "PLATAFY Social Hub";
  const appLogo = branding.logo_url || "/pwa-192x192.png";

  return (
    <>
      {/* Banner Principal de Instalação */}
      <div className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-6 sm:max-w-sm z-50 animate-in fade-in slide-in-from-bottom-5 duration-300">
        <div className="p-3.5 rounded-2xl bg-card border border-border/80 shadow-2xl shadow-primary/10 backdrop-blur-md flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <img
              src={appLogo}
              alt={appName}
              className="w-10 h-10 rounded-xl object-contain bg-muted/40 p-1 border border-border/50 shrink-0"
              onError={(e) => {
                (e.target as HTMLImageElement).src = "/logo.png";
              }}
            />
            <div className="min-w-0">
              <p className="text-xs font-bold text-foreground truncate">
                {appName}
              </p>
              <p className="text-[11px] text-muted-foreground truncate">
                Instale o App
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={handleInstallClick}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-semibold bg-primary text-primary-foreground hover:bg-primary/90 transition-all active:scale-95 shadow-xs"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Instalar</span>
            </button>
            <button
              type="button"
              onClick={handleDismiss}
              className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              title="Fechar"
              aria-label="Fechar"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Modal Guia Passo a Passo para iOS Safari */}
      {showIosGuide && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-sm bg-card border border-border rounded-3xl p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-border">
              <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                <Download className="w-4 h-4 text-primary" />
                Como instalar no iPhone / iPad
              </h3>
              <button
                type="button"
                onClick={() => setShowIosGuide(false)}
                className="p-1 text-muted-foreground hover:text-foreground rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs text-muted-foreground">
              <div className="flex items-start gap-3 p-2.5 rounded-xl bg-secondary/50 border border-border/50">
                <div className="p-2 rounded-lg bg-primary/10 text-primary shrink-0">
                  <Share className="w-4 h-4" />
                </div>
                <div>
                  <p className="font-semibold text-foreground">1. Toque em Compartilhar</p>
                  <p className="text-[11px]">Na barra inferior do Safari, clique no botão de compartilhar (ícone com quadrado e seta).</p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-2.5 rounded-xl bg-secondary/50 border border-border/50">
                <div className="p-2 rounded-lg bg-primary/10 text-primary shrink-0">
                  <PlusSquare className="w-4 h-4" />
                </div>
                <div>
                  <p className="font-semibold text-foreground">2. Adicionar à Tela de Início</p>
                  <p className="text-[11px]">Role para baixo nas opções e selecione <strong>"Adicionar à Tela de Início"</strong>.</p>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={handleDismiss}
              className="w-full py-2.5 rounded-xl bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition-all shadow-xs"
            >
              Entendido
            </button>
          </div>
        </div>
      )}
    </>
  );
}
