import React, { useEffect, useMemo, useState } from "react";
import { Search, X } from "lucide-react";
import ProductCard from "./ProductCard";
import api from "@/lib/api";

const FILTERS = [
  { id: "todos", label: "Tudo" },
  { id: "pronta", label: "Pronta Entrega" },
  { id: "encomenda", label: "Sob Encomenda" },
  { id: "manto", label: "Mantos" },
  { id: "chuteira", label: "Chuteiras" },
];

export default function ProductGallery() {
  const [filter, setFilter] = useState("todos");
  const [search, setSearch] = useState("");
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let mounted = true;
    api
      .get("/products")
      .then(({ data }) => {
        if (!mounted) return;
        // na loja só aparecem produtos ativos (pronta entrega esgotada
        // continua visível, o cliente escolhe outro tamanho; encomenda
        // não depende de estoque)
        setProducts(data.filter((p) => p.active));
      })
      .catch(() => mounted && setError(true))
      .finally(() => mounted && setLoading(false));
    return () => {
      mounted = false;
    };
  }, []);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return products.filter((p) => {
      const matchesFilter = filter === "todos" || p.type === filter || p.category === filter;
      const matchesSearch = !term || p.name?.toLowerCase().includes(term);
      return matchesFilter && matchesSearch;
    });
  }, [filter, search, products]);

  return (
    <section id="produtos" className="relative overflow-hidden py-20 sm:py-28">
      <div className="pointer-events-none absolute inset-x-0 top-8 select-none text-center font-heading text-[22vw] uppercase leading-none text-white/[0.025]">
        ARSENAL
      </div>

      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <header className="mb-10 text-center">
          <p className="text-xs uppercase tracking-[0.4em] text-neon"> Arsenal Do Manto</p>
          <h2 className="mt-2 font-heading text-3xl uppercase tracking-wide text-white sm:text-5xl">
            Escolha seu Manto
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-sm text-muted-foreground">
            Mantos e chuteiras a pronta entrega ou sob encomenda, com
            personalização. Selecione o tamanho e adicione ao pedido.
          </p>
        </header>

        <div className="sticky top-16 z-20 mx-auto mb-6 flex w-full max-w-md items-center gap-2 rounded-full border border-border bg-card/80 px-4 py-2 backdrop-blur">
          <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nome (ex: Phantom, Vapor...)"
            className="w-full bg-transparent text-base text-white placeholder:text-muted-foreground focus:outline-none sm:text-sm"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              aria-label="Limpar busca"
              className="shrink-0 text-muted-foreground hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        <div className="sticky top-16 z-20 mx-auto mb-10 flex w-fit max-w-full flex-wrap justify-center gap-1.5 rounded-full border border-border bg-card/80 p-1.5 backdrop-blur">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className={`rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-wide transition-colors ${
                filter === f.id
                  ? "bg-neon text-black"
                  : "text-muted-foreground hover:text-white"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 items-start gap-4 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3">
          {loading && (
            <p className="col-span-full text-center text-sm text-muted-foreground">
              Carregando produtos...
            </p>
          )}
          {!loading && error && (
            <p className="col-span-full text-center text-sm text-destructive">
              Não foi possível carregar os produtos. Tente novamente em instantes.
            </p>
          )}
          {!loading && !error && filtered.length === 0 && (
            <p className="col-span-full text-center text-sm text-muted-foreground">
              Nenhum produto encontrado nessa categoria.
            </p>
          )}
          {!loading &&
            !error &&
            filtered.map((p) => <ProductCard key={p.id} product={p} />)}
        </div>
      </div>
    </section>
  );
}