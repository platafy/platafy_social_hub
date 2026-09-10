import { useState } from "react";
import { useNavigate, Link, useLocation } from "react-router-dom";
import { supabase, isSupabaseConfigured } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useBranding } from "@/contexts/BrandingContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BrandLogo } from "@/components/BrandLogo";
import { Eye, EyeOff, Lock, Mail, ArrowRight, Loader2 } from "lucide-react";
import { toast } from "sonner";

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation() as { state?: { from?: string } };
  const { refresh } = useAuth();
  const { branding } = useBranding();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  // Informações configuráveis pelo Super Admin
  const headline = branding.login_headline || "Transforme Conversas em\nVendas com Agentes de IA";
  const subheadline =
    branding.login_subheadline ||
    "A PLATAFY reúne Agentes de Inteligência Artificial, automação de atendimento, CRM, WhatsApp e múltiplos canais para acelerar o crescimento da sua empresa 24 horas por dia.";
  const bgImageUrl = branding.login_bg_image_url || "/login-bg.webp";
  const bgLayout = branding.login_bg_layout || "split-left";
  const statsEnabled = !!branding.login_stats_enabled;
  const footerText = branding.footer_text || `© ${new Date().getFullYear()} ${branding.app_name || "PLATAFY"}. Todos os direitos reservados.`;
  const logoPosition = branding.login_logo_position || "right";
  const isLogoOnLeft = logoPosition === "left";
  const isLogoOnRight = logoPosition !== "left";

  const headlineParts = headline.split("\n");
  const isSplitRight = bgLayout === "split-right";
  const isFullscreen = bgLayout === "fullscreen";

  async function handleGoogleLogin() {
    if (!isSupabaseConfigured) {
      toast.error("Configure as variáveis do Supabase antes de fazer login.");
      return;
    }
    setGoogleLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/`,
        },
      });
      if (error) {
        toast.error(error.message || "Erro ao conectar com Google");
      }
    } catch (err: any) {
      toast.error(err.message || "Falha na autenticação Google");
    } finally {
      setGoogleLoading(false);
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isSupabaseConfigured) {
      toast.error("Configure as variáveis do Supabase na Vercel antes de fazer login.");
      return;
    }
    setLoading(true);

    const cleanEmail = email.trim().toLowerCase();
    let loginSuccess = false;

    // 1. Tenta login via Edge Function
    try {
      const { data, error } = await supabase.functions.invoke("login", {
        body: { email: cleanEmail, password },
      });

      if (!error && data?.session) {
        await supabase.auth.setSession({
          access_token: data.session.access_token,
          refresh_token: data.session.refresh_token,
        });
        loginSuccess = true;
      } else if (error) {
        let errMessage = "";
        try {
          if (error.context && typeof error.context.json === "function") {
            const body = await error.context.json();
            errMessage = body?.error || "";
          }
        } catch {
          // ignore
        }

        if (
          errMessage.toLowerCase().includes("invalid login credentials") ||
          errMessage.toLowerCase().includes("invalid_credentials") ||
          error.message?.includes("401") ||
          error.status === 401
        ) {
          setLoading(false);
          toast.error("E-mail ou senha incorretos.");
          return;
        }
      } else if (data?.error) {
        setLoading(false);
        toast.error(data.error);
        return;
      }
    } catch {
      // Fallback direto
    }

    // 2. Fallback direto via Supabase Auth caso a Edge Function não tenha autenticado
    if (!loginSuccess) {
      const { error: authError } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password,
      });

      if (authError) {
        setLoading(false);
        if (
          authError.message?.toLowerCase().includes("invalid login credentials") ||
          authError.code === "invalid_credentials"
        ) {
          toast.error("E-mail ou senha incorretos.");
        } else {
          toast.error(authError.message || "Ocorreu um erro ao tentar entrar.");
        }
        return;
      }
    }

    await refresh();
    setLoading(false);
    toast.success("Bem-vindo de volta!");
    navigate(location.state?.from ?? "/", { replace: true });
  }

  return (
    <div
      className={`min-h-screen w-full flex relative overflow-hidden bg-[#070b14] text-foreground ${
        isSplitRight ? "lg:flex-row-reverse" : "lg:flex-row"
      } flex-col`}
      style={
        isFullscreen && bgImageUrl
          ? {
              backgroundImage: `url(${bgImageUrl})`,
              backgroundSize: "cover",
              backgroundPosition: "center",
            }
          : undefined
      }
    >
      {/* Background Overlay quando em fullscreen */}
      {isFullscreen && bgImageUrl && (
        <div className="absolute inset-0 bg-background/80 backdrop-blur-md pointer-events-none z-0" />
      )}

      {/* Mobile background com overlay */}
      {!isFullscreen && bgImageUrl && (
        <>
          <div
            className="lg:hidden absolute inset-0 pointer-events-none z-0"
            style={{
              backgroundImage: `url(${bgImageUrl})`,
              backgroundSize: "cover",
              backgroundPosition: "center",
            }}
          />
          <div className="lg:hidden absolute inset-0 bg-[#070b14]/90 backdrop-blur-md pointer-events-none z-0" />
        </>
      )}

      {/* Painel Esquerdo Hero (Visual / Imagem de Fundo) */}
      {!isFullscreen && (
        <div
          className="hidden lg:flex lg:w-1/2 p-10 xl:p-14 flex-col justify-between relative overflow-hidden z-10 select-none"
          style={
            bgImageUrl
              ? {
                  backgroundImage: `url(${bgImageUrl})`,
                  backgroundSize: "cover",
                  backgroundPosition: "center",
                }
              : {
                  background: "radial-gradient(circle at 30% 30%, #1e293b, #090d16)",
                }
          }
        >
          {/* Subtle gradient overlay to enhance text contrast */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/35 to-black/30 pointer-events-none" />

          {/* Top Logo se estiver configurado na esquerda */}
          {isLogoOnLeft ? (
            <div className="relative z-10">
              <BrandLogo size="lg" />
            </div>
          ) : (
            <div className="relative z-10 h-10" />
          )}

          {/* Bottom Content */}
          <div className="relative z-10 space-y-4 max-w-lg mt-auto">
            <h1 className="text-2xl xl:text-3xl font-black text-white leading-tight drop-shadow-md">
              {headlineParts.map((part, i) => (
                <span key={i}>
                  {part}
                  {i < headlineParts.length - 1 && <br />}
                </span>
              ))}
            </h1>
            <p className="text-white/85 text-sm xl:text-base leading-relaxed whitespace-pre-line drop-shadow-sm font-normal">
              {subheadline}
            </p>

            {/* Estatísticas Opcionais */}
            {statsEnabled && (
              <div className="grid grid-cols-3 gap-3 pt-4 border-t border-white/10">
                <div className="p-2.5 rounded-xl bg-black/40 backdrop-blur-sm border border-white/10 text-center">
                  <p className="text-lg font-black text-amber-400">+40%</p>
                  <p className="text-[11px] text-white/70">Conversão</p>
                </div>
                <div className="p-2.5 rounded-xl bg-black/40 backdrop-blur-sm border border-white/10 text-center">
                  <p className="text-lg font-black text-amber-400">-50%</p>
                  <p className="text-[11px] text-white/70">Tempo resp.</p>
                </div>
                <div className="p-2.5 rounded-xl bg-black/40 backdrop-blur-sm border border-white/10 text-center">
                  <p className="text-lg font-black text-amber-400">24/7</p>
                  <p className="text-[11px] text-white/70">Atendimento</p>
                </div>
              </div>
            )}

            <p className="text-[11px] text-white/60 pt-2">{footerText}</p>
          </div>
        </div>
      )}

      {/* Painel Direito (Formulário de Login) */}
      <div
        className={`w-full ${
          isFullscreen ? "max-w-md mx-auto" : "lg:w-1/2"
        } min-h-screen flex flex-col justify-between p-6 sm:p-10 xl:p-14 relative z-10`}
      >
        {/* Top Logo na coluna da direita */}
        <div className={`w-full flex items-center justify-center lg:justify-start ${isLogoOnRight ? "flex" : "lg:hidden"}`}>
          <BrandLogo size="lg" />
        </div>

        <div className="w-full max-w-[420px] mx-auto my-auto py-6 space-y-7">
          {/* Cabeçalho do formulário */}
          <div className="space-y-1.5 text-center lg:text-left">
            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
              Entrar na conta
            </h2>
            <p className="text-sm text-slate-400">
              Entre com suas credenciais para acessar
            </p>
          </div>

          {!isSupabaseConfigured && (
            <div className="rounded-xl bg-amber-500/10 border border-amber-500/25 p-3.5 text-xs text-amber-400">
              <p className="font-semibold mb-1">⚠️ Supabase não configurado</p>
              <p>Adicione as variáveis de ambiente na Vercel para ativar o login e o banco de dados.</p>
            </div>
          )}

          {/* Botão Google Login */}
          <div className="space-y-4">
            <Button
              type="button"
              variant="outline"
              onClick={handleGoogleLogin}
              disabled={googleLoading}
              className="w-full h-12 rounded-xl bg-slate-900/80 hover:bg-slate-800 text-white border-slate-700/80 hover:border-slate-600 font-semibold gap-3 text-sm transition-all shadow-sm"
            >
              {googleLoading ? (
                <Loader2 className="h-4 w-4 animate-spin text-amber-400" />
              ) : (
                <svg className="h-5 w-5" viewBox="0 0 24 24">
                  <path
                    fill="#EA4335"
                    d="M12 5c1.6 0 3 .6 4.1 1.7l3.1-3.1C17.3 1.8 14.8 1 12 1 7.5 1 3.7 3.6 1.9 7.3l3.7 2.9C6.5 7.3 9 5 12 5z"
                  />
                  <path
                    fill="#4285F4"
                    d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5c-.3 1.5-1.1 2.8-2.4 3.7l3.7 2.9c2.2-2 3.7-5 3.7-8.8z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.6 14.8c-.2-.7-.4-1.5-.4-2.3s.2-1.6.4-2.3L1.9 7.3C.7 9.7 0 12 0 14.5s.7 4.8 1.9 7.2l3.7-2.9z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23.5c3.2 0 6-1.1 8-3l-3.7-2.9c-1.1.7-2.5 1.2-4.3 1.2-3 0-5.5-2.3-6.4-5.2L1.9 16.5C3.7 20.2 7.5 23.5 12 23.5z"
                  />
                </svg>
              )}
              Continuar com Google
            </Button>

            {/* Divisor "OU CONTINUE COM EMAIL" */}
            <div className="relative flex items-center justify-center">
              <div className="w-full border-t border-slate-800" />
              <span className="bg-[#070b14] px-3 text-[10px] sm:text-[11px] font-bold tracking-wider text-slate-500 uppercase whitespace-nowrap absolute">
                OU CONTINUE COM EMAIL
              </span>
            </div>
          </div>

          {/* Formulário Email e Senha */}
          <form onSubmit={onSubmit} className="space-y-4 pt-1">
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-xs font-semibold text-slate-300">
                Email
              </Label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                <Input
                  id="email"
                  type="email"
                  placeholder="seu@email.com"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="h-12 pl-10 bg-slate-900/90 border-slate-700/80 focus:border-amber-500 rounded-xl text-white placeholder:text-slate-500 text-sm transition-all"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-xs font-semibold text-slate-300">
                Senha
              </Label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••••••••••••••••••••"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="h-12 pl-10 pr-10 bg-slate-900/90 border-slate-700/80 focus:border-amber-500 rounded-xl text-white placeholder:text-slate-500 text-sm transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors p-1"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {/* Botão Entrar Gradiente Ouro/Laranja */}
            <Button
              type="submit"
              disabled={loading}
              className="w-full h-12 mt-2 font-bold text-sm rounded-xl bg-gradient-to-r from-amber-500 via-amber-500 to-orange-500 hover:from-amber-600 hover:via-amber-600 hover:to-orange-600 text-slate-950 shadow-lg shadow-amber-500/20 hover:shadow-amber-500/30 transition-all gap-2 border-0"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin text-slate-950" />
                  Entrando...
                </>
              ) : (
                <>
                  Entrar
                  <ArrowRight className="h-4 w-4 text-slate-950 stroke-[2.5]" />
                </>
              )}
            </Button>

            {/* Link Esqueci minha senha */}
            <div className="text-center pt-2">
              <Link
                to="/recuperar-senha"
                className="text-xs font-semibold text-amber-400 hover:text-amber-300 hover:underline transition-colors"
              >
                Esqueci minha senha
              </Link>
            </div>

            {/* Link Criar conta grátis */}
            <div className="text-center text-xs text-slate-400 pt-3 border-t border-slate-800">
              Ainda não tem uma conta?{" "}
              <Link to="/cadastro" className="text-amber-400 font-bold hover:underline">
                Criar conta grátis
              </Link>
            </div>
          </form>
        </div>

        {/* Espaçador inferior para equilibrar o justify-between */}
        <div className="hidden lg:block h-10" />
      </div>
    </div>
  );
}