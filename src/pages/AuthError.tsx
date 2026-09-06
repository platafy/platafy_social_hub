import { LogOut, ShieldAlert, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";

export default function AuthError() {
  const { signOut } = useAuth();

  return (
    <div className="flex flex-col items-center justify-center min-h-[80vh] text-center px-4">
      <div className="bg-red-500/10 p-4 rounded-full mb-6">
        <ShieldAlert className="h-12 w-12 text-red-500" />
      </div>
      <h1 className="text-3xl font-bold tracking-tight mb-3">Falha na Autenticacao</h1>
      <p className="text-muted-foreground max-w-md mb-8 leading-relaxed">
        Nao foi possivel validar seu acesso. Isso ocorre devido a uma sessao expirada ou falta de permissoes (Erro 403).
      </p>
      <div className="flex flex-col sm:flex-row gap-3 w-full max-w-xs sm:max-w-md">
        <Button 
          onClick={() => window.location.href = "/"} 
          variant="default" 
          className="flex-1 gap-2"
        >
          <RefreshCw className="h-4 w-4" />
          Tentar Novamente
        </Button>
        <Button 
          onClick={signOut} 
          variant="outline" 
          className="flex-1 gap-2"
        >
          <LogOut className="h-4 w-4" />
          Sair da Conta
        </Button>
      </div>
      <p className="mt-8 text-[10px] uppercase tracking-widest text-muted-foreground/60 font-medium">
        Seguranca Multi-Tenant
      </p>
    </div>
  );
}