import { useEffect, useState } from "react";
import { CheckCircle2, AlertCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function OAuthCallback() {
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [errorMessage, setErrorMessage] = useState("");
  const [platform, setPlatform] = useState("");

  useEffect(() => {
    try {
      const searchParams = new URLSearchParams(window.location.search);
      const hashIndex = window.location.hash.indexOf("?");
      const hashParams =
        hashIndex !== -1
          ? new URLSearchParams(window.location.hash.substring(hashIndex))
          : new URLSearchParams();

      const getParam = (name: string) =>
        searchParams.get(name) || hashParams.get(name) || "";

      const connected = getParam("connected");
      const accountId = getParam("accountId");
      const profileId = getParam("profileId");
      const username = getParam("username");
      const error = getParam("error");
      const rawErrorMsg = getParam("error_message");
      const tempToken = getParam("tempToken");
      const step = getParam("step");
      const pendingDataToken = getParam("pendingDataToken");

      const currentPlatform = connected || getParam("platform") || "rede social";
      setPlatform(currentPlatform);

      const payload = {
        type: "ZERNIO_OAUTH_CALLBACK",
        connected,
        accountId,
        profileId,
        username,
        error,
        errorMessage: rawErrorMsg,
        tempToken,
        step,
        pendingDataToken,
      };

      if (error) {
        setStatus("error");
        setErrorMessage(rawErrorMsg || `Erro na autorização (${error}).`);
      } else {
        setStatus("success");
      }

      // Se foi aberto via popup, despachar para a janela principal
      if (window.opener && !window.opener.closed) {
        try {
          window.opener.postMessage(payload, "*");
        } catch (e) {
          console.error("Falha ao comunicar com a janela pai:", e);
        }
        setTimeout(() => {
          window.close();
        }, 600);
      } else {
        // Redirecionamento de página inteira (Mobile)
        try {
          sessionStorage.setItem("zernio_last_oauth_callback", JSON.stringify(payload));
        } catch (e) {
          // ignore
        }

        if (!error) {
          setTimeout(() => {
            window.location.href = `${window.location.origin}${window.location.pathname}#/channels?connected=${encodeURIComponent(connected)}&accountId=${encodeURIComponent(accountId)}`;
          }, 800);
        }
      }
    } catch (err: any) {
      setStatus("error");
      setErrorMessage(err.message || "Falha ao processar callback.");
    }
  }, []);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-background text-foreground">
      <div className="max-w-md w-full p-8 rounded-3xl border border-border bg-card shadow-xl text-center space-y-5">
        {status === "loading" && (
          <>
            <div className="w-12 h-12 rounded-full border-4 border-primary/20 border-t-primary animate-spin mx-auto" />
            <h2 className="text-lg font-bold">Conectando sua conta...</h2>
            <p className="text-xs text-muted-foreground">
              Aguarde enquanto finalizamos a integração de forma segura.
            </p>
          </>
        )}

        {status === "success" && (
          <>
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center mx-auto border border-emerald-500/20">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <h2 className="text-lg font-bold text-emerald-600 dark:text-emerald-400">
              Conexão realizada com sucesso!
            </h2>
            <p className="text-xs text-muted-foreground">
              Sua conta {platform ? `(${platform})` : ""} foi autorizada. Fechando esta janela...
            </p>
          </>
        )}

        {status === "error" && (
          <>
            <div className="w-12 h-12 rounded-2xl bg-destructive/10 text-destructive flex items-center justify-center mx-auto border border-destructive/20">
              <AlertCircle className="w-6 h-6" />
            </div>
            <h2 className="text-lg font-bold text-destructive">Falha na Conexão</h2>
            <p className="text-xs text-muted-foreground leading-relaxed">
              {errorMessage}
            </p>
            <div className="pt-2">
              <Button
                onClick={() => {
                  if (window.opener && !window.opener.closed) {
                    window.close();
                  } else {
                    window.location.href = "/";
                  }
                }}
                className="w-full rounded-xl"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Voltar para o Painel
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
