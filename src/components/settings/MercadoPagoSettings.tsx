import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { 
  CreditCard, Key, CheckCircle2, Copy, RefreshCw,
  ShieldCheck, Eye, EyeOff
} from "lucide-react";

export function MercadoPagoSettings() {
  const [accessToken, setAccessToken] = useState("");
  const [publicKey, setPublicKey] = useState("");
  const [webhookSecret, setWebhookSecret] = useState("");
  const [trialDays, setTrialDays] = useState(7);

  const [showToken, setShowToken] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [connectedUser, setConnectedUser] = useState<string | null>(null);

  const webhookUrl = `${import.meta.env.VITE_SUPABASE_URL || "https://sabzbazyxfxorrfshhgf.supabase.co"}/functions/v1/mercadopago-webhook`;

  // Carregar credenciais existentes do banco
  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const { data, error } = await (supabase.from("platform_settings" as any) as any)
          .select("*")
          .limit(1)
          .maybeSingle();

        if (error) {
          console.warn("Erro ao buscar platform_settings:", error);
          return;
        }

        if (data) {
          setAccessToken(data.mercadopago_access_token || "");
          setPublicKey(data.mercadopago_public_key || "");
          setWebhookSecret(data.mercadopago_webhook_secret || "");
          setTrialDays(data.trial_days || 7);

          if (data.mercadopago_access_token) {
            testMercadoPagoConnection(data.mercadopago_access_token);
          }
        }
      } catch (err) {
        console.error("Erro:", err);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function testMercadoPagoConnection(tokenToTest: string) {
    if (!tokenToTest) return;
    setTesting(true);
    try {
      const res = await fetch("https://api.mercadopago.com/users/me", {
        headers: {
          Authorization: `Bearer ${tokenToTest}`,
        },
      });

      if (res.ok) {
        const data = await res.json();
        setConnectedUser(data.nickname || data.first_name || data.email || "Conta Conectada");
      } else {
        setConnectedUser(null);
      }
    } catch {
      setConnectedUser(null);
    } finally {
      setTesting(false);
    }
  }

  async function handleSave() {
    setSaving(true);
    try {
      const { data: existing } = await (supabase.from("platform_settings" as any) as any)
        .select("id")
        .limit(1)
        .maybeSingle();

      const payload = {
        mercadopago_access_token: accessToken.trim(),
        mercadopago_public_key: publicKey.trim(),
        mercadopago_webhook_secret: webhookSecret.trim(),
        trial_days: Number(trialDays) || 7,
        updated_at: new Date().toISOString(),
      };

      if (existing?.id) {
        const { error } = await (supabase.from("platform_settings" as any) as any)
          .update(payload)
          .eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await (supabase.from("platform_settings" as any) as any).insert(payload);
        if (error) throw error;
      }

      toast.success("Credenciais do Mercado Pago salvas com sucesso!");
      testMercadoPagoConnection(accessToken.trim());
    } catch (err: any) {
      console.error("Erro ao salvar Mercado Pago:", err);
      toast.error(err.message || "Erro ao salvar credenciais.");
    } finally {
      setSaving(false);
    }
  }

  function copyWebhookUrl() {
    navigator.clipboard.writeText(webhookUrl);
    toast.success("URL do Webhook copiada para a área de transferência!");
  }

  return (
    <Card className="border border-border/70 shadow-sm bg-card">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-primary" />
              <CardTitle className="text-xl">Configuração do Mercado Pago (SaaS)</CardTitle>
            </div>
            <CardDescription>
              Configure sua conta do Mercado Pago para receber pagamentos e assinaturas de clientes.
            </CardDescription>
          </div>
          {connectedUser && (
            <span className="text-xs bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold px-3 py-1 rounded-full flex items-center gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5" /> Conectado ({connectedUser})
            </span>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* 1. Access Token */}
        <div className="space-y-2">
          <Label htmlFor="mpToken" className="text-sm font-semibold flex items-center gap-1.5">
            <Key className="h-4 w-4 text-primary" />
            Mercado Pago Access Token (Produção ou Teste)
          </Label>
          <div className="relative">
            <Input
              id="mpToken"
              type={showToken ? "text" : "password"}
              placeholder="APP_USR-xxxxxxxxxxxxxxxxxxxxxx ou TEST-xxxxxxxxxx"
              value={accessToken}
              onChange={(e) => setAccessToken(e.target.value)}
              className="h-10 pr-10 font-mono text-xs"
            />
            <button
              type="button"
              onClick={() => setShowToken(!showToken)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              {showToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Encontre em <strong>Mercado Pago Developers → Suas Aplicações → Credenciais de Produção</strong>.
          </p>
        </div>

        {/* 2. Public Key & Dias de Trial */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="mpPubKey" className="text-sm font-semibold">
              Public Key (Opcional)
            </Label>
            <Input
              id="mpPubKey"
              placeholder="APP_USR-xxxxxxxx ou TEST-xxxxxxxx"
              value={publicKey}
              onChange={(e) => setPublicKey(e.target.value)}
              className="h-10 font-mono text-xs"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="trialDays" className="text-sm font-semibold">
              Dias de Teste Gratuito (Trial)
            </Label>
            <Input
              id="trialDays"
              type="number"
              min={0}
              max={30}
              value={trialDays}
              onChange={(e) => setTrialDays(Number(e.target.value))}
              className="h-10"
            />
            <p className="text-[11px] text-muted-foreground">
              Dias concedidos automaticamente a cada novo cadastro (padrão: 7 dias).
            </p>
          </div>
        </div>

        {/* 3. URL do Webhook */}
        <div className="space-y-2 pt-2 border-t border-border/50">
          <Label className="text-sm font-semibold flex items-center gap-1.5">
            <ShieldCheck className="h-4 w-4 text-primary" />
            URL de Notificação / Webhook do Mercado Pago
          </Label>
          <div className="flex gap-2">
            <Input
              readOnly
              value={webhookUrl}
              className="h-10 font-mono text-xs bg-muted/40 text-muted-foreground"
            />
            <Button
              type="button"
              variant="outline"
              onClick={copyWebhookUrl}
              className="gap-1.5 shrink-0"
            >
              <Copy className="h-4 w-4" /> Copiar
            </Button>
          </div>
          <p className="text-[11px] text-muted-foreground">
            No painel do Mercado Pago, configure essa URL no campo <strong>Notificações Webhooks</strong> para os eventos de <strong>Pagamentos (Payments)</strong>.
          </p>
        </div>
      </CardContent>

      <CardFooter className="flex justify-between gap-3 pt-2 border-t border-border/40">
        <Button
          type="button"
          variant="outline"
          onClick={() => testMercadoPagoConnection(accessToken)}
          disabled={testing || !accessToken}
          className="gap-2 text-xs"
        >
          {testing && <RefreshCw className="h-3.5 w-3.5 animate-spin" />}
          Testar Conexão
        </Button>

        <Button
          onClick={handleSave}
          disabled={saving || loading}
          className="gap-2 px-6 font-semibold"
        >
          {saving ? "Salvando..." : "Salvar Configurações do Mercado Pago"}
        </Button>
      </CardFooter>
    </Card>
  );
}
