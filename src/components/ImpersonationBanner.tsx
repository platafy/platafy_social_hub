import { useState, useEffect, useCallback } from "react";
import { ShieldAlert, LogOut, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const PLATAFY_ADMIN_BACKUP_KEY = "platafy_impersonator_admin_session";
export const PLATAFY_IMPERSONATED_CLIENT_KEY = "platafy_impersonated_client_info";

export interface ImpersonatedClientInfo {
  email: string;
  fullName: string;
  companyName: string;
  tenantId?: string;
  startedAt: string;
}

export function getImpersonatedClient(): ImpersonatedClientInfo | null {
  try {
    const raw = sessionStorage.getItem(PLATAFY_IMPERSONATED_CLIENT_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export async function exitImpersonation() {
  const adminBackupStr = sessionStorage.getItem(PLATAFY_ADMIN_BACKUP_KEY);
  sessionStorage.removeItem(PLATAFY_IMPERSONATED_CLIENT_KEY);
  sessionStorage.removeItem(PLATAFY_ADMIN_BACKUP_KEY);

  // Disparar evento para atualizar a interface imediatamente
  window.dispatchEvent(new Event("platafy:impersonation-changed"));

  if (!adminBackupStr) {
    await supabase.auth.signOut();
    window.location.hash = "/login";
    return;
  }

  try {
    const adminBackup = JSON.parse(adminBackupStr);
    if (!adminBackup.access_token || !adminBackup.refresh_token) {
      throw new Error("Tokens do Super Admin inválidos no backup.");
    }

    // Restaurar sessão do Super Admin
    await supabase.auth.setSession({
      access_token: adminBackup.access_token,
      refresh_token: adminBackup.refresh_token,
    });

    toast.success("Sessão do Super Admin restaurada com sucesso!");
    window.location.hash = "/";
    window.location.reload();
  } catch (err: any) {
    console.error("Erro ao restaurar sessão do Super Admin:", err);
    toast.error("Não foi possível restaurar a sessão do Super Admin. Por favor, faça login novamente.");
    await supabase.auth.signOut();
    window.location.hash = "/login";
  }
}

export function ImpersonationBanner() {
  const [clientInfo, setClientInfo] = useState<ImpersonatedClientInfo | null>(getImpersonatedClient);
  const [exiting, setExiting] = useState(false);

  const checkImpersonation = useCallback(() => {
    setClientInfo(getImpersonatedClient());
  }, []);

  useEffect(() => {
    checkImpersonation();
    window.addEventListener("platafy:impersonation-changed", checkImpersonation);
    window.addEventListener("storage", checkImpersonation);

    return () => {
      window.removeEventListener("platafy:impersonation-changed", checkImpersonation);
      window.removeEventListener("storage", checkImpersonation);
    };
  }, [checkImpersonation]);

  if (!clientInfo) return null;

  const handleExit = async () => {
    setExiting(true);
    await exitImpersonation();
  };

  return (
    <aside
      aria-label="Barra de Modo Suporte do Super Admin"
      className="sticky top-0 z-[100] w-full bg-gradient-to-r from-amber-500 via-amber-600 to-orange-600 text-white shadow-lg border-b border-amber-400/40"
    >
      <div className="mx-auto max-w-7xl px-3 sm:px-6 lg:px-8 py-2.5 flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-7 h-7 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
            <ShieldAlert className="w-4 h-4 text-white animate-pulse" />
          </div>
          <div className="text-xs sm:text-sm font-medium min-w-0 leading-tight">
            <span className="font-extrabold uppercase tracking-wider text-[11px] bg-black/25 px-2 py-0.5 rounded-full mr-2">
              Modo Suporte
            </span>
            <span className="text-white/95">
              Visualizando conta de{" "}
              <strong className="text-white font-bold">
                {clientInfo.companyName || clientInfo.fullName || clientInfo.email}
              </strong>{" "}
              <span className="text-white/80 hidden md:inline">({clientInfo.email})</span>
            </span>
          </div>
        </div>

        <Button
          onClick={handleExit}
          disabled={exiting}
          size="sm"
          className="bg-slate-900 hover:bg-black text-white font-bold text-xs h-8 px-3.5 rounded-xl shadow-md border border-white/20 gap-1.5 cursor-pointer shrink-0 transition-transform active:scale-95"
        >
          {exiting ? (
            <>
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              <span>Saindo do suporte...</span>
            </>
          ) : (
            <>
              <LogOut className="w-3.5 h-3.5" />
              <span>Sair do Suporte e Voltar ao Admin</span>
            </>
          )}
        </Button>
      </div>
    </aside>
  );
}
