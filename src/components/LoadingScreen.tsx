import { useState, useEffect } from "react";
import { useBranding } from "@/contexts/BrandingContext";

interface LoadingScreenProps {
  fullScreen?: boolean;
  message?: string;
  className?: string;
}

export function LoadingScreen({ fullScreen = true, message, className = "" }: LoadingScreenProps) {
  const { branding } = useBranding();

  // Prioriza o Favicon (Ícone White Label) configurado na Personalização White Label.
  // Caso não exista, utiliza o Logotipo Principal e, por fim, a logo padrão /logo.png.
  const getInitialSrc = () => branding.favicon_url || branding.logo_url || "/logo.png";

  const [currentSrc, setCurrentSrc] = useState<string>(getInitialSrc);

  useEffect(() => {
    setCurrentSrc(getInitialSrc());
  }, [branding.favicon_url, branding.logo_url]);

  const handleError = () => {
    // Se falhar o favicon, tenta a logo principal; se falhar ou já for ela, vai para /logo.png
    if (currentSrc === branding.favicon_url && branding.logo_url) {
      setCurrentSrc(branding.logo_url);
    } else if (currentSrc !== "/logo.png") {
      setCurrentSrc("/logo.png");
    }
  };

  const containerClasses = fullScreen
    ? "fixed inset-0 z-50 flex flex-col items-center justify-center bg-background"
    : "flex flex-col items-center justify-center min-h-[60vh] w-full text-center py-12";

  return (
    <div className={`${containerClasses} ${className}`}>
      <div className="relative flex items-center justify-center">
        {/* Círculo giratório com a cor primária configurada no White Label */}
        <div className="absolute h-20 w-20 rounded-full border-2 border-primary/20 border-t-primary animate-spin" />
        
        {/* Ícone White Label com efeito pulse centralizado */}
        <img
          src={currentSrc}
          alt={branding.app_name || "Carregando..."}
          className="h-12 w-12 object-contain animate-pulse rounded-full p-1"
          onError={handleError}
        />
      </div>

      {message && (
        <p className="mt-5 text-xs sm:text-sm font-medium text-muted-foreground animate-pulse tracking-wide">
          {message}
        </p>
      )}
    </div>
  );
}
