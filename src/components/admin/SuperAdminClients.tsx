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

      // Mapear assinaturas por tenant_id
      const subsMap = new Map<string, any>();
      (subsData || []).forEach((s: any) => {
        subsMap.set(s.tenant_id, s);
      });

      // Montar lista de clientes
      const combined: ClientRecord[] = (profilesData || []).map((p: any) => {
        const sub = subsMap.get(p.tenant_id);
        return {
          userId: p.id,
          tenantId: p.tenant_id,
          email: p.email,
          fullName: p.full_name || p.email.split("@")[0],
          phone: p.phone,
          companyName: p.tenant?.name || "Sem nome",
          createdAt: p.created_at,
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
    toast.success("Senha gerada e copiada para a área de transferência: " + pwd);
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
      // Busca texto
      if (searchTerm) {
        const query = searchTerm.toLowerCase();
        const matchName = c.fullName.toLowerCase().includes(query);
        const matchEmail = c.email.toLowerCase().includes(query);
        const matchCompany = c.companyName.toLowerCase().includes(query);
        const matchPhone = c.phone?.toLowerCase().includes(query);
        if (!matchName && !matchEmail && !matchCompany && !matchPhone) return false;
      }

      // Filtro por plano
      if (filterPlan !== "all") {
        if (c.subscription?.plan?.slug !== filterPlan) return false;
      }

      // Filtro por cobrança
      if (filterBilling !== "all") {
        if (c.subscription?.billingType !== filterBilling) return false;
      }

      // Filtro por status
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
      // recent
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

  // Helper de badge de status
  const renderStatusBadge = (client: ClientRecord) => {
    const sub = client.subscription;
    const now = new Date();

    if (!sub) {
      return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-zinc-800 text-zinc-400">Sem Licença</span>;
    }

    if (sub.status === "suspended") {
      return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-500/10 text-red-400 border border-red-500/20"><Ban className="w-3 h-3" /> Suspenso</span>;
    }

    if (sub.status === "active") {
      if (sub.currentPeriodEnd && new Date(sub.currentPeriodEnd) <= now) {
        return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-rose-500/10 text-rose-400 border border-rose-500/20"><AlertCircle className="w-3 h-3" /> Vencido</span>;
      }
      // Ativo com prazo
      let daysText = "";
      if (sub.currentPeriodEnd) {
        const diff = Math.ceil((new Date(sub.currentPeriodEnd).getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        daysText = ` (${diff}d)`;
      }
      return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"><CheckCircle2 className="w-3 h-3" /> Ativo{daysText}</span>;
    }

    if (sub.status === "trialing") {
      if (sub.trialEndsAt && new Date(sub.trialEndsAt) <= now) {
        return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20"><Clock className="w-3 h-3" /> Trial Expirado</span>;
      }
      let daysText = "";
      if (sub.trialEndsAt) {
        const diff = Math.ceil((new Date(sub.trialEndsAt).getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        daysText = ` (${diff}d)`;
      }
      return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20"><Clock className="w-3 h-3" /> Teste{daysText}</span>;
    }

    return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-zinc-800 text-zinc-400">{sub.status}</span>;
  };

  // Helper de badge de plano
  const renderPlanBadge = (slug?: string, name?: string) => {
    if (!name) return <span className="text-zinc-500 text-xs">-</span>;
    if (slug === "agency") {
      return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-purple-500/15 text-purple-400 border border-purple-500/30">Agência</span>;
    }
    if (slug === "pro") {
      return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-blue-500/15 text-blue-400 border border-blue-500/30">Pro</span>;
    }
    return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-zinc-800 text-zinc-300 border border-zinc-700">Starter</span>;
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

    try {
      const { data, error } = await supabase.functions.invoke("admin-clients", {
        body: {
          action: "delete-client",
          user_id: selectedClient.userId,
          tenant_id: selectedClient.tenantId,
          reason: "Exclusão manual definitiva pelo Super Admin",
        },
      });

      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);

      toast.success("Cliente e registros associados foram excluídos.");
      setIsDeleteModalOpen(false);
      loadData(true);
    } catch (err: any) {
      console.error("Erro ao excluir cliente:", err);
      toast.error("Falha ao excluir cliente: " + err.message);
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
      // Buscar pagamentos do tenant
      const { data: payments } = await (supabase.from("payment_history" as any) as any)
        .select("*, plan:plans(name)")
        .eq("tenant_id", client.tenantId)
        .order("created_at", { ascending: false });

      setPaymentHistory(payments || []);

      // Buscar logs de auditoria do tenant
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
    <div className="space-y-6 animate-fade-in text-zinc-100">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800/80 pb-5">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
              <Users className="w-6 h-6 text-primary" />
              Gestão de Clientes & Licenças
            </h1>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-primary/20 text-primary border border-primary/30">
              <ShieldCheck className="w-3.5 h-3.5" /> Super Admin
            </span>
          </div>
          <p className="text-sm text-zinc-400">
            Painel centralizado para visualização, cadastro manual, alteração de planos e controle de licenças do SaaS.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            variant="outline"
            size="sm"
            onClick={() => loadData(true)}
            disabled={refreshing || loading}
            className="border-zinc-700 bg-zinc-900/80 hover:bg-zinc-800 text-zinc-200"
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
            className="bg-primary hover:bg-primary/90 text-primary-foreground font-medium shadow-md shadow-primary/20"
          >
            <UserPlus className="w-4 h-4 mr-2" />
            Novo Cliente
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
        <Card className="bg-zinc-900/60 border-zinc-800/80 backdrop-blur-sm">
          <CardHeader className="p-4 pb-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-zinc-400">Total de Clientes</span>
              <Users className="w-4 h-4 text-zinc-400" />
            </div>
            <CardTitle className="text-2xl font-bold text-white mt-1">{stats.total}</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <p className="text-xs text-zinc-500">Cadastrados no sistema</p>
          </CardContent>
        </Card>

        <Card className="bg-zinc-900/60 border-zinc-800/80 backdrop-blur-sm">
          <CardHeader className="p-4 pb-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-emerald-400">Ativos</span>
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            </div>
            <CardTitle className="text-2xl font-bold text-emerald-400 mt-1">{stats.active}</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <p className="text-xs text-zinc-500">Com licença em dia</p>
          </CardContent>
        </Card>

        <Card className="bg-zinc-900/60 border-zinc-800/80 backdrop-blur-sm">
          <CardHeader className="p-4 pb-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-amber-400">Em Teste (Trial)</span>
              <Clock className="w-4 h-4 text-amber-400" />
            </div>
            <CardTitle className="text-2xl font-bold text-amber-400 mt-1">{stats.trialing}</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <p className="text-xs text-zinc-500">Período de avaliação</p>
          </CardContent>
        </Card>

        <Card className="bg-zinc-900/60 border-zinc-800/80 backdrop-blur-sm">
          <CardHeader className="p-4 pb-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-blue-400">Licença Manual</span>
              <Key className="w-4 h-4 text-blue-400" />
            </div>
            <CardTitle className="text-2xl font-bold text-blue-400 mt-1">{stats.manual}</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <p className="text-xs text-zinc-500">Pagamento direto/manual</p>
          </CardContent>
        </Card>

        <Card className="bg-zinc-900/60 border-zinc-800/80 backdrop-blur-sm">
          <CardHeader className="p-4 pb-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-rose-400">Suspensos / Vencidos</span>
              <AlertCircle className="w-4 h-4 text-rose-400" />
            </div>
            <CardTitle className="text-2xl font-bold text-rose-400 mt-1">{stats.suspendedOrExpired}</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <p className="text-xs text-zinc-500">Requer atenção</p>
          </CardContent>
        </Card>
      </div>

      {/* Filter and Search Bar */}
      <Card className="bg-zinc-900/60 border-zinc-800/80 p-4">
        <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
            <Input
              type="text"
              placeholder="Buscar por nome, e-mail, empresa ou telefone..."
              value={searchTerm}
              onChange={e => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              className="pl-9 bg-zinc-950/80 border-zinc-800 text-sm focus-visible:ring-primary/50"
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
              className="bg-zinc-950/80 border border-zinc-800 rounded-md px-3 py-1.5 text-xs text-zinc-300 focus:outline-none focus:border-primary"
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
              className="bg-zinc-950/80 border border-zinc-800 rounded-md px-3 py-1.5 text-xs text-zinc-300 focus:outline-none focus:border-primary"
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
              className="bg-zinc-950/80 border border-zinc-800 rounded-md px-3 py-1.5 text-xs text-zinc-300 focus:outline-none focus:border-primary"
            >
              <option value="all">Todas as Cobranças</option>
              <option value="manual">Manual / Direto</option>
              <option value="mercadopago">Mercado Pago</option>
            </select>

            {/* Ordenação */}
            <select
              value={sortBy}
              onChange={e => setSortBy(e.target.value as any)}
              className="bg-zinc-950/80 border border-zinc-800 rounded-md px-3 py-1.5 text-xs text-zinc-300 focus:outline-none focus:border-primary"
            >
              <option value="recent">Mais Recentes</option>
              <option value="expiry">Vencimento Próximo</option>
              <option value="name">Nome (A-Z)</option>
            </select>
          </div>
        </div>
      </Card>

      {/* Main Table */}
      <Card className="bg-zinc-900/60 border-zinc-800/80 overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-zinc-300">
            <thead className="bg-zinc-950/80 border-b border-zinc-800 text-xs font-semibold text-zinc-400 uppercase tracking-wider">
              <tr>
                <th className="py-3 px-4">Cliente</th>
                <th className="py-3 px-4">Empresa / Workspace</th>
                <th className="py-3 px-4">Plano</th>
                <th className="py-3 px-4">Cobrança</th>
                <th className="py-3 px-4">Situação</th>
                <th className="py-3 px-4">Vencimento</th>
                <th className="py-3 px-4">Último Pgto</th>
                <th className="py-3 px-4 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/60">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-zinc-400">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto text-primary mb-2" />
                    Carregando base de clientes do SaaS...
                  </td>
                </tr>
              ) : paginatedClients.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-zinc-400">
                    <Users className="w-8 h-8 mx-auto text-zinc-600 mb-2" />
                    Nenhum cliente encontrado com os filtros atuais.
                  </td>
                </tr>
              ) : (
                paginatedClients.map((client) => {
                  const sub = client.subscription;
                  const isSuspended = sub?.status === "suspended";

                  return (
                    <tr
                      key={client.userId}
                      className="hover:bg-zinc-800/30 transition-colors group"
                    >
                      {/* Cliente */}
                      <td className="py-3 px-4">
                        <div className="flex flex-col">
                          <span className="font-medium text-white flex items-center gap-1.5">
                            {client.fullName}
                            {client.email === "suporte@platafy.com" && (
                              <span className="px-1.5 py-0.2 rounded text-[10px] bg-primary/20 text-primary border border-primary/30">
                                Você
                              </span>
                            )}
                          </span>
                          <span className="text-xs text-zinc-400 flex items-center gap-1 mt-0.5">
                            <Mail className="w-3 h-3 text-zinc-500" />
                            {client.email}
                          </span>
                          {client.phone && (
                            <a
                              href={`https://wa.me/${client.phone.replace(/\D/g, "")}`}
                              target="_blank"
                              rel="noreferrer"
                              className="text-xs text-emerald-400/90 hover:text-emerald-300 flex items-center gap-1 mt-0.5"
                            >
                              <Phone className="w-3 h-3 text-emerald-500" />
                              {client.phone}
                            </a>
                          )}
                        </div>
                      </td>

                      {/* Empresa */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1.5">
                          <Building className="w-3.5 h-3.5 text-zinc-500 flex-shrink-0" />
                          <span className="text-zinc-200 font-medium truncate max-w-[160px]">
                            {client.companyName}
                          </span>
                        </div>
                        <span className="text-[11px] text-zinc-500 block mt-0.5">
                          Desde {formatDate(client.createdAt)}
                        </span>
                      </td>

                      {/* Plano */}
                      <td className="py-3 px-4">
                        {renderPlanBadge(sub?.plan?.slug, sub?.plan?.name)}
                      </td>

                      {/* Cobrança */}
                      <td className="py-3 px-4">
                        {sub?.billingType === "manual" ? (
                          <div className="flex flex-col">
                            <span className="inline-flex items-center gap-1 text-xs text-blue-400 font-medium">
                              <Key className="w-3 h-3" /> Manual
                            </span>
                            <span className="text-[11px] text-zinc-400 uppercase">
                              {sub.paymentMethod || "Direto"}
                            </span>
                          </div>
                        ) : (
                          <div className="flex flex-col">
                            <span className="inline-flex items-center gap-1 text-xs text-emerald-400 font-medium">
                              <CreditCard className="w-3 h-3" /> Mercado Pago
                            </span>
                            {sub?.mercadopagoPaymentId && (
                              <span className="text-[10px] text-zinc-500 font-mono">
                                #{sub.mercadopagoPaymentId}
                              </span>
                            )}
                          </div>
                        )}
                      </td>

                      {/* Situação */}
                      <td className="py-3 px-4">
                        {renderStatusBadge(client)}
                      </td>

                      {/* Vencimento */}
                      <td className="py-3 px-4">
                        <span className="text-xs text-zinc-200 block font-medium">
                          {formatDate(sub?.currentPeriodEnd || sub?.trialEndsAt)}
                        </span>
                        <span className="text-[10px] text-zinc-500">
                          {sub?.status === "trialing" ? "Fim do teste" : "Renovação"}
                        </span>
                      </td>

                      {/* Último Pagamento */}
                      <td className="py-3 px-4">
                        <span className="text-xs text-zinc-400 block">
                          {formatDate(sub?.lastPaymentDate)}
                        </span>
                      </td>

                      {/* Ações */}
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            variant="ghost"
                            size="sm"
                            title="Ver detalhes completos"
                            onClick={() => openClientDetails(client)}
                            className="h-8 w-8 p-0 text-zinc-400 hover:text-white hover:bg-zinc-800"
                          >
                            <Eye className="w-4 h-4" />
                          </Button>

                          <Button
                            variant="ghost"
                            size="sm"
                            title="Alterar Plano"
                            onClick={() => openChangePlan(client)}
                            className="h-8 w-8 p-0 text-zinc-400 hover:text-primary hover:bg-zinc-800"
                          >
                            <Edit3 className="w-4 h-4" />
                          </Button>

                          <Button
                            variant="ghost"
                            size="sm"
                            title="Renovar / Estender Licença"
                            onClick={() => openRenew(client)}
                            className="h-8 w-8 p-0 text-zinc-400 hover:text-emerald-400 hover:bg-zinc-800"
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
                            className={`h-8 w-8 p-0 hover:bg-zinc-800 ${
                              isSuspended ? "text-emerald-400 hover:text-emerald-300" : "text-zinc-400 hover:text-rose-400"
                            }`}
                          >
                            {isSuspended ? <Play className="w-4 h-4" /> : <Ban className="w-4 h-4" />}
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
        <div className="bg-zinc-950/80 border-t border-zinc-800/80 px-4 py-3 flex items-center justify-between text-xs text-zinc-400">
          <div>
            Mostrando <span className="text-white font-medium">{paginatedClients.length}</span> de{" "}
            <span className="text-white font-medium">{filteredClients.length}</span> clientes
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage <= 1}
              className="h-7 px-2 border-zinc-800 bg-zinc-900 text-zinc-300 disabled:opacity-40"
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <span>
              Página {currentPage} de {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage >= totalPages}
              className="h-7 px-2 border-zinc-800 bg-zinc-900 text-zinc-300 disabled:opacity-40"
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </Card>

      {/* MODAL 1: Novo Cliente */}
      {isNewClientOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl max-w-xl w-full p-6 shadow-2xl space-y-4 my-8 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <div className="flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-primary" />
                <h3 className="text-lg font-bold text-white">Cadastrar Novo Cliente</h3>
              </div>
              <button
                onClick={() => setIsNewClientOpen(false)}
                className="text-zinc-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateClient} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                <div className="space-y-1.5">
                  <Label className="text-xs text-zinc-300">Nome do Cliente *</Label>
                  <Input
                    required
                    placeholder="Ex: João da Silva"
                    value={newClientForm.fullName}
                    onChange={e => setNewClientForm(prev => ({ ...prev, fullName: e.target.value }))}
                    className="bg-zinc-950 border-zinc-800 text-sm"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs text-zinc-300">E-mail de Acesso *</Label>
                  <Input
                    required
                    type="email"
                    placeholder="joao@empresa.com"
                    value={newClientForm.email}
                    onChange={e => setNewClientForm(prev => ({ ...prev, email: e.target.value }))}
                    className="bg-zinc-950 border-zinc-800 text-sm"
                  />
                </div>

                <div className="space-y-1.5 md:col-span-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs text-zinc-300">Senha Inicial *</Label>
                    <button
                      type="button"
                      onClick={generateRandomPassword}
                      className="text-xs text-primary hover:underline flex items-center gap-1"
                    >
                      <Key className="w-3 h-3" /> Gerar senha forte
                    </button>
                  </div>
                  <Input
                    required
                    placeholder="Mínimo 6 caracteres"
                    value={newClientForm.password}
                    onChange={e => setNewClientForm(prev => ({ ...prev, password: e.target.value }))}
                    className="bg-zinc-950 border-zinc-800 text-sm font-mono"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs text-zinc-300">Empresa / Workspace</Label>
                  <Input
                    placeholder="Ex: Agência Digital"
                    value={newClientForm.companyName}
                    onChange={e => setNewClientForm(prev => ({ ...prev, companyName: e.target.value }))}
                    className="bg-zinc-950 border-zinc-800 text-sm"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs text-zinc-300">WhatsApp / Telefone</Label>
                  <Input
                    placeholder="(11) 99999-9999"
                    value={newClientForm.phone}
                    onChange={e => setNewClientForm(prev => ({ ...prev, phone: e.target.value }))}
                    className="bg-zinc-950 border-zinc-800 text-sm"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs text-zinc-300">Plano Contratado *</Label>
                  <select
                    value={newClientForm.planId}
                    onChange={e => setNewClientForm(prev => ({ ...prev, planId: e.target.value }))}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-md px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-primary"
                  >
                    {plans.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.name} — R$ {p.price.toFixed(2)}/mês
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs text-zinc-300">Tipo de Cobrança *</Label>
                  <select
                    value={newClientForm.billingType}
                    onChange={e => setNewClientForm(prev => ({ ...prev, billingType: e.target.value as any }))}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-md px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-primary"
                  >
                    <option value="manual">Pagamento Manual / Direto</option>
                    <option value="mercadopago">Mercado Pago (Assinatura)</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs text-zinc-300">Forma de Pagamento</Label>
                  <select
                    value={newClientForm.paymentMethod}
                    onChange={e => setNewClientForm(prev => ({ ...prev, paymentMethod: e.target.value }))}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-md px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-primary"
                  >
                    <option value="pix">PIX</option>
                    <option value="credit_card">Cartão de Crédito</option>
                    <option value="bank_transfer">Transferência Bancária</option>
                    <option value="manual">Manual / Dinheiro</option>
                    <option value="other">Outro</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs text-zinc-300">Status Inicial</Label>
                  <select
                    value={newClientForm.status}
                    onChange={e => setNewClientForm(prev => ({ ...prev, status: e.target.value as any }))}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-md px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-primary"
                  >
                    <option value="active">Ativo (Liberado)</option>
                    <option value="trialing">Em Teste (Trial)</option>
                  </select>
                </div>

                <div className="space-y-1.5 md:col-span-2">
                  <Label className="text-xs text-zinc-300">Vigência Inicial</Label>
                  <div className="grid grid-cols-4 gap-2">
                    {["30", "60", "90", "365"].map(d => (
                      <button
                        key={d}
                        type="button"
                        onClick={() => setNewClientForm(prev => ({ ...prev, periodDays: d, customEndDate: "" }))}
                        className={`py-1.5 px-3 rounded-md text-xs font-medium border transition-colors ${
                          newClientForm.periodDays === d && !newClientForm.customEndDate
                            ? "bg-primary/20 border-primary text-primary"
                            : "bg-zinc-950 border-zinc-800 text-zinc-400 hover:text-zinc-200"
                        }`}
                      >
                        +{d === "365" ? "1 ano" : `${d} dias`}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-1.5 md:col-span-2">
                  <Label className="text-xs text-zinc-300">Ou Data de Vencimento Específica</Label>
                  <Input
                    type="date"
                    value={newClientForm.customEndDate}
                    onChange={e => setNewClientForm(prev => ({ ...prev, customEndDate: e.target.value }))}
                    className="bg-zinc-950 border-zinc-800 text-sm"
                  />
                </div>

                <div className="space-y-1.5 md:col-span-2">
                  <Label className="text-xs text-zinc-300">Observações Administrativas (Opcional)</Label>
                  <textarea
                    rows={2}
                    placeholder="Ex: Pagamento anual via PIX comprovante #123456"
                    value={newClientForm.notes}
                    onChange={e => setNewClientForm(prev => ({ ...prev, notes: e.target.value }))}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-md p-2 text-sm text-zinc-200 focus:outline-none focus:border-primary resize-none"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-zinc-800">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsNewClientOpen(false)}
                  className="border-zinc-700 text-zinc-300"
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={creatingClient}
                  className="bg-primary text-primary-foreground font-medium"
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

      {/* MODAL 2: Alterar Plano */}
      {isChangePlanOpen && selectedClient && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl max-w-lg w-full p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <div className="flex items-center gap-2">
                <Edit3 className="w-5 h-5 text-primary" />
                <h3 className="text-lg font-bold text-white">Alterar Plano do Cliente</h3>
              </div>
              <button
                onClick={() => setIsChangePlanOpen(false)}
                className="text-zinc-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3 bg-zinc-950 rounded-lg border border-zinc-800 text-xs text-zinc-300 space-y-1">
              <div><strong className="text-white">Cliente:</strong> {selectedClient.fullName} ({selectedClient.email})</div>
              <div><strong className="text-white">Empresa:</strong> {selectedClient.companyName}</div>
              <div><strong className="text-white">Plano Atual:</strong> {selectedClient.subscription?.plan?.name || "Nenhum"}</div>
            </div>

            <div className="space-y-3">
              <Label className="text-xs text-zinc-300">Selecione o Novo Plano:</Label>
              <div className="space-y-2">
                {plans.map(p => {
                  const isSelected = newPlanId === p.id;
                  return (
                    <div
                      key={p.id}
                      onClick={() => setNewPlanId(p.id)}
                      className={`p-3.5 rounded-lg border cursor-pointer transition-all ${
                        isSelected
                          ? "bg-primary/10 border-primary shadow-md shadow-primary/10"
                          : "bg-zinc-950/60 border-zinc-800 hover:border-zinc-700"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-white text-sm">{p.name}</span>
                          {p.slug === "pro" && (
                            <span className="px-1.5 py-0.2 rounded text-[10px] bg-blue-500/20 text-blue-400 font-medium">Recomendado</span>
                          )}
                        </div>
                        <span className="font-bold text-white text-sm">
                          R$ {p.price.toFixed(2)}/mês
                        </span>
                      </div>
                      <p className="text-xs text-zinc-400 mt-1">{p.description}</p>

                      <div className="flex flex-wrap gap-2 mt-2 pt-2 border-t border-zinc-800/80 text-[11px] text-zinc-400">
                        <span>Redes: {p.limits?.max_channels === -1 ? "Ilimitadas" : p.limits?.max_channels || 3}</span>
                        <span>• Posts: {p.limits?.max_posts === -1 ? "Ilimitados" : p.limits?.max_posts || 50}</span>
                        <span>• IA: {p.limits?.ai_automations ? "Liberada" : "Não"}</span>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="space-y-1.5 pt-2">
                <Label className="text-xs text-zinc-300">Motivo da Alteração (Opcional):</Label>
                <Input
                  placeholder="Ex: Upgrade solicitado pelo cliente / Bonificação"
                  value={changePlanReason}
                  onChange={e => setChangePlanReason(e.target.value)}
                  className="bg-zinc-950 border-zinc-800 text-sm"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-zinc-800">
              <Button
                variant="outline"
                onClick={() => setIsChangePlanOpen(false)}
                className="border-zinc-700 text-zinc-300"
              >
                Cancelar
              </Button>
              <Button
                onClick={handleUpdatePlan}
                disabled={updatingPlan || newPlanId === selectedClient.subscription?.planId}
                className="bg-primary text-primary-foreground font-medium"
              >
                {updatingPlan ? "Atualizando..." : "Confirmar Alteração"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: Renovar Licença */}
      {isRenewOpen && selectedClient && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl max-w-lg w-full p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <div className="flex items-center gap-2">
                <ArrowUpRight className="w-5 h-5 text-emerald-400" />
                <h3 className="text-lg font-bold text-white">Renovar / Estender Licença</h3>
              </div>
              <button
                onClick={() => setIsRenewOpen(false)}
                className="text-zinc-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3 bg-zinc-950 rounded-lg border border-zinc-800 text-xs text-zinc-300 space-y-1">
              <div><strong className="text-white">Cliente:</strong> {selectedClient.fullName}</div>
              <div><strong className="text-white">Vencimento Atual:</strong> {formatDate(selectedClient.subscription?.currentPeriodEnd || selectedClient.subscription?.trialEndsAt)}</div>
              <div><strong className="text-white">Plano:</strong> {selectedClient.subscription?.plan?.name || "Starter"}</div>
            </div>

            <div className="space-y-3">
              <Label className="text-xs text-zinc-300">Adicionar Período à Licença:</Label>
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
                        ? "bg-emerald-500/20 border-emerald-500 text-emerald-400 shadow-sm"
                        : "bg-zinc-950 border-zinc-800 text-zinc-400 hover:text-zinc-200"
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>

              <div className="space-y-1.5 pt-1">
                <Label className="text-xs text-zinc-300">Ou Definir Nova Data de Vencimento Específica:</Label>
                <Input
                  type="date"
                  value={renewCustomDate}
                  onChange={e => {
                    setRenewCustomDate(e.target.value);
                    setRenewDays("");
                  }}
                  className="bg-zinc-950 border-zinc-800 text-sm"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs text-zinc-300">Forma de Pagamento Recebida:</Label>
                <select
                  value={renewPaymentMethod}
                  onChange={e => setRenewPaymentMethod(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-md px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-primary"
                >
                  <option value="pix">PIX</option>
                  <option value="credit_card">Cartão de Crédito</option>
                  <option value="bank_transfer">Transferência Bancária</option>
                  <option value="manual">Dinheiro / Outro</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs text-zinc-300">Observações / Comprovante:</Label>
                <Input
                  placeholder="Ex: Renovação trimestral comprovante PIX #987654"
                  value={renewNotes}
                  onChange={e => setRenewNotes(e.target.value)}
                  className="bg-zinc-950 border-zinc-800 text-sm"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-zinc-800">
              <Button
                variant="outline"
                onClick={() => setIsRenewOpen(false)}
                className="border-zinc-700 text-zinc-300"
              >
                Cancelar
              </Button>
              <Button
                onClick={handleRenewLicense}
                disabled={renewing}
                className="bg-emerald-600 hover:bg-emerald-500 text-white font-medium"
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

      {/* MODAL 5: Detalhes do Cliente (Drawer) */}
      {isDetailsOpen && selectedClient && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl max-w-3xl w-full p-6 shadow-2xl space-y-4 my-6 animate-in fade-in zoom-in-95 max-h-[90vh] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3 flex-shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/20 text-primary flex items-center justify-center font-bold text-base">
                  {selectedClient.fullName.charAt(0).toUpperCase()}
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white flex items-center gap-2">
                    {selectedClient.fullName}
                    {renderPlanBadge(selectedClient.subscription?.plan?.slug, selectedClient.subscription?.plan?.name)}
                  </h3>
                  <p className="text-xs text-zinc-400">{selectedClient.email} • {selectedClient.companyName}</p>
                </div>
              </div>
              <button
                onClick={() => setIsDetailsOpen(false)}
                className="text-zinc-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Abas */}
            <div className="flex items-center gap-2 border-b border-zinc-800 pb-2 flex-shrink-0">
              <button
                onClick={() => setDetailsTab("overview")}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  detailsTab === "overview"
                    ? "bg-zinc-800 text-white font-semibold"
                    : "text-zinc-400 hover:text-zinc-200"
                }`}
              >
                Visão Geral & Licença
              </button>
              <button
                onClick={() => setDetailsTab("payments")}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  detailsTab === "payments"
                    ? "bg-zinc-800 text-white font-semibold"
                    : "text-zinc-400 hover:text-zinc-200"
                }`}
              >
                Histórico de Pagamentos ({paymentHistory.length})
              </button>
              <button
                onClick={() => setDetailsTab("audit")}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  detailsTab === "audit"
                    ? "bg-zinc-800 text-white font-semibold"
                    : "text-zinc-400 hover:text-zinc-200"
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
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 bg-zinc-950 p-4 rounded-lg border border-zinc-800 text-xs">
                    <div>
                      <span className="text-zinc-500 block">ID do Usuário:</span>
                      <span className="font-mono text-zinc-300 select-all">{selectedClient.userId}</span>
                    </div>
                    <div>
                      <span className="text-zinc-500 block">ID do Tenant (Workspace):</span>
                      <span className="font-mono text-zinc-300 select-all">{selectedClient.tenantId}</span>
                    </div>
                    <div>
                      <span className="text-zinc-500 block">Data de Cadastro:</span>
                      <span className="text-zinc-300 font-medium">{formatDate(selectedClient.createdAt)}</span>
                    </div>
                    <div>
                      <span className="text-zinc-500 block">Telefone / WhatsApp:</span>
                      <span className="text-zinc-300 font-medium">{selectedClient.phone || "Não informado"}</span>
                    </div>
                  </div>

                  {/* Informações da Licença */}
                  <div className="bg-zinc-950 p-4 rounded-lg border border-zinc-800 space-y-3">
                    <h4 className="text-xs font-bold text-zinc-300 uppercase tracking-wider">
                      Dados da Licença & Assinatura
                    </h4>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                      <div>
                        <span className="text-zinc-500 block">Status Atual:</span>
                        <div className="mt-1">{renderStatusBadge(selectedClient)}</div>
                      </div>
                      <div>
                        <span className="text-zinc-500 block">Tipo de Cobrança:</span>
                        <span className="font-medium text-zinc-200 capitalize block mt-1">
                          {selectedClient.subscription?.billingType === "manual" ? "Manual / Direto" : "Mercado Pago"}
                        </span>
                      </div>
                      <div>
                        <span className="text-zinc-500 block">Forma de Pagamento:</span>
                        <span className="font-medium text-zinc-200 uppercase block mt-1">
                          {selectedClient.subscription?.paymentMethod || "-"}
                        </span>
                      </div>
                      <div>
                        <span className="text-zinc-500 block">Início da Vigência:</span>
                        <span className="font-medium text-zinc-200 block mt-1">
                          {formatDate(selectedClient.subscription?.currentPeriodStart)}
                        </span>
                      </div>
                      <div>
                        <span className="text-zinc-500 block">Vencimento da Licença:</span>
                        <span className="font-medium text-zinc-200 block mt-1">
                          {formatDate(selectedClient.subscription?.currentPeriodEnd || selectedClient.subscription?.trialEndsAt)}
                        </span>
                      </div>
                      <div>
                        <span className="text-zinc-500 block">Último Pagamento:</span>
                        <span className="font-medium text-zinc-200 block mt-1">
                          {formatDate(selectedClient.subscription?.lastPaymentDate)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Observações Administrativas */}
                  <div className="bg-zinc-950 p-4 rounded-lg border border-zinc-800 space-y-2">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-bold text-zinc-300 uppercase tracking-wider">
                        Observações Administrativas
                      </h4>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={handleSaveNotes}
                        disabled={savingNotes}
                        className="h-7 text-xs text-primary hover:text-primary/80"
                      >
                        {savingNotes ? "Salvando..." : "Salvar Notas"}
                      </Button>
                    </div>
                    <textarea
                      rows={3}
                      value={clientNotesInput}
                      onChange={e => setClientNotesInput(e.target.value)}
                      placeholder="Adicione anotações sobre este cliente, acordos, dados bancários de comprovante..."
                      className="w-full bg-zinc-900 border border-zinc-800 rounded-md p-2.5 text-xs text-zinc-200 focus:outline-none focus:border-primary resize-none"
                    />
                  </div>
                </div>
              )}

              {detailsTab === "payments" && (
                <div className="space-y-3">
                  {loadingDetailsData ? (
                    <div className="text-center py-8 text-zinc-400 text-xs">Carregando histórico financeiro...</div>
                  ) : paymentHistory.length === 0 ? (
                    <div className="text-center py-8 text-zinc-500 text-xs">
                      Nenhum pagamento registrado para este cliente.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {paymentHistory.map(p => (
                        <div key={p.id} className="p-3 bg-zinc-950 rounded-lg border border-zinc-800 flex items-center justify-between text-xs">
                          <div>
                            <span className="font-bold text-white text-sm">
                              R$ {Number(p.amount || 0).toFixed(2)}
                            </span>
                            <span className="text-zinc-400 ml-2">
                              • {p.payment_method?.toUpperCase() || "MANUAL"}
                            </span>
                            <span className="text-zinc-500 block text-[11px] mt-0.5">
                              {new Date(p.created_at).toLocaleString("pt-BR")}
                            </span>
                          </div>
                          <div>
                            <span className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase ${
                              p.status === "approved"
                                ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                                : "bg-zinc-800 text-zinc-400"
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
                    <div className="text-center py-8 text-zinc-400 text-xs">Carregando histórico de auditoria...</div>
                  ) : auditLogs.length === 0 ? (
                    <div className="text-center py-8 text-zinc-500 text-xs">
                      Nenhuma ação administrativa registrada para este cliente.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {auditLogs.map(log => (
                        <div key={log.id} className="p-3 bg-zinc-950 rounded-lg border border-zinc-800 text-xs space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="font-semibold text-primary uppercase text-[11px]">
                              {log.action.replace("_", " ")}
                            </span>
                            <span className="text-zinc-500 text-[10px]">
                              {new Date(log.created_at).toLocaleString("pt-BR")}
                            </span>
                          </div>
                          <p className="text-zinc-400 text-[11px]">
                            Executado por: <strong className="text-zinc-300">{log.admin_email}</strong>
                          </p>
                          {log.details && (
                            <pre className="p-2 bg-zinc-900/80 rounded border border-zinc-800/60 text-[10px] text-zinc-400 overflow-x-auto">
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
            <div className="border-t border-zinc-800 pt-3 flex items-center justify-between flex-shrink-0">
              <Button
                variant="destructive"
                size="sm"
                onClick={() => {
                  setIsDetailsOpen(false);
                  setIsDeleteModalOpen(true);
                }}
                className="text-xs bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 border border-rose-500/30"
              >
                <Trash2 className="w-3.5 h-3.5 mr-1.5" /> Excluir Cliente Definitivamente
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsDetailsOpen(false)}
                className="border-zinc-700 text-zinc-300"
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
        message={`ATENÇÃO: Deseja realmente excluir permanentemente o cliente ${selectedClient?.fullName} (${selectedClient?.email}) e todos os seus dados, canais, mensagens e configurações? Esta ação é irreversível.`}
        confirmLabel="Excluir Definitivamente"
        variant="danger"
        onConfirm={handleDeleteClient}
        onCancel={() => setIsDeleteModalOpen(false)}
      />
    </div>
  );
}
