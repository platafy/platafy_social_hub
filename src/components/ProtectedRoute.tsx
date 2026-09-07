import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useSubscription } from "@/contexts/SubscriptionContext";
import type { AppRole } from "@/contexts/AuthContext";

interface Props {
  children: ReactNode;
  requireRole?: AppRole | AppRole[];
  requireSubscription?: boolean;
}

export function ProtectedRoute({ children, requireRole, requireSubscription = false }: Props) {
  const { session, roles, loading, authError } = useAuth();
  const { subscription, loading: subLoading } = useSubscription();
  const location = useLocation();

  if (loading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-background">
        <div className="relative flex items-center justify-center">
          <div className="absolute h-20 w-20 rounded-full border-2 border-primary/20 border-t-primary animate-spin" />
          <img 
            src="/logo.png" 
            alt="Loading..." 
            className="h-12 w-12 object-contain animate-pulse" 
          />
        </div>
      </div>
    );
  }
  
  if (authError && location.pathname !== "/auth-error") {
    return <Navigate to="/auth-error" replace />;
  }

  if (!session) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  // Se a rota requer assinatura/trial ativo e o acesso expirou
  if (requireSubscription && !subLoading && subscription && !subscription.isAccessAllowed) {
    return <Navigate to="/planos" replace state={{ from: location.pathname }} />;
  }

  if (requireRole) {
    const required = Array.isArray(requireRole) ? requireRole : [requireRole];
    const ok = required.some((r) => roles.includes(r));
    if (!ok) return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}


export function GuestOnlyRoute({ children }: { children: ReactNode }) {
  const { session, loading } = useAuth();
  if (loading) return null;
  if (session) return <Navigate to="/" replace />;
  return <>{children}</>;
}