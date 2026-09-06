import { useState } from "react";
import { Link } from "react-router-dom";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { toast } from "sonner";
import { Loader2, CheckCircle2, AlertCircle } from "lucide-react";

const schema = z.object({
  email: z.string().trim().min(1, "Informe seu email").email("Email invalido").max(255),
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
      setFieldError(parsed.error.issues[0]?.message ?? "Email invalido");
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
    setMessage("Se o email existir, enviaremos instrucoes para redefinir a senha.");
    toast.success("Email enviado");
  }

  const loading = status === "loading";

  return (
    <div className="min-h-screen grid place-items-center bg-background px-6">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <h1 className="text-2xl font-semibold leading-none tracking-tight">Recuperar senha de acesso</h1>
          <CardDescription>Enviaremos um link de recuperacao para o seu email</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-4" noValidate>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (fieldError) setFieldError(null);
                }}
                disabled={loading}
                aria-invalid={!!fieldError}
              />
              {fieldError && (
                <p className="text-xs text-destructive">{fieldError}</p>
              )}
            </div>

            {status === "success" && (
              <Alert>
                <CheckCircle2 className="h-4 w-4" />
                <AlertTitle>Pronto!</AlertTitle>
                <AlertDescription>{message}</AlertDescription>
              </Alert>
            )}
            {status === "error" && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Nao foi possivel enviar</AlertTitle>
                <AlertDescription>{message}</AlertDescription>
              </Alert>
            )}

            <Button type="submit" className="w-full" disabled={loading}>
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              {loading ? "Enviando..." : "Enviar link"}
            </Button>
            <p className="text-sm text-center">
              <Link to="/login" className="text-primary hover:underline">Voltar ao login</Link>
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}