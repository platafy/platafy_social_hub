import { HashRouter, Routes, Route, Link, useLocation } from "react-router-dom";
import Home from "./pages/Home";
import NotFound from "./pages/NotFound";
import Login from "./pages/Login";
import Cadastro from "./pages/Cadastro";
import RecuperarSenha from "./pages/RecuperarSenha";
import AuthError from "./pages/AuthError";
import { Toaster } from "@/components/ui/sonner";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { ProtectedRoute, GuestOnlyRoute } from "@/components/ProtectedRoute";
import { Button } from "@/components/ui/button";

function Layout({ children }: { children: React.ReactNode }) {
  const { session, signOut, user } = useAuth();
  const location = useLocation();
  const isLoginPage = location.pathname === "/login" || location.pathname === "/cadastro" || location.pathname === "/recuperar-senha" || location.pathname === "/auth-error";

  if (isLoginPage) return <>{children}</>;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-50 border-b border-border bg-background/95 supports-[backdrop-filter]:bg-background/60 backdrop-blur">
        <nav className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <Link to="/" className="text-xl font-extrabold tracking-tight flex items-center gap-2 hover:opacity-90 transition-opacity">
            <img src="/logo.png" alt="Zernio" className="h-6 w-6 object-contain" />
            <span className="text-primary font-black">zernio</span>
            <span className="text-xs bg-primary/15 text-primary font-bold px-1.5 py-0.5 rounded uppercase tracking-wider">hub</span>
          </Link>
          <div className="flex items-center gap-2">
            {!session && (
              <>
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
        <Toaster />
        <Layout>
          <Routes>
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <Home />
                </ProtectedRoute>
              }
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
      </AuthProvider>
    </HashRouter>
  );
}