import { useTheme } from "@/contexts/ThemeContext";
import { Sun, Moon } from "lucide-react";

interface ThemeToggleProps {
  className?: string;
  showLabel?: boolean;
}

export function ThemeToggle({ className = "", showLabel = false }: ThemeToggleProps) {
  const { resolvedTheme, toggleTheme } = useTheme();

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className={`inline-flex items-center justify-center rounded-xl p-2 text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition-all active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 border border-border/50 bg-card/60 shadow-2xs ${className}`}
      title={resolvedTheme === "dark" ? "Alternar para Modo Claro" : "Alternar para Modo Escuro"}
      aria-label="Alternar tema da interface"
    >
      {resolvedTheme === "dark" ? (
        <Sun className="h-4 w-4 text-amber-400 transition-transform duration-200 rotate-0 hover:rotate-45" />
      ) : (
        <Moon className="h-4 w-4 text-indigo-500 transition-transform duration-200 -rotate-12 hover:rotate-0" />
      )}
      {showLabel && (
        <span className="ml-2 text-xs font-medium">
          {resolvedTheme === "dark" ? "Modo Claro" : "Modo Escuro"}
        </span>
      )}
    </button>
  );
}
