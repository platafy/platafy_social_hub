import { HashRouter, Routes, Route, Link, useLocation } from "react-router-dom";
import Home from "./pages/Home";
import NotFound from "./pages/NotFound";
import Login from "./pages/Login";
import Cadastro from "./pages/Cadastro";
import RecuperarSenha from "./pages/RecuperarSenha";
import AuthError from "./pages/AuthError";
import Planos from "./pages/Planos";
import { Toaster } from "@/components/ui/sonner";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { BrandingProvider } from "@/contexts/BrandingContext";
import { SubscriptionProvider } from "@/contexts/SubscriptionContext";
import { SubscriptionBanner } from "@/components/SubscriptionBanner";
import { BrandLogo } from "@/components/BrandLogo";
import { ProtectedRoute, GuestOnlyRoute } from "@/components/ProtectedRoute";
import { Button } from "@/components/ui/button";
import { isSupabaseConfigured } from "@/integrations/supabase/client";
import { Sparkles } from "lucide-react";

function SupabaseConfigAlert() {
  if (isSupabaseConfigured) return null;
  return (
    <div className="bg-amber-500/10 border-b border-amber-500/20 px-4 py-2.5 text-center text-xs sm:text-sm text-amber-600 dark:text-amber-400 font-medium">
      ⚠️ <strong>Supabase pendente:</strong> Configure <code className="bg-amber-500/15 px-1.5 py-0.5 rounded font-mono text-xs">VITE_SUPABASE_URL</code> e <code className="bg-amber-500/15 px-1.5 py-0.5 rounded font-mono text-xs">VITE_SUPABASE_PUBLISHABLE_KEY</code> na Vercel para ativar o login e o banco.
    </div>
  );
}

function Layout({ children }: { children: React.ReactNode }) {
  const { session, signOut, user } = useAuth();
  const location = useLocation();
  const isLoginPage = location.pathname === "/login" || location.pathname === "/cadastro" || location.pathname === "/recuperar-senha" || location.pathname === "/auth-error";

  if (isLoginPage) {
    return (
      <div className="min-h-screen bg-background text-foreground flex flex-col">
        <SupabaseConfigAlert />
        <div className="flex-1 flex items-center justify-center">
          {children}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <SupabaseConfigAlert />
      <SubscriptionBanner />
      <header className="sticky top-0 z-50 border-b border-border bg-background/95 supports-[backdrop-filter]:bg-background/60 backdrop-blur">

        <nav className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <Link to="/" className="hover:opacity-90 transition-opacity">
            <BrandLogo size="md" />
          </Link>
          <div className="flex items-center gap-2">
            {!session && (
              <>
                <Link to="/planos" className="px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
                  Planos
                </Link>
                <Link to="/login" className="px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
                  Entrar
                </Link>
                <Link to="/cadastro" className="px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
                  Cadastrar
                </Link>
              </>
            )}
            {session && (
              <>
                <Link 
                  to="/planos" 
                  className="mr-2 inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-primary/10 text-primary hover:bg-primary/15 transition-colors"
                >
                  <Sparkles className="h-3.5 w-3.5" /> Planos
                </Link>
                <span className="text-sm text-muted-foreground hidden sm:inline mr-2">
                  {user?.email}
                </span>
                <Button variant="outline" size="sm" onClick={signOut}>
                  Sair
                </Button>
              </>
            )}
          </div>
        </nav>
      </header>
      <main className="mx-auto max-w-7xl px-6 py-10">{children}</main>
    </div>
  );
}

export default function App() {
  return (
    <HashRouter>
      <AuthProvider>
        <BrandingProvider>
          <SubscriptionProvider>
            <Toaster />
            <Layout>
              <Routes>
                <Route
                  path="/"
                  element={
                    <ProtectedRoute requireSubscription={true}>
                      <Home />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/planos"
                  element={<Planos />}
                />
                <Route
                  path="/login"
                  element={
                    <GuestOnlyRoute>
                      <Login />
                    </GuestOnlyRoute>
                  }
                />
                <Route
                  path="/cadastro"
                  element={
                    <GuestOnlyRoute>
                      <Cadastro />
                    </GuestOnlyRoute>
                  }
                />
                <Route
                  path="/recuperar-senha"
                  element={
                    <GuestOnlyRoute>
                      <RecuperarSenha />
                    </GuestOnlyRoute>
                  }
                />
                <Route path="/auth-error" element={<AuthError />} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </Layout>
          </SubscriptionProvider>
        </BrandingProvider>
      </AuthProvider>
    </HashRouter>
  );
}