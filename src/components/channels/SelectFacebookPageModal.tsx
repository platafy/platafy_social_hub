import { useState, useEffect } from "react";
import { zernio } from "@/lib/zernio";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { SiFacebook } from "react-icons/si";
import { Check, Loader2, X, AlertCircle } from "lucide-react";

interface FacebookPage {
  id: string;
  name: string;
  username?: string;
  category?: string;
  access_token?: string;
  tasks?: string[];
}

interface SelectFacebookPageModalProps {
  isOpen: boolean;
  onClose: () => void;
  profileId: string;
  tempToken: string;
  integrationId?: string;
  onSuccess: (accountData?: any) => void;
}

export function SelectFacebookPageModal({
  isOpen,
  onClose,
  profileId,
  tempToken,
  integrationId,
  onSuccess,
}: SelectFacebookPageModalProps) {
  const [pages, setPages] = useState<FacebookPage[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [selectedPageId, setSelectedPageId] = useState<string>("");
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    if (!isOpen || !tempToken || !profileId) return;

    let isMounted = true;
    setLoading(true);
    setErrorMessage("");

    zernio
      .getFacebookPages(profileId, tempToken, integrationId)
      .then((res: any) => {
        if (!isMounted) return;
        const pageList: FacebookPage[] = res?.pages || [];
        setPages(pageList);
        if (pageList.length > 0) {
          setSelectedPageId(pageList[0].id);
        } else {
          setErrorMessage("Nenhuma página do Facebook com permissões de administrador foi encontrada.");
        }
      })
      .catch((err: any) => {
        if (!isMounted) return;
        console.error("Erro ao listar páginas do Facebook:", err);
        setErrorMessage(err.message || "Não foi possível carregar as páginas do Facebook.");
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen, tempToken, profileId, integrationId]);

  if (!isOpen) return null;

  const handleConfirm = async () => {
    if (!selectedPageId) {
      toast.error("Selecione uma página para continuar.");
      return;
    }

    const pageObj = pages.find((p) => p.id === selectedPageId);
    if (!pageObj) return;

    setSubmitting(true);
    try {
      const res = await zernio.selectFacebookPage(
        {
          profileId,
          pageId: selectedPageId,
          tempToken,
          userProfile: {
            id: pageObj.id,
            name: pageObj.name,
          },
        },
        integrationId
      );

      toast.success(`Página "${pageObj.name}" conectada com sucesso!`);
      onSuccess(res);
      onClose();
    } catch (err: any) {
      console.error("Erro ao selecionar página do Facebook:", err);
      toast.error(err.message || "Erro ao vincular página do Facebook.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
      <div className="bg-card border border-border rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-5 animate-in zoom-in-95">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border pb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-blue-600/10 text-blue-600 dark:text-blue-400">
              <SiFacebook className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-foreground">Escolha a Página</h3>
              <p className="text-[11px] text-muted-foreground">
                Selecione a página do Facebook para vincular a este perfil
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground p-1 rounded-lg hover:bg-muted transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        {loading ? (
          <div className="py-10 text-center space-y-3">
            <Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" />
            <p className="text-xs text-muted-foreground font-medium">
              Carregando suas páginas do Facebook...
            </p>
          </div>
        ) : errorMessage ? (
          <div className="p-4 rounded-2xl bg-destructive/10 border border-destructive/20 text-xs text-destructive space-y-2">
            <div className="flex items-center gap-2 font-semibold">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>Atenção</span>
            </div>
            <p className="text-[11px] leading-relaxed">{errorMessage}</p>
          </div>
        ) : (
          <div className="space-y-3 max-h-64 overflow-y-auto pr-1">
            {pages.map((page) => {
              const isSelected = selectedPageId === page.id;
              return (
                <div
                  key={page.id}
                  onClick={() => setSelectedPageId(page.id)}
                  className={`p-3.5 rounded-2xl border cursor-pointer transition-all flex items-center justify-between gap-3 ${
                    isSelected
                      ? "border-primary bg-primary/10 shadow-xs"
                      : "border-border/70 bg-card hover:border-border hover:bg-muted/30"
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold truncate text-foreground">
                      {page.name}
                    </p>
                    <p className="text-[11px] text-muted-foreground truncate">
                      {page.category || (page.username ? `@${page.username}` : `ID: ${page.id}`)}
                    </p>
                  </div>
                  <div
                    className={`w-5 h-5 rounded-full flex items-center justify-center border transition-all ${
                      isSelected
                        ? "bg-primary border-primary text-primary-foreground"
                        : "border-muted-foreground/40 bg-background"
                    }`}
                  >
                    {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-border">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            className="rounded-xl text-xs"
          >
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={handleConfirm}
            disabled={submitting || loading || !selectedPageId}
            className="rounded-xl bg-primary text-xs font-bold shadow-xs cursor-pointer"
          >
            {submitting ? (
              <>
                <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
                Conectando...
              </>
            ) : (
              "Vincular Página"
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
