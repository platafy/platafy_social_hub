import { useState, useEffect, useMemo, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ConfirmModal } from "@/components/ui/confirm-modal";
import {
  Users, UserPlus, Search, RefreshCw, ShieldCheck,
  CreditCard, Clock, CheckCircle2, AlertCircle,
  Edit3, ArrowUpRight, Ban, Play, Trash2,
  Phone, Mail, Building, Key, Eye, X,
  ChevronLeft, ChevronRight
} from "lucide-react";

export interface PlanItem {
  id: string;
  name: string;
  slug: string;
  description: string;
  price: number;
  currency: string;
  features: string[];
  limits: Record<string, any>;
}

export interface ClientRecord {
  userId: string;
  tenantId: string;
  email: string;
  fullName: string;
  phone?: string | null;
  companyName: string;
  createdAt: string;
  activeProfilesCount?: number;
  maxProfiles?: number;
  channelsCount?: number;
  clientProfiles?: Array<{
    id: string;
    name: string;
    account_name?: string;
    profileId?: string;
    channelsCount: number;
  }>;
  subscription?: {
    id: string;
    planId?: string | null;
    plan?: PlanItem | null;
    status: "trialing" | "active" | "past_due" | "canceled" | "suspended" | "none";
    billingType: "mercadopago" | "manual";
    paymentMethod?: string | null;
    notes?: string | null;
    trialEndsAt?: string | null;
    currentPeriodStart?: string | null;
    currentPeriodEnd?: string | null;
    lastPaymentDate?: string | null;
    mercadopagoPreapprovalId?: string | null;
    mercadopagoPaymentId?: string | null;
  } | null;
}

