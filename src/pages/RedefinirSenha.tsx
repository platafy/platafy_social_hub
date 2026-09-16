import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card";
import { BrandLogo } from "@/components/BrandLogo";
import { toast } from "sonner";
import { Loader2, CheckCircle2, AlertCircle, Lock, Eye, EyeOff, ArrowLeft, KeyRound } from "lucide-react";

export default function RedefinirSenha() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [hasValidSession, setHasValidSession] = useState<boolean | null>(null);

  useEffect(() => {
    // Verificar se existe uma sessão ativa (de recuperação de senha ou usuário autenticado)
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setHasValidSession(true);
      } else {
        // Pode ser que os tokens ainda estejam sendo processados na URL hash
        const hash = window.location.hash;
        if (hash.includes("access_token=") || hash.includes("type=recovery")) {
          setHasValidSession(true);
        } else {
          // Aguardar um pouco para o cliente Supabase processar o hash
          setTimeout(async () => {
            const { data } = await supabase.auth.getSession();
            setHasValidSession(!!data.session);
          }, 1000);
        }
      }
    });

    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" || session) {
        setHasValidSession(true);
      }
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg(null);

    if (password.length < 6) {
      setErrorMsg("A nova senha deve ter no mínimo 6 caracteres.");
      return;
    }

    if (password !== confirmPassword) {
      setErrorMsg("As senhas informadas não coincidem.");
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password: password,
      });

      if (error) {
        throw error;
      }

      setSuccess(true);
      toast.success("Senha redefinida com sucesso!");

      // Desconectar sessão temporária de recuperação para que o usuário faça login com as novas credenciais
      setTimeout(async () => {
        try {
          await supabase.auth.signOut();
        } catch {
          // ignore
        }
        navigate("/login", { replace: true });
      }, 3000);
    } catch (err: any) {
      const msg = err.message || "Não foi possível redefinir a senha. O link pode ter expirado.";
      setErrorMsg(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-[85vh] flex flex-col items-center justify-center px-4 py-8 relative">
      {/* Glow de fundo */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-72 h-72 bg-primary/10 rounded-full blur-3xl pointer-events-none -z-10" />

      <BrandLogo size="lg" className="mb-6" />

      <Card className="w-full max-w-[420px] border border-border/80 shadow-xl rounded-3xl bg-card/90 backdrop-blur-md">
        <CardHeader className="space-y-2 pb-5 text-center">
          <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mx-auto border border-primary/20 mb-1">
            <KeyRound className="w-6 h-6" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-foreground">
            Criar Nova Senha
          </h1>
          <CardDescription className="text-muted-foreground text-xs sm:text-sm">
            Digite e confirme sua nova senha de acesso à plataforma
          </CardDescription>
        </CardHeader>

        <CardContent>
          {success ? (
            <div className="space-y-4 text-center py-4">
              <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center mx-auto border border-emerald-500/20">
                <CheckCircle2 className="w-7 h-7" />
              </div>
              <div className="space-y-1">
                <h3 className="font-bold text-lg text-emerald-500">Senha Alterada!</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Sua senha foi redefinida com segurança. Você será redirecionado para a tela de login em instantes...
                </p>
              </div>
              <Button
                asChild
                className="w-full h-11 font-bold rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 hover:from-amber-600 hover:to-orange-600"
              >
                <Link to="/login">Ir para o Login</Link>
              </Button>
            </div>
          ) : (
            <form onSubmit={onSubmit} className="space-y-4">
              {hasValidSession === false && (
                <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3.5 flex items-start gap-2.5 text-xs text-amber-500 dark:text-amber-400">
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                  <p>
                    Aviso: O link de recuperação pode ter expirado ou não foi identificado. Caso ocorra erro ao salvar, solicite um novo link em &ldquo;Recuperar Senha&rdquo;.
                  </p>
                </div>
              )}

              {errorMsg && (
                <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-3.5 flex items-start gap-2.5 text-xs text-destructive">
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                  <p>{errorMsg}</p>
                </div>
              )}

              {/* Campo Nova Senha */}
              <div className="space-y-1.5">
                <Label htmlFor="new-password" className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                  <Lock className="h-3.5 w-3.5 text-primary" /> Nova Senha
                </Label>
                <div className="relative">
                  <Input
                    id="new-password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Mínimo 6 caracteres"
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      if (errorMsg) setErrorMsg(null);
                    }}
                    disabled={loading}
                    required
                    className="h-11 pr-10 bg-background/80"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {/* Campo Confirmar Nova Senha */}
              <div className="space-y-1.5">
                <Label htmlFor="confirm-password" className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                  <Lock className="h-3.5 w-3.5 text-primary" /> Confirmar Nova Senha
                </Label>
                <div className="relative">
                  <Input
                    id="confirm-password"
                    type={showConfirmPassword ? "text" : "password"}
                    placeholder="Repita a nova senha"
                    value={confirmPassword}
                    onChange={(e) => {
                      setConfirmPassword(e.target.value);
                      if (errorMsg) setErrorMsg(null);
                    }}
                    disabled={loading}
                    required
                    className="h-11 pr-10 bg-background/80"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    tabIndex={-1}
                  >
                    {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <Button
                type="submit"
                className="w-full h-11 font-bold rounded-xl shadow-sm hover:shadow transition-all gap-2 bg-gradient-to-r from-amber-500 via-amber-500 to-orange-500 hover:from-amber-600 hover:via-amber-600 hover:to-orange-600 text-slate-950 border-0"
                disabled={loading}
              >
                {loading && <Loader2 className="h-4 w-4 animate-spin text-slate-950" />}
                {loading ? "Atualizando senha..." : "Salvar Nova Senha"}
              </Button>

              <div className="text-center text-xs sm:text-sm pt-2">
                <Link
                  to="/login"
                  className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 font-medium transition-colors"
                >
                  <ArrowLeft className="h-3.5 w-3.5" /> Voltar ao Login
                </Link>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
