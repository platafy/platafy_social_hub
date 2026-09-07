import { useState } from "react";
import { useNavigate, Link, useLocation } from "react-router-dom";
import { supabase, isSupabaseConfigured } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card";
import { BrandLogo } from "@/components/BrandLogo";
import { Eye, EyeOff, Lock, Mail, ArrowRight } from "lucide-react";
import { toast } from "sonner";

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation() as { state?: { from?: string } };
  const { refresh } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isSupabaseConfigured) {
      toast.error("Configure as variáveis do Supabase na Vercel antes de fazer login.");
      return;
    }
    setLoading(true);
    const { data, error } = await supabase.functions.invoke("login", {
      body: { email, password },
    });

    if (error) {
      setLoading(false);
      if (error.message?.includes("401") || error.status === 401) {
        toast.error("E-mail ou senha incorretos.");
      } else {
        toast.error(error.message || "Ocorreu um erro ao tentar entrar.");
      }
      return;
    }

    if (data?.error) {
      setLoading(false);
      toast.error(data.error);
      return;
    }

    if (data?.session) {
      await supabase.auth.setSession({
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
      });
    }
    await refresh();
    setLoading(false);
    toast.success("Bem-vindo!");
    navigate(location.state?.from ?? "/", { replace: true });
  }

  return (
    <div className="min-h-[85vh] flex flex-col items-center justify-center px-4 py-8 relative">
      {/* Background ambient decorative glow */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-72 h-72 bg-primary/10 rounded-full blur-3xl pointer-events-none -z-10" />

      <BrandLogo size="lg" className="mb-6" />

      <Card className="w-full max-w-[420px] border border-border/80 shadow-xl rounded-3xl bg-card/90 backdrop-blur-md">
        <CardHeader className="space-y-2 pb-6 text-center">
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-foreground">Acesse sua conta</h1>
          <CardDescription className="text-muted-foreground text-xs sm:text-sm">
            Entre com suas credenciais para gerenciar suas redes
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!isSupabaseConfigured && (
            <div className="rounded-xl bg-amber-500/10 border border-amber-500/25 p-3.5 text-xs text-amber-700 dark:text-amber-300">
              <p className="font-semibold mb-1">⚠️ Supabase não configurado</p>
              <p>Adicione as variáveis de ambiente na Vercel para ativar o login e o banco de dados.</p>
            </div>
          )}
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                <Mail className="h-3.5 w-3.5 text-primary" /> E-mail
              </Label>
              <Input 
                id="email" 
                type="email" 
                placeholder="nome@exemplo.com"
                required 
                value={email} 
                onChange={(e) => setEmail(e.target.value)} 
                className="h-11 bg-background/80"
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="password" className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                  <Lock className="h-3.5 w-3.5 text-primary" /> Senha
                </Label>
                <Link to="/recuperar-senha" className="text-xs text-primary hover:underline font-semibold">
                  Esqueceu?
                </Link>
              </div>
              <div className="relative">
                <Input 
                  id="password" 
                  type={showPassword ? "text" : "password"} 
                  placeholder="Sua senha secreta"
                  required 
                  value={password} 
                  onChange={(e) => setPassword(e.target.value)} 
                  className="h-11 bg-background/80 pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors p-1"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <Button type="submit" className="w-full h-11 font-bold rounded-xl shadow-sm hover:shadow transition-all mt-3 gap-2" disabled={loading}>
              {loading ? "Entrando..." : "Entrar na Plataforma"}
              {!loading && <ArrowRight className="h-4 w-4" />}
            </Button>

            <div className="text-center text-xs sm:text-sm text-muted-foreground mt-4 pt-3 border-t border-border/50">
              Ainda não tem uma conta?{" "}
              <Link to="/cadastro" className="text-primary font-bold hover:underline">
                Criar conta grátis
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}