export function SuperAdminClients() {
  const { isSuperAdmin } = useAuth();
  if (!isSuperAdmin) return null;

  // Estado geral de dados
  const [clients, setClients] = useState<ClientRecord[]>([]);
  const [plans, setPlans] = useState<PlanItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Filtros e busca
  const [searchTerm, setSearchTerm] = useState("");
  const [filterPlan, setFilterPlan] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterBilling, setFilterBilling] = useState<string>("all");
  const [sortBy, setSortBy] = useState<"recent" | "expiry" | "name">("recent");

  // Paginação
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Modais
  const [isNewClientOpen, setIsNewClientOpen] = useState(false);
  const [isChangePlanOpen, setIsChangePlanOpen] = useState(false);
  const [isRenewOpen, setIsRenewOpen] = useState(false);
  const [isSuspendModalOpen, setIsSuspendModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deletingClient, setDeletingClient] = useState(false);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);

  // Cliente selecionado para ação
  const [selectedClient, setSelectedClient] = useState<ClientRecord | null>(null);

  // Formulário: Novo Cliente
  const [newClientForm, setNewClientForm] = useState({
    fullName: "",
    email: "",
    password: "",
    companyName: "",
    phone: "",
    planId: "",
    billingType: "manual" as "manual" | "mercadopago",
    paymentMethod: "manual",
    status: "active" as "active" | "trialing",
    periodDays: "30",
    customEndDate: "",
    notes: "",
  });
  const [creatingClient, setCreatingClient] = useState(false);

  // Formulário: Alterar Plano
  const [newPlanId, setNewPlanId] = useState("");
  const [changePlanReason, setChangePlanReason] = useState("");
  const [updatingPlan, setUpdatingPlan] = useState(false);

  // Formulário: Renovar Licença
  const [renewDays, setRenewDays] = useState("30");
  const [renewCustomDate, setRenewCustomDate] = useState("");
  const [renewPaymentMethod, setRenewPaymentMethod] = useState("pix");
  const [renewNotes, setRenewNotes] = useState("");
  const [renewing, setRenewing] = useState(false);

  // Formulário: Detalhes do Cliente
  const [detailsTab, setDetailsTab] = useState<"overview" | "payments" | "audit">("overview");
  const [paymentHistory, setPaymentHistory] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [loadingDetailsData, setLoadingDetailsData] = useState(false);
  const [clientNotesInput, setClientNotesInput] = useState("");
  const [savingNotes, setSavingNotes] = useState(false);

  // 1. Carregar todos os dados
  const loadData = useCallback(async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    else setRefreshing(true);

    try {
      // Buscar planos
      const { data: plansData } = await (supabase.from("plans" as any) as any)
        .select("*")
        .order("price", { ascending: true });

      if (plansData) {
        setPlans(plansData as PlanItem[]);
      }

      // Buscar perfis com tenants
      const { data: profilesData, error: profError } = await (supabase.from("profiles" as any) as any)
        .select("id, email, full_name, phone, tenant_id, created_at, tenant:tenants(id, name, created_at)")
        .order("created_at", { ascending: false });

      if (profError) throw profError;

      // Buscar assinaturas
      const { data: subsData, error: subsError } = await (supabase.from("subscriptions" as any) as any)
        .select("*, plan:plans(*)");

      if (subsError) throw subsError;

      // Buscar integrações e canais Zernio
      const { data: integrationsData } = await (supabase.from("zernio_integrations" as any) as any)
        .select("id, tenant_id, name, account_name, zernio_profile_id");

      const { data: channelsData } = await (supabase.from("zernio_integration_channels" as any) as any)
        .select("id, tenant_id, integration_id, platform, name, username");

      // Mapear assinaturas por tenant_id
      const subsMap = new Map<string, any>();
      (subsData || []).forEach((s: any) => {
        subsMap.set(s.tenant_id, s);
      });

      // Montar lista de clientes
      const combined: ClientRecord[] = (profilesData || []).map((p: any) => {
        const sub = subsMap.get(p.tenant_id);
        const clientInteg = (integrationsData || []).filter((i: any) => i.tenant_id === p.tenant_id);
        const clientChans = (channelsData || []).filter((c: any) => c.tenant_id === p.tenant_id);

        const planLimits = sub?.plan?.limits || {};
        const maxProfiles = planLimits.max_profiles !== undefined
          ? planLimits.max_profiles
          : (planLimits.max_channels === -1 ? -1 : Math.max(1, Math.ceil((planLimits.max_channels || 2) / 2)));

        const activeProfilesCount = clientInteg.length;
        const channelsCount = clientChans.length;

        const clientProfiles = clientInteg.map((integ: any) => {
          const chanCount = clientChans.filter((c: any) => c.integration_id === integ.id).length;
          return {
            id: integ.id,
            name: integ.name || integ.account_name || 'Perfil Principal',
            account_name: integ.account_name,
            profileId: integ.zernio_profile_id,
            channelsCount: chanCount,
          };
        });

        return {
          userId: p.id,
          tenantId: p.tenant_id,
          email: p.email,
          fullName: p.full_name || p.email.split("@")[0],
          phone: p.phone,
          companyName: p.tenant?.name || "Sem nome",
          createdAt: p.created_at,
          activeProfilesCount,
          maxProfiles,
          channelsCount,
          clientProfiles,
          subscription: sub ? {
            id: sub.id,
            planId: sub.plan_id,
            plan: sub.plan,
            status: sub.status,
            billingType: sub.billing_type || "mercadopago",
            paymentMethod: sub.payment_method,
            notes: sub.notes,
            trialEndsAt: sub.trial_ends_at,
            currentPeriodStart: sub.current_period_start,
            currentPeriodEnd: sub.current_period_end,
            lastPaymentDate: sub.last_payment_date,
            mercadopagoPreapprovalId: sub.mercadopago_preapproval_id,
            mercadopagoPaymentId: sub.mercadopago_payment_id,
          } : null,
        };
      });

      setClients(combined);
    } catch (err: any) {
      console.error("Erro ao carregar clientes do SaaS:", err);
      toast.error("Erro ao carregar lista de clientes: " + (err.message || "Erro desconhecido"));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Gerador de senha forte
  const generateRandomPassword = () => {
    const chars = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789!@#$%&*";
    let pwd = "";
    for (let i = 0; i < 10; i++) {
      pwd += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setNewClientForm(prev => ({ ...prev, password: pwd }));
    navigator.clipboard.writeText(pwd);
    toast.success("Senha gerada e copiada: " + pwd);
  };

  // KPIs
  const stats = useMemo(() => {
    const now = new Date();
    let total = clients.length;
    let active = 0;
    let trialing = 0;
    let manual = 0;
    let suspendedOrExpired = 0;

    clients.forEach(c => {
      const sub = c.subscription;
      if (!sub) {
        suspendedOrExpired++;
        return;
      }
      if (sub.status === "suspended") {
        suspendedOrExpired++;
      } else if (sub.status === "active") {
        if (!sub.currentPeriodEnd || new Date(sub.currentPeriodEnd) > now) {
          active++;
        } else {
          suspendedOrExpired++;
        }
      } else if (sub.status === "trialing") {
        if (sub.trialEndsAt && new Date(sub.trialEndsAt) > now) {
          trialing++;
        } else {
          suspendedOrExpired++;
        }
      } else {
        suspendedOrExpired++;
      }

      if (sub.billingType === "manual") {
        manual++;
      }
    });

    return { total, active, trialing, manual, suspendedOrExpired };
  }, [clients]);

  // Filtragem e Ordenação
  const filteredClients = useMemo(() => {
    const now = new Date();
    return clients.filter(c => {
      if (searchTerm) {
        const query = searchTerm.toLowerCase();
        const matchName = c.fullName.toLowerCase().includes(query);
        const matchEmail = c.email.toLowerCase().includes(query);
        const matchCompany = c.companyName.toLowerCase().includes(query);
        const matchPhone = c.phone?.toLowerCase().includes(query);
        if (!matchName && !matchEmail && !matchCompany && !matchPhone) return false;
      }

      if (filterPlan !== "all") {
        if (c.subscription?.plan?.slug !== filterPlan) return false;
      }

      if (filterBilling !== "all") {
        if (c.subscription?.billingType !== filterBilling) return false;
      }

      if (filterStatus !== "all") {
        const sub = c.subscription;
        if (!sub) return filterStatus === "expired";

        if (filterStatus === "active") {
          const isReallyActive = sub.status === "active" && (!sub.currentPeriodEnd || new Date(sub.currentPeriodEnd) > now);
          if (!isReallyActive) return false;
        } else if (filterStatus === "trialing") {
          const isReallyTrial = sub.status === "trialing" && (sub.trialEndsAt && new Date(sub.trialEndsAt) > now);
          if (!isReallyTrial) return false;
        } else if (filterStatus === "suspended") {
          if (sub.status !== "suspended") return false;
        } else if (filterStatus === "expired") {
          const isExpired = sub.status === "past_due" || sub.status === "canceled" ||
            (sub.status === "active" && sub.currentPeriodEnd && new Date(sub.currentPeriodEnd) <= now) ||
            (sub.status === "trialing" && sub.trialEndsAt && new Date(sub.trialEndsAt) <= now);
          if (!isExpired) return false;
        }
      }

      return true;
    }).sort((a, b) => {
      if (sortBy === "name") {
        return a.fullName.localeCompare(b.fullName);
      }
      if (sortBy === "expiry") {
        const dateA = a.subscription?.currentPeriodEnd || a.subscription?.trialEndsAt || "9999-12-31";
        const dateB = b.subscription?.currentPeriodEnd || b.subscription?.trialEndsAt || "9999-12-31";
        return new Date(dateA).getTime() - new Date(dateB).getTime();
      }
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }, [clients, searchTerm, filterPlan, filterStatus, filterBilling, sortBy]);

  // Paginação
  const totalPages = Math.ceil(filteredClients.length / itemsPerPage) || 1;
  const paginatedClients = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredClients.slice(start, start + itemsPerPage);
  }, [filteredClients, currentPage]);

  // Helper para formatar data
  const formatDate = (dateStr?: string | null) => {
    if (!dateStr) return "-";
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      });
    } catch {
      return dateStr;
    }
  };

  // Helper de badge de status (Light & Dark Mode)
  const renderStatusBadge = (client: ClientRecord) => {
    const sub = client.subscription;
    const now = new Date();

    if (!sub) {
      return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-stone-100 dark:bg-stone-800/60 text-stone-600 dark:text-stone-300 border border-stone-200 dark:border-stone-700">Sem Licença</span>;
    }

    if (sub.status === "suspended") {
      return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-900/50"><Ban className="w-3 h-3" /> Suspenso</span>;
    }

    if (sub.status === "active") {
      if (sub.currentPeriodEnd && new Date(sub.currentPeriodEnd) <= now) {
        return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-900/50"><AlertCircle className="w-3 h-3" /> Vencido</span>;
      }
      let daysText = "";
      if (sub.currentPeriodEnd) {
        const diff = Math.ceil((new Date(sub.currentPeriodEnd).getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        daysText = ` (${diff}d)`;
      }
      return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900/50"><CheckCircle2 className="w-3 h-3" /> Ativo{daysText}</span>;
    }

    if (sub.status === "trialing") {
      if (sub.trialEndsAt && new Date(sub.trialEndsAt) <= now) {
        return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-900/50"><Clock className="w-3 h-3" /> Trial Expirado</span>;
      }
      let daysText = "";
      if (sub.trialEndsAt) {
        const diff = Math.ceil((new Date(sub.trialEndsAt).getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        daysText = ` (${diff}d)`;
      }
      return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-900/50"><Clock className="w-3 h-3" /> Teste{daysText}</span>;
    }

    return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-stone-100 dark:bg-stone-800/60 text-stone-600 dark:text-stone-300 border border-stone-200 dark:border-stone-700">{sub.status}</span>;
  };

  // Helper de badge de plano (Light & Dark Mode)
  const renderPlanBadge = (slug?: string, name?: string) => {
    if (!name) return <span className="text-muted-foreground text-xs">-</span>;
    if (slug === "agency") {
      return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-50 dark:bg-purple-950/50 text-purple-700 dark:text-purple-400 border border-purple-200 dark:border-purple-900/50">Agência</span>;
    }
    if (slug === "pro") {
      return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-900/50">Pro</span>;
    }
    return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-stone-100 dark:bg-stone-800/60 text-stone-700 dark:text-stone-300 border border-stone-200 dark:border-stone-700">Starter</span>;
  };

  // 2. Ação: Cadastrar Novo Cliente
  const handleCreateClient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newClientForm.email || !newClientForm.password) {
      toast.error("E-mail e senha são obrigatórios.");
      return;
    }
    if (newClientForm.password.length < 6) {
      toast.error("A senha deve ter no mínimo 6 caracteres.");
      return;
    }

    setCreatingClient(true);
    try {
      const now = new Date();
      let endDateIso = "";
      if (newClientForm.customEndDate) {
        endDateIso = new Date(newClientForm.customEndDate).toISOString();
      } else {
        const days = parseInt(newClientForm.periodDays) || 30;
        endDateIso = new Date(now.getTime() + days * 24 * 60 * 60 * 1000).toISOString();
      }

      const { data, error } = await supabase.functions.invoke("admin-clients", {
        body: {
          action: "create-client",
          email: newClientForm.email.trim(),
          password: newClientForm.password,
          full_name: newClientForm.fullName.trim(),
          tenant_name: newClientForm.companyName.trim() || undefined,
          phone: newClientForm.phone.trim() || undefined,
          plan_id: newClientForm.planId || undefined,
          billing_type: newClientForm.billingType,
          payment_method: newClientForm.paymentMethod,
          status: newClientForm.status,
          start_date: now.toISOString(),
          end_date: endDateIso,
          notes: newClientForm.notes,
        },
      });

      if (error) throw new Error(error.message || "Erro na Edge Function");
      if (data?.error) throw new Error(data.error);

      toast.success("Cliente cadastrado com sucesso!");
      setIsNewClientOpen(false);
      setNewClientForm({
        fullName: "",
        email: "",
        password: "",
        companyName: "",
        phone: "",
        planId: "",
        billingType: "manual",
        paymentMethod: "manual",
        status: "active",
        periodDays: "30",
        customEndDate: "",
        notes: "",
      });
      loadData(true);
    } catch (err: any) {
      console.error("Erro ao cadastrar cliente:", err);
      toast.error("Falha ao criar cliente: " + err.message);
    } finally {
      setCreatingClient(false);
    }
  };

  // 3. Ação: Alterar Plano
  const openChangePlan = (client: ClientRecord) => {
    setSelectedClient(client);
    setNewPlanId(client.subscription?.planId || "");
    setChangePlanReason("");
    setIsChangePlanOpen(true);
  };

  const handleUpdatePlan = async () => {
    if (!selectedClient || !newPlanId) return;

    setUpdatingPlan(true);
    try {
      const { data, error } = await supabase.functions.invoke("admin-clients", {
        body: {
          action: "update-plan",
          tenant_id: selectedClient.tenantId,
          plan_id: newPlanId,
          reason: changePlanReason.trim() || "Alteração manual pelo Super Admin",
        },
      });

      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);

      toast.success("Plano atualizado com sucesso!");
      setIsChangePlanOpen(false);
      loadData(true);
    } catch (err: any) {
      console.error("Erro ao alterar plano:", err);
      toast.error("Falha ao atualizar plano: " + err.message);
    } finally {
      setUpdatingPlan(false);
    }
  };

  // 4. Ação: Renovar Licença
  const openRenew = (client: ClientRecord) => {
    setSelectedClient(client);
    setRenewDays("30");
    setRenewCustomDate("");
    setRenewPaymentMethod(client.subscription?.paymentMethod || "pix");
    setRenewNotes("");
    setIsRenewOpen(true);
  };

  const handleRenewLicense = async () => {
    if (!selectedClient) return;

    setRenewing(true);
    try {
      const payload: any = {
        action: "update-license",
        tenant_id: selectedClient.tenantId,
        status: "active",
        payment_method: renewPaymentMethod,
        billing_type: "manual",
        notes: renewNotes ? `${selectedClient.subscription?.notes ? selectedClient.subscription.notes + "\n" : ""}[${new Date().toLocaleDateString("pt-BR")}] Renovação: ${renewNotes}` : undefined,
        reason: "Renovação manual de licença",
      };

      if (renewCustomDate) {
        payload.current_period_end = new Date(renewCustomDate).toISOString();
      } else {
        payload.extend_days = parseInt(renewDays) || 30;
      }

      const { data, error } = await supabase.functions.invoke("admin-clients", {
        body: payload,
      });

      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);

      toast.success("Licença renovada com sucesso!");
      setIsRenewOpen(false);
      loadData(true);
    } catch (err: any) {
      console.error("Erro ao renovar licença:", err);
      toast.error("Falha ao renovar licença: " + err.message);
    } finally {
      setRenewing(false);
    }
  };

  // 5. Ação: Suspender / Reativar
  const handleToggleSuspend = async () => {
    if (!selectedClient) return;

    const isCurrentlySuspended = selectedClient.subscription?.status === "suspended";
    const nextStatus = isCurrentlySuspended ? "active" : "suspended";

    try {
      const { data, error } = await supabase.functions.invoke("admin-clients", {
        body: {
          action: "update-license",
          tenant_id: selectedClient.tenantId,
          status: nextStatus,
          reason: isCurrentlySuspended ? "Reativação pelo Super Admin" : "Suspensão administrativa de acesso",
        },
      });

      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);

      toast.success(isCurrentlySuspended ? "Acesso reativado com sucesso!" : "Cliente suspenso com sucesso!");
      setIsSuspendModalOpen(false);
      loadData(true);
    } catch (err: any) {
      console.error("Erro ao alterar suspensão:", err);
      toast.error("Falha ao alterar status da licença: " + err.message);
    }
  };

  // 6. Ação: Excluir Cliente
  const handleDeleteClient = async () => {
    if (!selectedClient) return;

    if (selectedClient.email?.toLowerCase().trim() === "suporte@platafy.com") {
      toast.error("Não é permitido excluir a conta principal do Super Admin.");
      setIsDeleteModalOpen(false);
      return;
    }

    setDeletingClient(true);
    try {
      const { data, error } = await supabase.functions.invoke("admin-clients", {
        body: {
          action: "delete-client",
          user_id: selectedClient.userId,
          tenant_id: selectedClient.tenantId,
          email: selectedClient.email,
          reason: "Exclusão manual definitiva pelo Super Admin",
        },
      });

      if (error) throw new Error(error.message || "Erro de conexão com o servidor");
      if (data?.error) throw new Error(data.error);

      toast.success(`Cliente ${selectedClient.fullName || selectedClient.email} foi excluído permanentemente.`);
      setIsDeleteModalOpen(false);
      setSelectedClient(null);
      await loadData(true);
    } catch (err: any) {
      console.error("Erro ao excluir cliente:", err);
      toast.error("Falha ao excluir cliente: " + err.message);
    } finally {
      setDeletingClient(false);
    }
  };

  // 7. Ação: Abrir Detalhes do Cliente
  const openClientDetails = async (client: ClientRecord) => {
    setSelectedClient(client);
    setClientNotesInput(client.subscription?.notes || "");
    setDetailsTab("overview");
    setIsDetailsOpen(true);
    setLoadingDetailsData(true);

    try {
      const { data: payments } = await (supabase.from("payment_history" as any) as any)
        .select("*, plan:plans(name)")
        .eq("tenant_id", client.tenantId)
        .order("created_at", { ascending: false });

      setPaymentHistory(payments || []);

      const { data: logs } = await (supabase.from("admin_audit_logs" as any) as any)
        .select("*")
        .eq("target_tenant_id", client.tenantId)
        .order("created_at", { ascending: false });

      setAuditLogs(logs || []);
    } catch (err) {
      console.error("Erro ao carregar histórico detalhado:", err);
    } finally {
      setLoadingDetailsData(false);
    }
  };

  // Salvar notas administrativas
  const handleSaveNotes = async () => {
    if (!selectedClient) return;
    setSavingNotes(true);
    try {
      const { data, error } = await supabase.functions.invoke("admin-clients", {
        body: {
          action: "update-license",
          tenant_id: selectedClient.tenantId,
          notes: clientNotesInput,
          reason: "Atualização de observações administrativas",
        },
      });

      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);

      toast.success("Observações salvas!");
      loadData(true);
    } catch (err: any) {
      toast.error("Falha ao salvar observações: " + err.message);
    } finally {
      setSavingNotes(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in text-foreground">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/80 pb-5">
        <div>
          <div className="flex items-center gap-2.5 mb-1.5">
            <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
              <Users className="w-6 h-6 text-primary" />
              Gestão de Clientes & Licenças
            </h1>
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-primary/10 text-primary border border-primary/25">
              <ShieldCheck className="w-3.5 h-3.5" /> Super Admin
            </span>
          </div>
          <p className="text-sm text-muted-foreground">
            Painel centralizado para visualização, cadastro manual, alteração de planos e controle de licenças do SaaS.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            variant="outline"
            size="sm"
            onClick={() => loadData(true)}
            disabled={refreshing || loading}
            className="border-border bg-card hover:bg-muted text-foreground"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? "animate-spin text-primary" : ""}`} />
            Atualizar
          </Button>

          <Button
            size="sm"
            onClick={() => {
              if (plans.length > 0 && !newClientForm.planId) {
                const pro = plans.find(p => p.slug === "pro") || plans[0];
                setNewClientForm(prev => ({ ...prev, planId: pro.id }));
              }
              setIsNewClientOpen(true);
            }}
            className="bg-primary hover:bg-primary/90 text-primary-foreground font-medium shadow-sm shadow-primary/20"
          >
            <UserPlus className="w-4 h-4 mr-2" />
            Novo Cliente
          </Button>
        </div>
      </div>

      {/* KPI Cards (Light & Dark Mode) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
        <Card className="bg-card border-border shadow-xs hover:border-primary/40 transition-colors">
          <CardHeader className="p-4 pb-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">Total de Clientes</span>
              <div className="p-1.5 rounded-lg bg-stone-100 dark:bg-stone-800/60 text-stone-600 dark:text-stone-300">
                <Users className="w-4 h-4" />
              </div>
            </div>
            <CardTitle className="text-2xl font-bold text-foreground mt-1">{stats.total}</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <p className="text-xs text-muted-foreground">Cadastrados no sistema</p>
          </CardContent>
        </Card>

        <Card className="bg-card border-border shadow-xs hover:border-emerald-300 dark:hover:border-emerald-700 transition-colors">
          <CardHeader className="p-4 pb-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-emerald-700 dark:text-emerald-400">Ativos</span>
              <div className="p-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="w-4 h-4" />
              </div>
            </div>
            <CardTitle className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">{stats.active}</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <p className="text-xs text-muted-foreground">Com licença em dia</p>
          </CardContent>
        </Card>

        <Card className="bg-card border-border shadow-xs hover:border-amber-300 dark:hover:border-amber-700 transition-colors">
          <CardHeader className="p-4 pb-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-amber-700 dark:text-amber-400">Em Teste (Trial)</span>
              <div className="p-1.5 rounded-lg bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400">
                <Clock className="w-4 h-4" />
              </div>
            </div>
            <CardTitle className="text-2xl font-bold text-amber-600 dark:text-amber-400 mt-1">{stats.trialing}</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <p className="text-xs text-muted-foreground">Período de avaliação</p>
          </CardContent>
        </Card>

        <Card className="bg-card border-border shadow-xs hover:border-blue-300 dark:hover:border-blue-700 transition-colors">
          <CardHeader className="p-4 pb-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-blue-700 dark:text-blue-400">Licença Manual</span>
              <div className="p-1.5 rounded-lg bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400">
                <Key className="w-4 h-4" />
              </div>
            </div>
            <CardTitle className="text-2xl font-bold text-blue-600 dark:text-blue-400 mt-1">{stats.manual}</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <p className="text-xs text-muted-foreground">Pagamento direto/manual</p>
          </CardContent>
        </Card>

        <Card className="bg-card border-border shadow-xs hover:border-rose-300 dark:hover:border-rose-700 transition-colors">
          <CardHeader className="p-4 pb-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-rose-700 dark:text-rose-400">Suspensos / Vencidos</span>
              <div className="p-1.5 rounded-lg bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400">
                <AlertCircle className="w-4 h-4" />
              </div>
            </div>
            <CardTitle className="text-2xl font-bold text-rose-600 dark:text-rose-400 mt-1">{stats.suspendedOrExpired}</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <p className="text-xs text-muted-foreground">Requer atenção</p>
          </CardContent>
        </Card>
      </div>

      {/* Filter and Search Bar */}
      <Card className="bg-card border-border p-4 shadow-xs">
        <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Buscar por nome, e-mail, empresa ou telefone..."
              value={searchTerm}
              onChange={e => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              className="pl-9 bg-background border-border text-foreground text-sm focus-visible:ring-primary/40"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Filtro por Plano */}
            <select
              value={filterPlan}
              onChange={e => {
                setFilterPlan(e.target.value);
                setCurrentPage(1);
              }}
              className="bg-background border border-border rounded-lg px-3 py-2 text-xs font-medium text-foreground focus:outline-none focus:border-primary shadow-xs"
            >
              <option value="all">Todos os Planos</option>
              <option value="starter">Starter</option>
              <option value="pro">Pro</option>
              <option value="agency">Agência</option>
            </select>

            {/* Filtro por Status */}
            <select
              value={filterStatus}
              onChange={e => {
                setFilterStatus(e.target.value);
                setCurrentPage(1);
              }}
              className="bg-background border border-border rounded-lg px-3 py-2 text-xs font-medium text-foreground focus:outline-none focus:border-primary shadow-xs"
            >
              <option value="all">Todos os Status</option>
              <option value="active">Ativo</option>
              <option value="trialing">Em Teste</option>
              <option value="expired">Vencido / Expirado</option>
              <option value="suspended">Suspenso</option>
            </select>

            {/* Filtro por Cobrança */}
            <select
              value={filterBilling}
              onChange={e => {
                setFilterBilling(e.target.value);
                setCurrentPage(1);
              }}
              className="bg-background border border-border rounded-lg px-3 py-2 text-xs font-medium text-foreground focus:outline-none focus:border-primary shadow-xs"
            >
              <option value="all">Todas as Cobranças</option>
              <option value="manual">Manual / Direto</option>
              <option value="mercadopago">Mercado Pago</option>
            </select>

            {/* Ordenação */}
            <select
              value={sortBy}
              onChange={e => setSortBy(e.target.value as any)}
              className="bg-background border border-border rounded-lg px-3 py-2 text-xs font-medium text-foreground focus:outline-none focus:border-primary shadow-xs"
            >
              <option value="recent">Mais Recentes</option>
              <option value="expiry">Vencimento Próximo</option>
              <option value="name">Nome (A-Z)</option>
            </select>
          </div>
        </div>
      </Card>

      {/* Main Table (Light Mode) */}
      <Card className="bg-card border-border overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-foreground">
            <thead className="bg-muted/50 border-b border-border text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              <tr>
                <th className="py-3.5 px-4">Cliente</th>
                <th className="py-3.5 px-4">Empresa / Workspace</th>
                <th className="py-3.5 px-4">Plano</th>
                <th className="py-3.5 px-4">Cobrança</th>
                <th className="py-3.5 px-4">Situação</th>
                <th className="py-3.5 px-4">Vencimento</th>
                <th className="py-3.5 px-4">Último Pgto</th>
                <th className="py-3.5 px-4 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-muted-foreground">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto text-primary mb-2" />
                    Carregando base de clientes do SaaS...
                  </td>
                </tr>
              ) : paginatedClients.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-muted-foreground">
                    <Users className="w-8 h-8 mx-auto text-muted-foreground/50 mb-2" />
                    Nenhum cliente encontrado com os filtros atuais.
                  </td>
                </tr>
              ) : (
                paginatedClients.map((client) => {
                  const sub = client.subscription;
                  const isSuspended = sub?.status === "suspended";
                  const isSuperAdminClient = client.email?.toLowerCase().trim() === "suporte@platafy.com";

                  return (
                    <tr
                      key={client.userId}
                      className="hover:bg-muted/30 transition-colors group"
                    >
                      {/* Cliente */}
                      <td className="py-3.5 px-4">
                        <div className="flex flex-col">
                          <span className="font-semibold text-foreground flex items-center gap-1.5">
                            {client.fullName}
                            {client.email === "suporte@platafy.com" && (
                              <span className="px-1.5 py-0.2 rounded text-[10px] bg-primary/10 text-primary border border-primary/20 font-medium">
                                Você
                              </span>
                            )}
                          </span>
                          <span className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                            <Mail className="w-3 h-3 text-muted-foreground/70" />
                            {client.email}
                          </span>
                          {client.phone && (
                            <a
                              href={`https://wa.me/${client.phone.replace(/\D/g, "")}`}
                              target="_blank"
                              rel="noreferrer"
                              className="text-xs text-emerald-600 hover:text-emerald-700 font-medium flex items-center gap-1 mt-0.5"
                            >
                              <Phone className="w-3 h-3 text-emerald-600" />
                              {client.phone}
                            </a>
                          )}
                        </div>
                      </td>

                      {/* Empresa */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-1.5">
                          <Building className="w-3.5 h-3.5 text-muted-foreground/70 flex-shrink-0" />
                          <span className="text-foreground font-medium truncate max-w-[160px]">
                            {client.companyName}
                          </span>
                        </div>
                        <span className="text-[11px] text-muted-foreground block mt-0.5">
                          Desde {formatDate(client.createdAt)}
                        </span>
                      </td>

                      {/* Plano & Perfis */}
                      <td className="py-3.5 px-4">
                        <div className="space-y-1">
                          {renderPlanBadge(sub?.plan?.slug, sub?.plan?.name)}
                          <span className="text-[11px] text-muted-foreground block font-medium">
                            Perfis: <strong className="text-foreground">{client.activeProfilesCount ?? 0}</strong> / {client.maxProfiles === -1 ? '∞' : (client.maxProfiles ?? 1)}
                          </span>
                        </div>
                      </td>

                      {/* Cobrança */}
                      <td className="py-3.5 px-4">
                        {sub?.billingType === "manual" ? (
                          <div className="flex flex-col">
                            <span className="inline-flex items-center gap-1 text-xs text-blue-600 font-semibold">
                              <Key className="w-3 h-3" /> Manual
                            </span>
                            <span className="text-[11px] text-muted-foreground uppercase font-medium">
                              {sub.paymentMethod || "Direto"}
                            </span>
                          </div>
                        ) : (
                          <div className="flex flex-col">
                            <span className="inline-flex items-center gap-1 text-xs text-emerald-600 font-semibold">
                              <CreditCard className="w-3 h-3" /> Mercado Pago
                            </span>
                            {sub?.mercadopagoPaymentId && (
                              <span className="text-[10px] text-muted-foreground font-mono">
                                #{sub.mercadopagoPaymentId}
                              </span>
                            )}
                          </div>
                        )}
                      </td>

                      {/* Situação */}
                      <td className="py-3.5 px-4">
                        {renderStatusBadge(client)}
                      </td>

                      {/* Vencimento */}
                      <td className="py-3.5 px-4">
                        <span className="text-xs text-foreground block font-semibold">
                          {formatDate(sub?.currentPeriodEnd || sub?.trialEndsAt)}
                        </span>
                        <span className="text-[10px] text-muted-foreground">
                          {sub?.status === "trialing" ? "Fim do teste" : "Renovação"}
                        </span>
                      </td>

                      {/* Último Pagamento */}
                      <td className="py-3.5 px-4">
                        <span className="text-xs text-muted-foreground block">
                          {formatDate(sub?.lastPaymentDate)}
                        </span>
                      </td>

                      {/* Ações */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            title="Ver detalhes completos"
                            onClick={() => openClientDetails(client)}
                            className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground hover:bg-muted"
                          >
                            <Eye className="w-4 h-4" />
                          </Button>

                          <Button
                            variant="ghost"
                            size="sm"
                            title="Alterar Plano"
                            onClick={() => openChangePlan(client)}
                            className="h-8 w-8 p-0 text-muted-foreground hover:text-primary hover:bg-primary/10"
                          >
                            <Edit3 className="w-4 h-4" />
                          </Button>

                          <Button
                            variant="ghost"
                            size="sm"
                            title="Renovar / Estender Licença"
                            onClick={() => openRenew(client)}
                            className="h-8 w-8 p-0 text-muted-foreground hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40"
                          >
                            <ArrowUpRight className="w-4 h-4" />
                          </Button>

                          <Button
                            variant="ghost"
                            size="sm"
                            title={isSuspended ? "Reativar Acesso" : "Suspender Acesso"}
                            onClick={() => {
                              setSelectedClient(client);
                              setIsSuspendModalOpen(true);
                            }}
                            className={`h-8 w-8 p-0 ${
                              isSuspended ? "text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/40" : "text-muted-foreground hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                            }`}
                          >
                            {isSuspended ? <Play className="w-4 h-4" /> : <Ban className="w-4 h-4" />}
                          </Button>

                          {/* Botão de Excluir Cliente */}
                          <Button
                            variant="ghost"
                            size="sm"
                            title={isSuperAdminClient ? "Conta Principal do Super Admin (não pode ser excluída)" : "Excluir Cliente Definitivamente"}
                            disabled={isSuperAdminClient}
                            onClick={() => {
                              setSelectedClient(client);
                              setIsDeleteModalOpen(true);
                            }}
                            className={`h-8 w-8 p-0 ${
                              isSuperAdminClient
                                ? "text-muted-foreground/30 cursor-not-allowed"
                                : "text-muted-foreground hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                            }`}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Footer com Paginação */}
        <div className="bg-muted/30 border-t border-border px-4 py-3 flex items-center justify-between text-xs text-muted-foreground">
          <div>
            Mostrando <span className="text-foreground font-semibold">{paginatedClients.length}</span> de{" "}
            <span className="text-foreground font-semibold">{filteredClients.length}</span> clientes
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage <= 1}
              className="h-7 px-2 border-border bg-card text-foreground disabled:opacity-40"
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <span className="font-medium">
              Página {currentPage} de {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage >= totalPages}
              className="h-7 px-2 border-border bg-card text-foreground disabled:opacity-40"
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </Card>

      {/* MODAL 1: Novo Cliente (Light Mode) */}
      {isNewClientOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-card border border-border rounded-2xl max-w-xl w-full p-6 shadow-2xl space-y-4 my-8 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-primary/10 text-primary">
                  <UserPlus className="w-5 h-5" />
                </div>
                <h3 className="text-lg font-bold text-foreground">Cadastrar Novo Cliente</h3>
              </div>
              <button
                onClick={() => setIsNewClientOpen(false)}
                className="text-muted-foreground hover:text-foreground p-1 rounded-md hover:bg-muted transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateClient} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-foreground">Nome do Cliente *</Label>
                  <Input
                    required
                    placeholder="Ex: João da Silva"
                    value={newClientForm.fullName}
                    onChange={e => setNewClientForm(prev => ({ ...prev, fullName: e.target.value }))}
                    className="bg-background border-border text-foreground text-sm"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-foreground">E-mail de Acesso *</Label>
                  <Input
                    required
                    type="email"
                    placeholder="joao@empresa.com"
                    value={newClientForm.email}
                    onChange={e => setNewClientForm(prev => ({ ...prev, email: e.target.value }))}
                    className="bg-background border-border text-foreground text-sm"
                  />
                </div>

                <div className="space-y-1.5 md:col-span-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-semibold text-foreground">Senha Inicial *</Label>
                    <button
                      type="button"
                      onClick={generateRandomPassword}
                      className="text-xs text-primary font-semibold hover:underline flex items-center gap-1"
                    >
                      <Key className="w-3 h-3" /> Gerar senha forte
                    </button>
                  </div>
                  <Input
                    required
                    placeholder="Mínimo 6 caracteres"
                    value={newClientForm.password}
                    onChange={e => setNewClientForm(prev => ({ ...prev, password: e.target.value }))}
                    className="bg-background border-border text-foreground text-sm font-mono"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-foreground">Empresa / Workspace</Label>
                  <Input
                    placeholder="Ex: Agência Digital"
                    value={newClientForm.companyName}
                    onChange={e => setNewClientForm(prev => ({ ...prev, companyName: e.target.value }))}
                    className="bg-background border-border text-foreground text-sm"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-foreground">WhatsApp / Telefone</Label>
                  <Input
                    placeholder="(11) 99999-9999"
                    value={newClientForm.phone}
                    onChange={e => setNewClientForm(prev => ({ ...prev, phone: e.target.value }))}
                    className="bg-background border-border text-foreground text-sm"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-foreground">Plano Contratado *</Label>
                  <select
                    value={newClientForm.planId}
                    onChange={e => setNewClientForm(prev => ({ ...prev, planId: e.target.value }))}
                    className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary shadow-xs"
                  >
                    {plans.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.name} — R$ {p.price.toFixed(2)}/mês
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-foreground">Tipo de Cobrança *</Label>
                  <select
                    value={newClientForm.billingType}
                    onChange={e => setNewClientForm(prev => ({ ...prev, billingType: e.target.value as any }))}
                    className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary shadow-xs"
                  >
                    <option value="manual">Pagamento Manual / Direto</option>
                    <option value="mercadopago">Mercado Pago (Assinatura)</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-foreground">Forma de Pagamento</Label>
                  <select
                    value={newClientForm.paymentMethod}
                    onChange={e => setNewClientForm(prev => ({ ...prev, paymentMethod: e.target.value }))}
                    className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary shadow-xs"
                  >
                    <option value="pix">PIX</option>
                    <option value="credit_card">Cartão de Crédito</option>
                    <option value="bank_transfer">Transferência Bancária</option>
                    <option value="manual">Manual / Dinheiro</option>
                    <option value="other">Outro</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-foreground">Status Inicial</Label>
                  <select
                    value={newClientForm.status}
                    onChange={e => setNewClientForm(prev => ({ ...prev, status: e.target.value as any }))}
                    className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary shadow-xs"
                  >
                    <option value="active">Ativo (Liberado)</option>
                    <option value="trialing">Em Teste (Trial)</option>
                  </select>
                </div>

                <div className="space-y-1.5 md:col-span-2">
                  <Label className="text-xs font-semibold text-foreground">Vigência Inicial</Label>
                  <div className="grid grid-cols-4 gap-2">
                    {["30", "60", "90", "365"].map(d => (
                      <button
                        key={d}
                        type="button"
                        onClick={() => setNewClientForm(prev => ({ ...prev, periodDays: d, customEndDate: "" }))}
                        className={`py-2 px-3 rounded-lg text-xs font-semibold border transition-all ${
                          newClientForm.periodDays === d && !newClientForm.customEndDate
                            ? "bg-primary text-primary-foreground border-primary shadow-xs"
                            : "bg-background border-border text-muted-foreground hover:text-foreground hover:border-muted-foreground/50"
                        }`}
                      >
                        +{d === "365" ? "1 ano" : `${d} dias`}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-1.5 md:col-span-2">
                  <Label className="text-xs font-semibold text-foreground">Ou Data de Vencimento Específica</Label>
                  <Input
                    type="date"
                    value={newClientForm.customEndDate}
                    onChange={e => setNewClientForm(prev => ({ ...prev, customEndDate: e.target.value }))}
                    className="bg-background border-border text-foreground text-sm"
                  />
                </div>

                <div className="space-y-1.5 md:col-span-2">
                  <Label className="text-xs font-semibold text-foreground">Observações Administrativas (Opcional)</Label>
                  <textarea
                    rows={2}
                    placeholder="Ex: Pagamento anual via PIX comprovante #123456"
                    value={newClientForm.notes}
                    onChange={e => setNewClientForm(prev => ({ ...prev, notes: e.target.value }))}
                    className="w-full bg-background border border-border rounded-lg p-2.5 text-sm text-foreground focus:outline-none focus:border-primary resize-none"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-border">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsNewClientOpen(false)}
                  className="border-border text-foreground hover:bg-muted"
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={creatingClient}
                  className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold shadow-xs"
                >
                  {creatingClient ? (
                    <>
                      <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                      Cadastrando...
                    </>
                  ) : (
                    "Cadastrar Cliente"
                  )}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: Alterar Plano (Light Mode) */}
      {isChangePlanOpen && selectedClient && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-primary/10 text-primary">
                  <Edit3 className="w-5 h-5" />
                </div>
                <h3 className="text-lg font-bold text-foreground">Alterar Plano do Cliente</h3>
              </div>
              <button
                onClick={() => setIsChangePlanOpen(false)}
                className="text-muted-foreground hover:text-foreground p-1 rounded-md hover:bg-muted"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3 bg-muted/40 rounded-xl border border-border text-xs text-foreground space-y-1">
              <div><strong>Cliente:</strong> {selectedClient.fullName} ({selectedClient.email})</div>
              <div><strong>Empresa:</strong> {selectedClient.companyName}</div>
              <div><strong>Plano Atual:</strong> {selectedClient.subscription?.plan?.name || "Nenhum"}</div>
            </div>

            <div className="space-y-3">
              <Label className="text-xs font-semibold text-foreground">Selecione o Novo Plano:</Label>
              <div className="space-y-2">
                {plans.map(p => {
                  const isSelected = newPlanId === p.id;
                  return (
                    <div
                      key={p.id}
                      onClick={() => setNewPlanId(p.id)}
                      className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                        isSelected
                          ? "bg-primary/5 border-primary shadow-xs ring-1 ring-primary"
                          : "bg-card border-border hover:border-muted-foreground/50"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-foreground text-sm">{p.name}</span>
                          {p.slug === "pro" && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] bg-blue-50 text-blue-700 border border-blue-200 font-semibold">Recomendado</span>
                          )}
                        </div>
                        <span className="font-bold text-foreground text-sm">
                          R$ {p.price.toFixed(2)}/mês
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">{p.description}</p>

                      <div className="flex flex-wrap gap-2 mt-2 pt-2 border-t border-border text-[11px] text-muted-foreground">
                        <span>Redes: {p.limits?.max_channels === -1 ? "Ilimitadas" : p.limits?.max_channels || 3}</span>
                        <span>• Posts: {p.limits?.max_posts === -1 ? "Ilimitados" : p.limits?.max_posts || 50}</span>
                        <span>• IA: {p.limits?.ai_automations ? "Liberada" : "Não"}</span>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="space-y-1.5 pt-2">
                <Label className="text-xs font-semibold text-foreground">Motivo da Alteração (Opcional):</Label>
                <Input
                  placeholder="Ex: Upgrade solicitado pelo cliente / Bonificação"
                  value={changePlanReason}
                  onChange={e => setChangePlanReason(e.target.value)}
                  className="bg-background border-border text-foreground text-sm"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-border">
              <Button
                variant="outline"
                onClick={() => setIsChangePlanOpen(false)}
                className="border-border text-foreground hover:bg-muted"
              >
                Cancelar
              </Button>
              <Button
                onClick={handleUpdatePlan}
                disabled={updatingPlan || newPlanId === selectedClient.subscription?.planId}
                className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold shadow-xs"
              >
                {updatingPlan ? "Atualizando..." : "Confirmar Alteração"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: Renovar Licença (Light Mode) */}
      {isRenewOpen && selectedClient && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600">
                  <ArrowUpRight className="w-5 h-5" />
                </div>
                <h3 className="text-lg font-bold text-foreground">Renovar / Estender Licença</h3>
              </div>
              <button
                onClick={() => setIsRenewOpen(false)}
                className="text-muted-foreground hover:text-foreground p-1 rounded-md hover:bg-muted"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3 bg-muted/40 rounded-xl border border-border text-xs text-foreground space-y-1">
              <div><strong>Cliente:</strong> {selectedClient.fullName}</div>
              <div><strong>Vencimento Atual:</strong> {formatDate(selectedClient.subscription?.currentPeriodEnd || selectedClient.subscription?.trialEndsAt)}</div>
              <div><strong>Plano:</strong> {selectedClient.subscription?.plan?.name || "Starter"}</div>
            </div>

            <div className="space-y-3">
              <Label className="text-xs font-semibold text-foreground">Adicionar Período à Licença:</Label>
              <div className="grid grid-cols-4 gap-2">
                {[
                  { label: "+30 dias", val: "30" },
                  { label: "+60 dias", val: "60" },
                  { label: "+90 dias", val: "90" },
                  { label: "+1 ano", val: "365" },
                ].map(item => (
                  <button
                    key={item.val}
                    type="button"
                    onClick={() => {
                      setRenewDays(item.val);
                      setRenewCustomDate("");
                    }}
                    className={`py-2 px-3 rounded-lg text-xs font-semibold border transition-all ${
                      renewDays === item.val && !renewCustomDate
                        ? "bg-emerald-600 text-white border-emerald-600 shadow-xs"
                        : "bg-background border-border text-muted-foreground hover:text-foreground hover:border-muted-foreground/50"
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>

              <div className="space-y-1.5 pt-1">
                <Label className="text-xs font-semibold text-foreground">Ou Definir Nova Data de Vencimento Específica:</Label>
                <Input
                  type="date"
                  value={renewCustomDate}
                  onChange={e => {
                    setRenewCustomDate(e.target.value);
                    setRenewDays("");
                  }}
                  className="bg-background border-border text-foreground text-sm"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-foreground">Forma de Pagamento Recebida:</Label>
                <select
                  value={renewPaymentMethod}
                  onChange={e => setRenewPaymentMethod(e.target.value)}
                  className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary shadow-xs"
                >
                  <option value="pix">PIX</option>
                  <option value="credit_card">Cartão de Crédito</option>
                  <option value="bank_transfer">Transferência Bancária</option>
                  <option value="manual">Dinheiro / Outro</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-foreground">Observações / Comprovante:</Label>
                <Input
                  placeholder="Ex: Renovação trimestral comprovante PIX #987654"
                  value={renewNotes}
                  onChange={e => setRenewNotes(e.target.value)}
                  className="bg-background border-border text-foreground text-sm"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-border">
              <Button
                variant="outline"
                onClick={() => setIsRenewOpen(false)}
                className="border-border text-foreground hover:bg-muted"
              >
                Cancelar
              </Button>
              <Button
                onClick={handleRenewLicense}
                disabled={renewing}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold shadow-xs"
              >
                {renewing ? "Salvando..." : "Confirmar Renovação"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 4: Suspender / Reativar Acesso */}
      <ConfirmModal
        open={isSuspendModalOpen}
        title={
          selectedClient?.subscription?.status === "suspended"
            ? "Reativar Acesso do Cliente"
            : "Suspender Licença do Cliente"
        }
        message={
          selectedClient?.subscription?.status === "suspended"
            ? `Tem certeza que deseja reativar o acesso de ${selectedClient?.fullName}? O cliente poderá voltar a fazer login e utilizar as ferramentas normalmente.`
            : `Tem certeza que deseja suspender o acesso de ${selectedClient?.fullName}? O cliente será bloqueado de acessar as ferramentas do painel imediatamente até que seja reativado.`
        }
        confirmLabel={
          selectedClient?.subscription?.status === "suspended"
            ? "Reativar Acesso"
            : "Suspender Acesso"
        }
        variant={selectedClient?.subscription?.status === "suspended" ? "default" : "danger"}
        onConfirm={handleToggleSuspend}
        onCancel={() => setIsSuspendModalOpen(false)}
      />

      {/* MODAL 5: Detalhes do Cliente (Drawer / Light Mode) */}
      {isDetailsOpen && selectedClient && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-card border border-border rounded-2xl max-w-3xl w-full p-6 shadow-2xl space-y-4 my-6 animate-in fade-in zoom-in-95 max-h-[90vh] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-border pb-3 flex-shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-base border border-primary/20">
                  {selectedClient.fullName.charAt(0).toUpperCase()}
                </div>
                <div>
                  <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
                    {selectedClient.fullName}
                    {renderPlanBadge(selectedClient.subscription?.plan?.slug, selectedClient.subscription?.plan?.name)}
                  </h3>
                  <p className="text-xs text-muted-foreground">{selectedClient.email} • {selectedClient.companyName}</p>
                </div>
              </div>
              <button
                onClick={() => setIsDetailsOpen(false)}
                className="text-muted-foreground hover:text-foreground p-1 rounded-md hover:bg-muted"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Abas */}
            <div className="flex items-center gap-2 border-b border-border pb-2 flex-shrink-0">
              <button
                onClick={() => setDetailsTab("overview")}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  detailsTab === "overview"
                    ? "bg-primary text-primary-foreground shadow-xs"
                    : "bg-muted/60 text-muted-foreground hover:text-foreground"
                }`}
              >
                Visão Geral & Licença
              </button>
              <button
                onClick={() => setDetailsTab("payments")}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  detailsTab === "payments"
                    ? "bg-primary text-primary-foreground shadow-xs"
                    : "bg-muted/60 text-muted-foreground hover:text-foreground"
                }`}
              >
                Histórico de Pagamentos ({paymentHistory.length})
              </button>
              <button
                onClick={() => setDetailsTab("audit")}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  detailsTab === "audit"
                    ? "bg-primary text-primary-foreground shadow-xs"
                    : "bg-muted/60 text-muted-foreground hover:text-foreground"
                }`}
              >
                Auditoria ({auditLogs.length})
              </button>
            </div>

            {/* Conteúdo com Scroll */}
            <div className="flex-1 overflow-y-auto space-y-4 pr-1">
              {detailsTab === "overview" && (
                <div className="space-y-4">
                  {/* Informações Cadastrais */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 bg-muted/40 p-4 rounded-xl border border-border text-xs">
                    <div>
                      <span className="text-muted-foreground block font-medium">ID do Usuário:</span>
                      <span className="font-mono text-foreground select-all font-semibold">{selectedClient.userId}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground block font-medium">ID do Tenant (Workspace):</span>
                      <span className="font-mono text-foreground select-all font-semibold">{selectedClient.tenantId}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground block font-medium">Data de Cadastro:</span>
                      <span className="text-foreground font-semibold">{formatDate(selectedClient.createdAt)}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground block font-medium">Telefone / WhatsApp:</span>
                      <span className="text-foreground font-semibold">{selectedClient.phone || "Não informado"}</span>
                    </div>
                  </div>

                  {/* Informações da Licença */}
                  <div className="bg-muted/40 p-4 rounded-xl border border-border space-y-3">
                    <h4 className="text-xs font-bold text-foreground uppercase tracking-wider">
                      Dados da Licença & Assinatura
                    </h4>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                      <div>
                        <span className="text-muted-foreground block font-medium">Status Atual:</span>
                        <div className="mt-1">{renderStatusBadge(selectedClient)}</div>
                      </div>
                      <div>
                        <span className="text-muted-foreground block font-medium">Tipo de Cobrança:</span>
                        <span className="font-semibold text-foreground capitalize block mt-1">
                          {selectedClient.subscription?.billingType === "manual" ? "Manual / Direto" : "Mercado Pago"}
                        </span>
                      </div>
                      <div>
                        <span className="text-muted-foreground block font-medium">Forma de Pagamento:</span>
                        <span className="font-semibold text-foreground uppercase block mt-1">
                          {selectedClient.subscription?.paymentMethod || "-"}
                        </span>
                      </div>
                      <div>
                        <span className="text-muted-foreground block font-medium">Início da Vigência:</span>
                        <span className="font-semibold text-foreground block mt-1">
                          {formatDate(selectedClient.subscription?.currentPeriodStart)}
                        </span>
                      </div>
                      <div>
                        <span className="text-muted-foreground block font-medium">Vencimento da Licença:</span>
                        <span className="font-semibold text-foreground block mt-1">
                          {formatDate(selectedClient.subscription?.currentPeriodEnd || selectedClient.subscription?.trialEndsAt)}
                        </span>
                      </div>
                      <div>
                        <span className="text-muted-foreground block font-medium">Último Pagamento:</span>
                        <span className="font-semibold text-foreground block mt-1">
                          {formatDate(selectedClient.subscription?.lastPaymentDate)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Uso de Perfis Ativos & Contas Zernio */}
                  <div className="bg-muted/40 p-4 rounded-xl border border-border space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-1.5">
                        <Users className="w-4 h-4 text-primary" />
                        Franquia de Perfis Ativos & Contas
                      </h4>
                      <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-violet-500/10 text-violet-700 dark:text-violet-300 border border-violet-500/20">
                        {selectedClient.activeProfilesCount ?? 0} / {selectedClient.maxProfiles === -1 ? '∞' : (selectedClient.maxProfiles ?? 1)} Perfis
                      </span>
                    </div>

                    <p className="text-xs text-muted-foreground">
                      Cada Perfil Ativo permite conectar até 2 contas gratuitas através do Zernio. Limite contratado: <strong>{selectedClient.maxProfiles === -1 ? 'Ilimitado' : `${selectedClient.maxProfiles} perfis`}</strong> (potencial de até {selectedClient.maxProfiles === -1 ? 'ilimitadas' : (selectedClient.maxProfiles ?? 1) * 2} contas).
                    </p>

                    {/* Lista de Perfis do Cliente */}
                    <div className="space-y-2 pt-1">
                      {selectedClient.clientProfiles && selectedClient.clientProfiles.length > 0 ? (
                        selectedClient.clientProfiles.map((prof: any, pIdx: number) => (
                          <div key={prof.id || pIdx} className="p-3 bg-card border border-border rounded-xl flex items-center justify-between">
                            <div className="flex items-center gap-2.5">
                              <div className="w-7 h-7 rounded-lg bg-violet-500/10 text-violet-600 dark:text-violet-400 flex items-center justify-center font-bold text-xs border border-violet-500/20">
                                {pIdx + 1}
                              </div>
                              <div>
                                <p className="text-xs font-bold text-foreground">{prof.name || `Perfil ${pIdx + 1}`}</p>
                                <p className="text-[11px] text-muted-foreground">
                                  {prof.account_name && prof.account_name !== prof.name ? `${prof.account_name} • ` : ''}
                                  {prof.profileId ? `Zernio ID: ${prof.profileId.slice(0, 8)}...` : 'ID padrão'}
                                </p>
                              </div>
                            </div>
                            <span className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-secondary text-foreground border border-border">
                              {prof.channelsCount || 0} / 2 contas
                            </span>
                          </div>
                        ))
                      ) : (
                        <div className="p-3 bg-card/60 border border-dashed border-border rounded-xl text-center">
                          <p className="text-xs text-muted-foreground italic">
                            Nenhum perfil ativo ou conta Zernio conectada ainda por este cliente.
                          </p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Observações Administrativas */}
                  <div className="bg-muted/40 p-4 rounded-xl border border-border space-y-2">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-bold text-foreground uppercase tracking-wider">
                        Observações Administrativas
                      </h4>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={handleSaveNotes}
                        disabled={savingNotes}
                        className="h-7 text-xs text-primary hover:text-primary/80 font-semibold"
                      >
                        {savingNotes ? "Salvando..." : "Salvar Notas"}
                      </Button>
                    </div>
                    <textarea
                      rows={3}
                      value={clientNotesInput}
                      onChange={e => setClientNotesInput(e.target.value)}
                      placeholder="Adicione anotações sobre este cliente, acordos, dados bancários de comprovante..."
                      className="w-full bg-card border border-border rounded-lg p-2.5 text-xs text-foreground focus:outline-none focus:border-primary resize-none shadow-xs"
                    />
                  </div>
                </div>
              )}

              {detailsTab === "payments" && (
                <div className="space-y-3">
                  {loadingDetailsData ? (
                    <div className="text-center py-8 text-muted-foreground text-xs">Carregando histórico financeiro...</div>
                  ) : paymentHistory.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground text-xs">
                      Nenhum pagamento registrado para este cliente.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {paymentHistory.map(p => (
                        <div key={p.id} className="p-3 bg-muted/40 rounded-xl border border-border flex items-center justify-between text-xs">
                          <div>
                            <span className="font-bold text-foreground text-sm">
                              R$ {Number(p.amount || 0).toFixed(2)}
                            </span>
                            <span className="text-muted-foreground ml-2">
                              • {p.payment_method?.toUpperCase() || "MANUAL"}
                            </span>
                            <span className="text-muted-foreground block text-[11px] mt-0.5">
                              {new Date(p.created_at).toLocaleString("pt-BR")}
                            </span>
                          </div>
                          <div>
                            <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-semibold uppercase ${
                              p.status === "approved"
                                ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                : "bg-stone-100 text-stone-600 border border-stone-200"
                            }`}>
                              {p.status === "approved" ? "Aprovado" : p.status}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {detailsTab === "audit" && (
                <div className="space-y-3">
                  {loadingDetailsData ? (
                    <div className="text-center py-8 text-muted-foreground text-xs">Carregando histórico de auditoria...</div>
                  ) : auditLogs.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground text-xs">
                      Nenhuma ação administrativa registrada para este cliente.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {auditLogs.map(log => (
                        <div key={log.id} className="p-3 bg-muted/40 rounded-xl border border-border text-xs space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-primary uppercase text-[11px]">
                              {log.action.replace("_", " ")}
                            </span>
                            <span className="text-muted-foreground text-[10px]">
                              {new Date(log.created_at).toLocaleString("pt-BR")}
                            </span>
                          </div>
                          <p className="text-muted-foreground text-[11px]">
                            Executado por: <strong className="text-foreground">{log.admin_email}</strong>
                          </p>
                          {log.details && (
                            <pre className="p-2 bg-background rounded-lg border border-border text-[10px] text-muted-foreground overflow-x-auto">
                              {JSON.stringify(log.details, null, 2)}
                            </pre>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="border-t border-border pt-3 flex items-center justify-between flex-shrink-0">
              <Button
                variant="destructive"
                size="sm"
                onClick={() => {
                  setIsDetailsOpen(false);
                  setIsDeleteModalOpen(true);
                }}
                className="text-xs bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200 font-semibold"
              >
                <Trash2 className="w-3.5 h-3.5 mr-1.5" /> Excluir Cliente Definitivamente
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsDetailsOpen(false)}
                className="border-border text-foreground hover:bg-muted"
              >
                Fechar
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 6: Confirmação de Exclusão Definitiva */}
      <ConfirmModal
        open={isDeleteModalOpen}
        title="Excluir Cliente Definitivamente"
        message={`ATENÇÃO: Deseja realmente excluir permanentemente o cliente "${selectedClient?.fullName || selectedClient?.companyName}" (${selectedClient?.email}) e todos os seus dados, canais, integrações e configurações? Esta ação é irreversível e apagará o workspace por completo.`}
        confirmLabel={deletingClient ? "Excluindo..." : "Excluir Definitivamente"}
        variant="danger"
        onConfirm={handleDeleteClient}
        onCancel={() => {
          if (!deletingClient) {
            setIsDeleteModalOpen(false);
          }
        }}
      />
    </div>
  );
}
