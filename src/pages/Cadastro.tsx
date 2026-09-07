import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card";
import { BrandLogo } from "@/components/BrandLogo";
import { Sparkles, Eye, EyeOff, User, Building2, Mail, Lock, ArrowRight } from "lucide-react";
import { toast } from "sonner";

export default function Cadastro() {
  const navigate = useNavigate();
  const { refresh } = useAuth();
  const [fullName, setFullName] = useState("");
  const [tenantName, setTenantName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
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
    <div className="min-h-[85vh] flex flex-col items-center justify-center px-4 py-8 relative">
      {/* Background ambient decorative glow */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 bg-primary/10 rounded-full blur-3xl pointer-events-none -z-10" />

      <BrandLogo size="lg" className="mb-6" />

      <Card className="w-full max-w-[440px] border border-border/80 shadow-xl rounded-3xl bg-card/90 backdrop-blur-md">
        <CardHeader className="space-y-2 pb-5 text-center">
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-foreground">Crie sua conta</h1>
          <CardDescription className="text-muted-foreground text-xs sm:text-sm">
            Crie seu workspace e comece a gerenciar suas redes
          </CardDescription>
          <div className="inline-flex items-center justify-center gap-1.5 px-3.5 py-1 rounded-full bg-primary/10 text-primary text-xs font-bold mx-auto mt-2">
            <Sparkles className="h-3.5 w-3.5 animate-pulse" /> 7 dias de teste grátis incluídos
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-3.5">
            <div className="space-y-1.5">
              <Label htmlFor="fullName" className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                <User className="h-3.5 w-3.5 text-primary" /> Nome completo
              </Label>
              <Input 
                id="fullName" 
                placeholder="Seu nome"
                required 
                value={fullName} 
                onChange={(e) => setFullName(e.target.value)} 
                className="h-10 bg-background/80"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="tenantName" className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                <Building2 className="h-3.5 w-3.5 text-primary" /> Nome do workspace
              </Label>
              <Input 
                id="tenantName" 
                required 
                value={tenantName} 
                onChange={(e) => setTenantName(e.target.value)} 
                placeholder="Ex: Minha Agência ou Empresa" 
                className="h-10 bg-background/80"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                <Mail className="h-3.5 w-3.5 text-primary" /> E-mail profissional
              </Label>
              <Input 
                id="email" 
                type="email" 
                placeholder="nome@exemplo.com"
                required 
                value={email} 
                onChange={(e) => setEmail(e.target.value)} 
                className="h-10 bg-background/80"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                <Lock className="h-3.5 w-3.5 text-primary" /> Senha (mínimo 6 dígitos)
              </Label>
              <div className="relative">
                <Input 
                  id="password" 
                  type={showPassword ? "text" : "password"} 
                  placeholder="Crie uma senha forte"
                  required 
                  minLength={6} 
                  value={password} 
                  onChange={(e) => setPassword(e.target.value)} 
                  className="h-10 bg-background/80 pr-10"
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

            <Button type="submit" className="w-full h-11 font-bold rounded-xl shadow-sm hover:shadow transition-all mt-4 gap-2" disabled={loading}>
              {loading ? "Criando Workspace..." : "Começar Teste Grátis"}
              {!loading && <ArrowRight className="h-4 w-4" />}
            </Button>

            <div className="text-center text-xs sm:text-sm text-muted-foreground mt-4 pt-3 border-t border-border/50">
              Já possui uma conta?{" "}
              <Link to="/login" className="text-primary font-bold hover:underline">
                Fazer login
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}