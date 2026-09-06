import { useState } from "react";
import { useNavigate, Link, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card";
import { toast } from "sonner";

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation() as { state?: { from?: string } };
  const { refresh } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
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
    <div className="min-h-[85vh] flex flex-col items-center justify-center bg-background/50 px-4 py-8">
      <div className="flex items-center gap-2 mb-6">
        <img src="/logo.png" alt="Zernio Logo" className="h-10 w-10 object-contain" />
        <span className="text-2xl font-black tracking-tight text-primary">zernio</span>
        <span className="text-xs bg-primary/15 text-primary font-bold px-1.5 py-0.5 rounded uppercase tracking-wider">hub</span>
      </div>
      <Card className="w-full max-w-[400px] border border-border/50 shadow-lg rounded-2xl bg-card/80 backdrop-blur-sm">
        <CardHeader className="space-y-2 pb-6 text-center">
          <h1 className="text-2xl font-bold tracking-tight leading-none text-foreground">Acesse sua conta</h1>
          <CardDescription className="text-muted-foreground text-sm">Entre com seu e-mail e senha para continuar</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">E-mail</Label>
              <Input 
                id="email" 
                type="email" 
                placeholder="nome@exemplo.com"
                required 
                value={email} 
                onChange={(e) => setEmail(e.target.value)} 
                className="h-11 bg-background/60 border-border/50 focus:border-primary focus:ring-1 focus:ring-primary/20 transition-all rounded-lg"
              />
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="password" className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Senha</Label>
                <Link to="/recuperar-senha" className="text-xs text-primary hover:underline font-medium">
                  Esqueceu a senha?
                </Link>
              </div>
              <Input 
                id="password" 
                type="password" 
                placeholder="Sua senha secreta"
                required 
                value={password} 
                onChange={(e) => setPassword(e.target.value)} 
                className="h-11 bg-background/60 border-border/50 focus:border-primary focus:ring-1 focus:ring-primary/20 transition-all rounded-lg"
              />
            </div>
            <Button type="submit" className="w-full h-11 font-semibold rounded-lg hover:shadow-md transition-all mt-2" disabled={loading}>
              {loading ? "Entrando..." : "Entrar"}
            </Button>
            <div className="text-center text-sm text-muted-foreground mt-4 pt-2 border-t border-border/40">
              Não tem uma conta?{" "}
              <Link to="/cadastro" className="text-primary font-semibold hover:underline">
                Criar conta
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}