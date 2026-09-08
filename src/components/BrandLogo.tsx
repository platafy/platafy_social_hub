import { useBranding } from "@/contexts/BrandingContext";

interface BrandLogoProps {
  size?: "sm" | "md" | "lg";
  showTagline?: boolean;
  className?: string;
  imageOnly?: boolean;
}

export function BrandLogo({
  size = "md",
  showTagline = true,
  className = "",
  imageOnly = false,
}: BrandLogoProps) {
  const { branding } = useBranding();

  const logoSizes = {
    sm: "h-5 w-5",
    md: "h-7 w-7",
    lg: "h-11 w-11",
  };

  const textSizes = {
    sm: "text-lg font-bold",
    md: "text-xl font-extrabold tracking-tight",
    lg: "text-2xl font-black tracking-tight",
  };

  const badgeSizes = {
    sm: "text-[10px] px-1 py-0.2",
    md: "text-xs px-1.5 py-0.5",
    lg: "text-xs px-2 py-0.5",
  };

  const logoSrc = branding.logo_url || branding.favicon_url || "/logo.png";

  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
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
          <span className={`${textSizes[size]} text-foreground transition-colors`}>
            {branding.app_name || "Social Hub"}
          </span>
          {showTagline && branding.app_tagline && (
            <span
              className={`${badgeSizes[size]} bg-primary/15 text-primary font-bold rounded uppercase tracking-wider transition-colors`}
            >
              {branding.app_tagline}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
