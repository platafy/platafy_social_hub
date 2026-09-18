import { useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { ArrowLeft, Compass } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LoadingScreen } from "@/components/LoadingScreen";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export default function NotFound() {
  const location = useLocation();
  const navigate = useNavigate();
  const { session } = useAuth();

  const hash = typeof window !== "undefined" ? window.location.hash : "";
  const search = typeof window !== "undefined" ? window.location.search : "";
  const pathname = location.pathname;

  const isOAuthCallback =
    hash.includes("access_token=") ||
    hash.includes("refresh_token=") ||
    pathname.includes("access_token=") ||
    pathname.includes("refresh_token=") ||
    search.includes("code=");

  const isRecovery =
    hash.includes("type=recovery") ||
    pathname.includes("type=recovery") ||
    search.includes("type=recovery");

  const isAuthError =
    hash.includes("error=") ||
    pathname.includes("error=") ||
    search.includes("error=");

  useEffect(() => {
    if (isRecovery) {
      window.location.hash = "/redefinir-senha";
      return;
    }

    if (isAuthError) {
      const rawParams = hash.includes("?")
        ? hash.substring(hash.indexOf("?"))
        : hash.startsWith("#")
        ? hash.substring(1)
        : search;
      const params = new URLSearchParams(rawParams);
      const errorMsg =
        params.get("error_description") ||
        params.get("error") ||
        "Falha na autenticação.";
      navigate(`/auth-error?error=${encodeURIComponent(errorMsg)}`, {
        replace: true,
      });
      return;
    }

    if (isOAuthCallback) {
      let isMounted = true;

      // 1. Se a sessão já estiver ativa
      if (session) {
        window.location.hash = "/";
        return;
      }

      // 2. Verificar imediatamente se a sessão já foi populada pelo Supabase
      supabase.auth.getSession().then(({ data }) => {
        if (data.session && isMounted) {
          window.location.hash = "/";
        }
      });

      // 3. Ouvir evento de autenticação do Supabase
      const { data: authListener } = supabase.auth.onAuthStateChange(
        (_event, newSession) => {
          if (newSession && isMounted) {
            window.location.hash = "/";
          }
        }
      );

      // 4. Fallback de segurança (limpa a hash para / se o cliente já consumiu os tokens)
      const timer = setTimeout(() => {
        if (isMounted) {
          window.location.hash = "/";
        }
      }, 1800);

      return () => {
        isMounted = false;
        authListener.subscription.unsubscribe();
        clearTimeout(timer);
      };
    }
  }, [isOAuthCallback, isRecovery, isAuthError, session, navigate, hash, search]);

  if (isOAuthCallback) {
    return (
      <LoadingScreen
        fullScreen={true}
        message="Finalizando login com o Google..."
      />
    );
  }

  if (isRecovery) {
    return (
      <LoadingScreen
        fullScreen={true}
        message="Redirecionando para redefinição de senha..."
      />
    );
  }

  if (isAuthError) {
    return (
      <LoadingScreen
        fullScreen={true}
        message="Processando retorno de autenticação..."
      />
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] text-center px-4">
      <div className="p-4 rounded-2xl bg-primary/10 border border-primary/20 text-primary mb-5">
        <Compass className="h-10 w-10 animate-spin [animation-duration:12s]" />
      </div>
      <h1 className="text-5xl sm:text-6xl font-black tracking-tight text-foreground mb-2">404</h1>
      <h2 className="text-xl font-bold text-foreground mb-2">Página não encontrada</h2>
      <p className="text-sm text-muted-foreground max-w-sm mb-6">
        O link que você tentou acessar não existe ou foi movido para outro endereço.
      </p>
      <Link to="/">
        <Button className="gap-2 font-semibold shadow-xs">
          <ArrowLeft className="h-4 w-4" /> Voltar ao Painel
        </Button>
      </Link>
    </div>
  );
}