import { Link } from "react-router-dom";
import { ArrowLeft, Compass } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] text-center px-4">
      <div className="p-4 rounded-2xl bg-primary/10 border border-primary/20 text-primary mb-5">
        <Compass className="h-10 w-10 animate-spin [animation-duration:12s]" />
      </div>
      <h1 className="text-5xl sm:text-6xl font-black tracking-tight text-foreground mb-2">404</h1>
      <h2 className="text-xl font-bold text-foreground mb-2">Página não encontrada</h2>
      <p className="text-sm text-muted-foreground max-w-sm mb-6">
        O link que você tentou acessar não existe ou foi movido para outro endereço.
      </p>
      <Link to="/">
        <Button className="gap-2 font-semibold shadow-xs">
          <ArrowLeft className="h-4 w-4" /> Voltar ao Painel
        </Button>
      </Link>
    </div>
  );
}