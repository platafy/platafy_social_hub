import { useState, useEffect, useCallback } from "react";
import { zernio } from "@/lib/zernio";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  SiInstagram,
  SiFacebook,
  SiYoutube,
  SiTiktok,
  SiWhatsapp,
  SiThreads,
  SiPinterest,
  SiBluesky,
} from "react-icons/si";
import { FaLinkedin, FaXTwitter } from "react-icons/fa6";
import { X, Loader2, Sparkles, ExternalLink, AlertCircle, ShieldCheck, Lock } from "lucide-react";
import { useSubscription } from "@/contexts/SubscriptionContext";

export interface SocialPlatformConfig {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  badge?: string;
  colorClass: string;
  options?: any;
}

// Redes sociais ativas disponíveis para conexão pelo cliente (Facebook, Instagram e YouTube)
const SUPPORTED_PLATFORMS: SocialPlatformConfig[] = [
  {
    id: "facebook",
    name: "Facebook",
    description: "Páginas que você administra",
    icon: <SiFacebook className="w-8 h-8 text-blue-600" />,
    colorClass: "hover:border-blue-600/50 hover:bg-blue-600/5 hover:shadow-blue-500/10",
    options: { headless: true },
  },
  {
    id: "instagram",
    name: "Instagram",
    description: "Contas Profissionais / Criador",
    icon: <SiInstagram className="w-8 h-8 text-pink-500" />,
    colorClass: "hover:border-pink-500/50 hover:bg-pink-500/5 hover:shadow-pink-500/10",
    options: { loginMethod: "instagram_login" },
  },
  {
    id: "youtube",
    name: "YouTube",
    description: "Canal do Google / Shorts",
    icon: <SiYoutube className="w-8 h-8 text-red-600" />,
    colorClass: "hover:border-red-600/50 hover:bg-red-600/5 hover:shadow-red-500/10",
  },
  {
    id: "tiktok",
    name: "TikTok",
    description: "TikTok for Business & Criadores",
    icon: <SiTiktok className="w-8 h-8 text-foreground" />,
    colorClass: "hover:border-foreground/50 hover:bg-foreground/5 hover:shadow-foreground/10",
  },
];

// Redes temporariamente desativadas (Threads, Pinterest, LinkedIn, X/Twitter, WhatsApp, Bluesky).
// Para reativar qualquer uma delas no futuro, basta mover o objeto para o array SUPPORTED_PLATFORMS acima.
export const _INACTIVE_PLATFORMS: SocialPlatformConfig[] = [
  {
    id: "threads",
    name: "Threads",
    description: "Publicações na rede Meta",
    icon: <SiThreads className="w-5 h-5 text-foreground" />,
    colorClass: "hover:border-foreground/40 hover:bg-foreground/5",
  },
  {
    id: "pinterest",
    name: "Pinterest",
    description: "Pins e painéis",
    icon: <SiPinterest className="w-5 h-5 text-red-500" />,
    colorClass: "hover:border-red-500/50 hover:bg-red-500/5",
  },
  {
    id: "linkedin",
    name: "LinkedIn",
    description: "Perfil Pessoal ou Company Page",
    icon: <FaLinkedin className="w-5 h-5 text-sky-600" />,
    colorClass: "hover:border-sky-600/50 hover:bg-sky-600/5",
  },
  {
    id: "twitter",
    name: "X (Twitter)",
    description: "Publicações e métricas do X",
    icon: <FaXTwitter className="w-5 h-5 text-foreground" />,
    colorClass: "hover:border-foreground/40 hover:bg-foreground/5",
  },
  {
    id: "whatsapp",
    name: "WhatsApp",
    description: "Cloud API / Atendimento oficial",
    icon: <SiWhatsapp className="w-5 h-5 text-emerald-500" />,
    colorClass: "hover:border-emerald-500/50 hover:bg-emerald-500/5",
    options: { signup: "hosted" },
  },
  {
    id: "bluesky",
    name: "Bluesky",
    description: "Rede descentralizada AT Protocol",
    icon: <SiBluesky className="w-5 h-5 text-sky-500" />,
    colorClass: "hover:border-sky-500/50 hover:bg-sky-500/5",
  },
];

