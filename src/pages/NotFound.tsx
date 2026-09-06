import { Link } from "react-router-dom";

export default function NotFound() {
  return (
    <section className="space-y-4 text-center py-20">
      <h1 className="text-6xl font-bold">404</h1>
      <p className="text-muted-foreground">Pagina nao encontrada.</p>
      <Link
        to="/"
        className="inline-block rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
      >
        Voltar ao inicio
      </Link>
    </section>
  );
}