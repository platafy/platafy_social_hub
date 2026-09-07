import { useState } from "react";
import { Link } from "react-router-dom";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card";
import { BrandLogo } from "@/components/BrandLogo";
import { toast } from "sonner";
import { Loader2, CheckCircle2, AlertCircle, Mail, ArrowLeft } from "lucide-react";

const schema = z.object({
  email: z.string().trim().min(1, "Informe seu email").email("E-mail inválido").max(255),
});

type Status = "idle" | "loading" | "success" | "error";

export default function RecuperarSenha() {
  const [email, setEmail] = useState("");
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState<string>("");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFieldError(null);

    const parsed = schema.safeParse({ email });
    if (!parsed.success) {
      setFieldError(parsed.error.issues[0]?.message ?? "E-mail inválido");
      return;
    }

    setStatus("loading");
    const { data, error } = await supabase.functions.invoke("recuperacao-senha", {
      body: {
        email: parsed.data.email,
        redirect_to: window.location.origin + "/#/login",
      },
    });

    if (error || data?.error) {
      const msg = data?.error ?? error?.message ?? "Erro ao enviar email";
      setStatus("error");
      setMessage(msg);
      toast.error(msg);
      return;
    }

    setStatus("success");
    setMessage("Se o e-mail existir em nossa base, você receberá um link de recuperação.");
    toast.success("E-mail enviado");
  }

  const loading = status === "loading";

  return (
    <div className="min-h-[85vh] flex flex-col items-center justify-center px-4 py-8 relative">
      {/* Background ambient decorative glow */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-72 h-72 bg-primary/10 rounded-full blur-3xl pointer-events-none -z-10" />

      <BrandLogo size="lg" className="mb-6" />

      <Card className="w-full max-w-[420px] border border-border/80 shadow-xl rounded-3xl bg-card/90 backdrop-blur-md">
        <CardHeader className="space-y-2 pb-5 text-center">
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-foreground">Recuperar senha</h1>
          <CardDescription className="text-muted-foreground text-xs sm:text-sm">
            Enviaremos as instruções de redefinição para o seu e-mail
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-4" noValidate>
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                <Mail className="h-3.5 w-3.5 text-primary" /> E-mail da conta
              </Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                placeholder="nome@exemplo.com"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (fieldError) setFieldError(null);
                }}
                disabled={loading}
                aria-invalid={!!fieldError}
                className="h-11 bg-background/80"
              />
              {fieldError && (
                <p className="text-xs text-destructive font-medium">{fieldError}</p>
              )}
            </div>

            {status === "success" && (
              <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3.5 flex items-start gap-2.5 text-xs text-emerald-700 dark:text-emerald-400">
                <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
                <p>{message}</p>
              </div>
            )}

            {status === "error" && (
              <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-3.5 flex items-start gap-2.5 text-xs text-destructive">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <p>{message}</p>
              </div>
            )}

            <Button type="submit" className="w-full h-11 font-bold rounded-xl shadow-sm hover:shadow transition-all gap-2" disabled={loading}>
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              {loading ? "Enviando instruções..." : "Enviar Link de Redefinição"}
            </Button>

            <div className="text-center text-xs sm:text-sm pt-2">
              <Link to="/login" className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 font-medium transition-colors">
                <ArrowLeft className="h-3.5 w-3.5" /> Voltar ao Login
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}