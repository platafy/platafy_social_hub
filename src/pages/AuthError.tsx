import { LogOut, ShieldAlert, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { BrandLogo } from "@/components/BrandLogo";

export default function AuthError() {
  const { signOut } = useAuth();

  return (
    <div className="flex flex-col items-center justify-center min-h-[80vh] text-center px-4 relative">
      {/* Ambient background glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-red-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="mb-6">
        <BrandLogo size="lg" />
      </div>

      <div className="p-8 rounded-3xl border border-border/70 bg-card/85 backdrop-blur-md shadow-xl max-w-md w-full relative z-10 space-y-6">
        <div className="inline-flex p-3.5 rounded-2xl bg-destructive/10 text-destructive border border-destructive/20">
          <ShieldAlert className="h-8 w-8" />
        </div>
        <div className="space-y-2">
          <h1 className="text-2xl font-black tracking-tight text-foreground">Falha na Autenticação</h1>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Não foi possível validar sua sessão de acesso. Isso pode acontecer devido à expiração do login ou falta de permissões suficientes.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 pt-2">
          <Button 
            onClick={() => window.location.href = "/"} 
            variant="default" 
            className="flex-1 gap-2 font-semibold shadow-xs"
          >
            <RefreshCw className="h-4 w-4" />
            Tentar Novamente
          </Button>
          <Button 
            onClick={signOut} 
            variant="outline" 
            className="flex-1 gap-2 font-medium"
          >
            <LogOut className="h-4 w-4" />
            Sair da Conta
          </Button>
        </div>

        <p className="pt-2 text-[11px] uppercase tracking-widest text-muted-foreground/60 font-semibold">
          Segurança Multi-Tenant Protegida
        </p>
      </div>
    </div>
  );
}