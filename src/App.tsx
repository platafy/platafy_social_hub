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
import { ThemeProvider } from "@/contexts/ThemeContext";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Button } from "@/components/ui/button";
import { isSupabaseConfigured } from "@/integrations/supabase/client";
import { Sparkles, LogOut } from "lucide-react";

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
      <div className="min-h-screen bg-background text-foreground flex flex-col relative">
        <div className="absolute top-4 right-4 z-50">
          <ThemeToggle />
        </div>
        <SupabaseConfigAlert />
        <div className="flex-1 flex items-center justify-center">
          {children}
        </div>
      </div>
    );
  }

  const userInitials = user?.email
    ? user.email.split("@")[0].slice(0, 2).toUpperCase()
    : "US";

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <SupabaseConfigAlert />
      <SubscriptionBanner />
      <header className="sticky top-0 z-50 border-b border-border/70 bg-background/80 backdrop-blur-md transition-all">
        <nav className="mx-auto flex max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8 py-3.5">
          <Link to="/" className="hover:opacity-90 transition-opacity flex items-center">
            <BrandLogo size="md" />
          </Link>

          <div className="flex items-center gap-2 sm:gap-3">
            {!session && (
              <>
                <Link
                  to="/planos"
                  className="px-3 py-1.5 text-xs sm:text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
                >
                  Planos
                </Link>
                <Link
                  to="/login"
                  className="px-3 py-1.5 text-xs sm:text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
                >
                  Entrar
                </Link>
                <Link to="/cadastro">
                  <Button size="sm" className="font-semibold shadow-xs">
                    Criar Conta
                  </Button>
                </Link>
              </>
            )}

            {session && (
              <>
                <Link 
                  to="/planos" 
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-all active:scale-95"
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Planos</span>
                </Link>

                <div className="flex items-center gap-2 px-2.5 py-1 rounded-full bg-secondary/50 border border-border/60">
                  <div className="w-6 h-6 rounded-full bg-primary/15 text-primary font-bold flex items-center justify-center text-[10px] shrink-0">
                    {userInitials}
                  </div>
                  <span className="text-xs font-medium text-foreground max-w-[150px] truncate hidden md:inline">
                    {user?.email}
                  </span>
                </div>

                <ThemeToggle />

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={signOut}
                  className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 gap-1.5 h-8 px-2.5 rounded-lg transition-colors"
                  title="Encerrar sessão"
                >
                  <LogOut className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline text-xs">Sair</span>
                </Button>
              </>
            )}

            {!session && (
              <ThemeToggle />
            )}
          </div>
        </nav>
      </header>
      <main className="flex-1 mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 py-6 sm:py-8">{children}</main>
    </div>
  );
}

export default function App() {
  return (
    <HashRouter>
      <ThemeProvider>
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
    </ThemeProvider>
  </HashRouter>
);
}