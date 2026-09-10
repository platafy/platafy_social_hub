import { useBranding } from "@/contexts/BrandingContext";

interface BrandLogoProps {
  size?: "sm" | "md" | "lg" | "xl" | "2xl";
  showTagline?: boolean;
  className?: string;
  imageOnly?: boolean;
  textColor?: string;
  taglineColor?: string;
}

export function BrandLogo({
  size = "md",
  showTagline = true,
  className = "",
  imageOnly = false,
  textColor,
  taglineColor,
}: BrandLogoProps) {
  const { branding } = useBranding();

  const logoSizes = {
    sm: "h-5 w-5",
    md: "h-7 w-7",
    lg: "h-11 w-11",
    xl: "h-14 w-14",
    "2xl": "h-18 w-18",
  };

  const textSizes = {
    sm: "text-lg font-bold",
    md: "text-xl font-extrabold tracking-tight",
    lg: "text-2xl font-black tracking-tight",
    xl: "text-3xl font-black tracking-tight",
    "2xl": "text-4xl font-black tracking-tight",
  };

  const badgeSizes = {
    sm: "text-[10px] px-1 py-0.2",
    md: "text-xs px-1.5 py-0.5",
    lg: "text-xs px-2 py-0.5",
    xl: "text-xs px-2.5 py-0.5",
    "2xl": "text-sm px-3 py-1",
  };

  const gapSizes = {
    sm: "gap-1.5",
    md: "gap-2.5",
    lg: "gap-3",
    xl: "gap-3.5",
    "2xl": "gap-4",
  };

  const logoSrc = branding.logo_url || branding.favicon_url || "/logo.png";

  // Determina a classe de cor do texto: prioriza textColor, ou classe de cor explícita se houver no className, senão fallback para text-foreground
  const hasExplicitTextColor = /\btext-(?:white|black|slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|primary|foreground)\b/.test(className);
  const resolvedTextColor = textColor || (hasExplicitTextColor ? "" : "text-foreground");

  return (
    <div className={`flex items-center ${gapSizes[size]} ${className}`}>
      <img
        src={logoSrc}
        alt={branding.app_name}
        className={`${logoSizes[size]} object-contain rounded-md transition-transform hover:scale-105`}
        onError={(e) => {
          // Fallback gracioso: se a logo falhar, tenta o favicon; se falhar, tenta /logo.png
          const target = e.currentTarget as HTMLImageElement;
          if (branding.favicon_url && target.src !== branding.favicon_url && target.src !== window.location.origin + branding.favicon_url) {
            target.src = branding.favicon_url;
          } else if (target.src !== window.location.origin + "/logo.png") {
            target.src = "/logo.png";
          }
        }}
      />
      {!imageOnly && (
        <div className="flex items-center gap-1.5">
          <span className={`${textSizes[size]} ${resolvedTextColor} transition-colors`}>
            {branding.app_name || "PLATAFY Social"}
          </span>
          {showTagline && branding.app_tagline && (
            <span
              className={`${badgeSizes[size]} ${taglineColor || "bg-primary/15 text-primary"} font-bold rounded uppercase tracking-wider transition-colors`}
            >
              {branding.app_tagline}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
