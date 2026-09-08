import { createContext, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase, isSupabaseConfigured } from "@/integrations/supabase/client";
import { toast } from "sonner";

export type AppRole = "admin" | "member";

export const SUPER_ADMIN_EMAILS = ["suporte@platafy.com"];

interface AuthState {
  session: Session | null;
  user: User | null;
  tenantId: string | null;
  roles: AppRole[];
  loading: boolean;
  authError: boolean;
  isAdmin: boolean;
  isSuperAdmin: boolean;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthState | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState(false);

  async function loadTenantAndRoles() {
    try {
      const { data, error } = await supabase.functions.invoke("dados-usuario", {});
      if (!error && data) {
        setTenantId(data.tenant_id ?? null);
        setRoles((data.roles as AppRole[]) ?? []);
        return;
      }
    } catch (err) {
      console.warn("Edge Function failed, falling back to direct DB queries:", err);
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile, error: pError } = await supabase
        .from("profiles")
        .select("tenant_id")
        .eq("id", user.id)
        .maybeSingle();

      const { data: userRoles, error: rError } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id);

      if (pError) console.warn("Error fetching profile, using null:", pError);
      if (rError) console.warn("Error fetching roles, using empty:", rError);

      setTenantId(profile?.tenant_id ?? null);
      setRoles((userRoles?.map(r => r.role) as AppRole[]) ?? []);
    } catch (dbErr) {
      console.error("Error fetching context directly from DB:", dbErr);
    }
  }

  async function refresh() {
    const { data } = await supabase.auth.getSession();
    setSession(data.session);
    setUser(data.session?.user ?? null);
    if (data.session?.user) {
      await loadTenantAndRoles();
    } else {
      setTenantId(null);
      setRoles([]);
      setAuthError(false);
    }
  }

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setLoading(false);
      return;
    }

    const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      setUser(newSession?.user ?? null);
      if (newSession?.user) {
        loadTenantAndRoles();
      } else {
        setTenantId(null);
        setRoles([]);
        setAuthError(false);
      }
    });

    (async () => {
      await refresh();
      setLoading(false);
    })();

    return () => sub.subscription.unsubscribe();
  }, []);

  async function signOut() {
    try {
      await supabase.auth.signOut();
      toast.success("Voce saiu da conta.");
    } catch (err: any) {
      console.error("Erro ao fazer logout:", err);
    } finally {
      setSession(null);
      setUser(null);
      setTenantId(null);
      setRoles([]);
      setAuthError(false);
      window.location.hash = "/login";
    }
  }

  const isSuperAdmin = Boolean(
    user?.email && SUPER_ADMIN_EMAILS.includes(user.email.toLowerCase().trim())
  );

  return (
    <AuthContext.Provider
      value={{
        session,
        user,
        tenantId,
        roles,
        loading,
        authError,
        isAdmin: roles.includes("admin"),
        isSuperAdmin,
        signOut,
        refresh,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth deve ser usado dentro de <AuthProvider>");
  return ctx;
}