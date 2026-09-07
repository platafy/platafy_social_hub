import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card";
import { BrandLogo } from "@/components/BrandLogo";
import { Sparkles } from "lucide-react";
import { toast } from "sonner";

export default function Cadastro() {
  const navigate = useNavigate();
  const { refresh } = useAuth();
  const [fullName, setFullName] = useState("");
  const [tenantName, setTenantName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { data, error } = await supabase.functions.invoke("cadastro", {
      body: { email, password, full_name: fullName, tenant_name: tenantName },
    });
    if (error || data?.error) {
      setLoading(false);
      toast.error(data?.error ?? error?.message ?? "Erro ao cadastrar");
      return;
    }
    const { data: login } = await supabase.functions.invoke("login", { body: { email, password } });
    if (login?.session) {
      await supabase.auth.setSession({
        access_token: login.session.access_token,
        refresh_token: login.session.refresh_token,
      });
    }
    await refresh();
    setLoading(false);
    toast.success("Conta criada com sucesso!");
    navigate("/");
  }

  return (
    <div className="min-h-[85vh] flex flex-col items-center justify-center bg-background/50 px-4 py-8">
      <BrandLogo size="lg" className="mb-6" />
      <Card className="w-full max-w-[420px] border border-border/50 shadow-lg rounded-2xl bg-card/80 backdrop-blur-sm">
        <CardHeader className="space-y-2 pb-6 text-center">
          <h1 className="text-2xl font-bold tracking-tight leading-none text-foreground">Crie sua conta</h1>
          <CardDescription className="text-muted-foreground text-sm">Crie seu workspace de redes sociais em segundos</CardDescription>
          <div className="inline-flex items-center justify-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold mx-auto mt-2">
            <Sparkles className="h-3.5 w-3.5 animate-pulse" /> 7 dias de teste grátis incluídos
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="fullName" className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Nome completo</Label>
              <Input 
                id="fullName" 
                placeholder="Seu nome"
                required 
                value={fullName} 
                onChange={(e) => setFullName(e.target.value)} 
                className="h-11 bg-background/60 border-border/50 focus:border-primary focus:ring-1 focus:ring-primary/20 transition-all rounded-lg"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tenantName" className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Nome do workspace</Label>
              <Input 
                id="tenantName" 
                required 
                value={tenantName} 
                onChange={(e) => setTenantName(e.target.value)} 
                placeholder="Ex: Minha Empresa" 
                className="h-11 bg-background/60 border-border/50 focus:border-primary focus:ring-1 focus:ring-primary/20 transition-all rounded-lg"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Email</Label>
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
              <Label htmlFor="password" className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Senha</Label>
              <Input 
                id="password" 
                type="password" 
                placeholder="Mínimo 6 caracteres"
                required 
                minLength={6} 
                value={password} 
                onChange={(e) => setPassword(e.target.value)} 
                className="h-11 bg-background/60 border-border/50 focus:border-primary focus:ring-1 focus:ring-primary/20 transition-all rounded-lg"
              />
            </div>
            <Button type="submit" className="w-full h-11 font-semibold rounded-lg hover:shadow-md transition-all mt-2" disabled={loading}>
              {loading ? "Criando..." : "Cadastrar"}
            </Button>
            <div className="text-center text-sm text-muted-foreground mt-4 pt-2 border-t border-border/40">
              Já tem conta?{" "}
              <Link to="/login" className="text-primary font-semibold hover:underline">
                Entrar
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}