interface ConnectSocialModalProps {
  isOpen: boolean;
  onClose: () => void;
  profileId: string;
  integrationId?: string;
  currentAccountsCount: number;
  maxAccountsPerProfile?: number;
  onAccountConnected: () => void;
  onOpenFacebookSelect?: (tempToken: string) => void;
}

export function ConnectSocialModal({
  isOpen,
  onClose,
  profileId,
  integrationId,
  currentAccountsCount,
  maxAccountsPerProfile = 2,
  onAccountConnected,
  onOpenFacebookSelect,
}: ConnectSocialModalProps) {
  const { canUseTikTok } = useSubscription();
  const [connectingPlatform, setConnectingPlatform] = useState<string | null>(null);

  const handleOAuthMessage = useCallback(
    (event: MessageEvent) => {
      // Ignorar mensagens que não sejam do nosso tipo de callback
      if (event.data?.type !== "ZERNIO_OAUTH_CALLBACK") return;

      const { connected, accountId, error, errorMessage, tempToken, step } = event.data;

      setConnectingPlatform(null);

      if (error) {
        toast.error(errorMessage || `Não foi possível conectar a rede (${error}).`);
        return;
      }

      // Se for seleção de página do Facebook (headless)
      if (tempToken && (step === "select_account" || step === "select_page" || !accountId)) {
        if (onOpenFacebookSelect) {
          onOpenFacebookSelect(tempToken);
        }
        onClose();
        return;
      }

      // Sucesso na conexão
      if (connected) {
        toast.success("Rede social conectada com sucesso!");
        onAccountConnected();
        onClose();
      }
    },
    [onAccountConnected, onClose, onOpenFacebookSelect]
  );

  useEffect(() => {
    window.addEventListener("message", handleOAuthMessage);
    return () => window.removeEventListener("message", handleOAuthMessage);
  }, [handleOAuthMessage]);

  if (!isOpen) return null;

  const isLimitReached = currentAccountsCount >= maxAccountsPerProfile;

  const handleConnect = async (platform: SocialPlatformConfig) => {
    if (platform.id === "tiktok" && !canUseTikTok) {
      toast.info("A conexão do canal TikTok está disponível nos planos Pro e Agência. Conheça nossos planos para conectar o TikTok!");
      return;
    }

    if (isLimitReached) {
      toast.error(
        `Limite de ${maxAccountsPerProfile} contas atingido neste perfil. Adicione um Novo Perfil Ativo em Canais para conectar mais contas gratuitamente.`
      );
      return;
    }

    setConnectingPlatform(platform.id);

    try {
      const redirectUrl = `${window.location.origin}/oauth-callback.html`;
      const res = await zernio.connectPlatform(
        platform.id,
        profileId,
        redirectUrl,
        integrationId,
        platform.options
      );

      const authUrl = res?.authUrl;
      if (!authUrl) {
        throw new Error("Não foi possível gerar a URL de autorização da rede.");
      }

      // Dimensões do popup centralizado
      const width = 600;
      const height = 720;
      const left = window.screen.width / 2 - width / 2;
      const top = window.screen.height / 2 - height / 2;

      const popup = window.open(
        authUrl,
        `connect_${platform.id}`,
        `width=${width},height=${height},top=${top},left=${left},status=no,resizable=yes,scrollbars=yes`
      );

      // Fallback caso bloqueador de popup impeça window.open
      if (!popup || popup.closed || typeof popup.closed === "undefined") {
        toast.info("Abrindo autorização na mesma janela...");
        window.location.href = authUrl;
      } else {
        popup.focus();
      }
    } catch (err: any) {
      console.error(`Erro ao conectar ${platform.name}:`, err);
      toast.error(err.message || `Falha ao iniciar conexão com ${platform.name}`);
      setConnectingPlatform(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-3.5 sm:p-4 animate-in fade-in duration-200">
      <div className="bg-card border border-border rounded-3xl max-w-2xl w-full p-4 sm:p-5 shadow-2xl space-y-3.5 animate-in zoom-in-95 flex flex-col max-h-[92dvh] overflow-y-auto no-scrollbar">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border pb-2.5 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-xl bg-primary/10 text-primary">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-bold text-foreground">Conectar Rede Social</h3>
              <p className="text-[11px] text-muted-foreground">
                Franquia: {currentAccountsCount} de {maxAccountsPerProfile} contas conectadas neste perfil
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground p-1 rounded-lg hover:bg-muted transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Alerta de Cota do Perfil */}
        {isLimitReached ? (
          <div className="p-2.5 sm:p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-600 dark:text-amber-400 flex items-start gap-2 shrink-0">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <div className="space-y-0.5 text-left">
              <p className="font-bold">Capacidade do Perfil Atingida</p>
              <p className="text-[11px] leading-tight text-muted-foreground">
                Cada Perfil Ativo suporta até <strong>{maxAccountsPerProfile} contas sociais gratuitas</strong>. Para conectar novas redes, adicione um <strong>Novo Perfil Ativo</strong> no menu de Canais.
              </p>
            </div>
          </div>
        ) : (
          <div className="p-2.5 rounded-xl bg-secondary/30 border border-border text-[11px] text-muted-foreground flex items-center gap-2 shrink-0">
            <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0" />
            <span>
              Autorização direta e segura via OAuth oficial. Suas credenciais nunca são compartilhadas.
            </span>
          </div>
        )}

        {/* Lista de Redes Sociais - 2 cards por linha */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 py-0.5">
          {SUPPORTED_PLATFORMS.map((platform) => {
            const isThisConnecting = connectingPlatform === platform.id;
            const isTikTokLocked = platform.id === "tiktok" && !canUseTikTok;

            return (
              <button
                key={platform.id}
                type="button"
                disabled={isLimitReached || connectingPlatform !== null}
                onClick={() => handleConnect(platform)}
                className={`group relative p-3 sm:p-3.5 rounded-xl border text-center flex flex-col items-center justify-between gap-2.5 transition-all cursor-pointer ${
                  platform.colorClass
                } ${
                  isLimitReached
                    ? "opacity-50 cursor-not-allowed border-border/40"
                    : "border-border/70 bg-card/70 hover:shadow-xl hover:-translate-y-0.5 hover:border-primary/50"
                }`}
              >
                {isTikTokLocked && (
                  <div className="absolute top-2 right-2 flex items-center gap-1 bg-amber-500/15 text-amber-600 dark:text-amber-400 text-[9px] font-bold px-1.5 py-0.5 rounded-full border border-amber-500/20">
                    <Lock className="w-2.5 h-2.5" /> Pro
                  </div>
                )}
                <div className="p-2 rounded-xl bg-secondary/50 border border-border/60 group-hover:scale-105 transition-transform shrink-0 shadow-xs">
                  {platform.icon}
                </div>
                <div className="space-y-0.5 min-w-0 w-full text-center">
                  <p className="text-xs sm:text-sm font-bold text-foreground truncate">
                    {platform.name}
                  </p>
                  <p className="text-[10.5px] text-muted-foreground leading-tight line-clamp-1">
                    {platform.description}
                  </p>
                </div>
                <div className="w-full pt-0.5">
                  <span className={`w-full inline-flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg text-xs font-semibold transition-all shadow-2xs ${
                    isTikTokLocked
                      ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20"
                      : "bg-secondary/60 group-hover:bg-primary group-hover:text-primary-foreground text-foreground"
                  }`}>
                    {isThisConnecting ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Conectando...</span>
                      </>
                    ) : isTikTokLocked ? (
                      <>
                        <Lock className="w-3 h-3" />
                        <span>Liberar no Pro</span>
                      </>
                    ) : (
                      <>
                        <span>Conectar</span>
                        <ExternalLink className="w-3 h-3 opacity-60" />
                      </>
                    )}
                  </span>
                </div>
              </button>
            );
          })}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-border pt-2.5 shrink-0">
          <p className="text-[10px] text-muted-foreground">
            Abre janela de autorização oficial e segura
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onClose}
            className="rounded-xl text-xs h-7 px-3"
          >
            Fechar
          </Button>
        </div>
      </div>
    </div>
  );
}
