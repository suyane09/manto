import React, { useState } from "react";
import { Plus, Zap, PencilRuler, ChevronLeft, ChevronRight } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { useCart } from "@/context/CartContext";
import { formatBRL } from "@/lib/config";

export default function ProductCard({ product }) {
  const [size, setSize] = useState(null);
  const [name, setName] = useState("");
  const [number, setNumber] = useState("");
  const [photoIndex, setPhotoIndex] = useState(0);
  const { addItem } = useCart();
  const { toast } = useToast();
  const isCustom = product.type === "encomenda";

  // Suporta o novo campo `images` (array) e mantém compatibilidade com o
  // antigo campo `image` (string), caso algum produto ainda não tenha migrado.
  const images = product.images?.length
    ? product.images
    : product.image
    ? [product.image]
    : [];
  const hasMultiplePhotos = images.length > 1;

  const goToPrevPhoto = (e) => {
    e.stopPropagation();
    setPhotoIndex((i) => (i === 0 ? images.length - 1 : i - 1));
  };
  const goToNextPhoto = (e) => {
    e.stopPropagation();
    setPhotoIndex((i) => (i === images.length - 1 ? 0 : i + 1));
  };

  const handleAdd = () => {
    if (!size) {
      toast({ title: "Selecione um tamanho", variant: "destructive" });
      return;
    }
    if (isCustom && !name.trim()) {
      toast({
        title: "Informe o nome para personalização",
        variant: "destructive",
      });
      return;
    }
    addItem({
      id: product.id,
      name: product.name,
      size,
      price: product.price,
      image: images[0],
      category: product.category,
      type: product.type,
      customName: name.trim(),
      customNumber: number.trim(),
    });
    toast({
      title: "Adicionado ao pedido",
      description: `${product.name} • ${size}`,
    });
  };

  return (
    <div className="group relative flex flex-col overflow-hidden rounded-xl border border-border bg-card transition-colors hover:border-neon/50">
      <div
        className="relative aspect-[4/5] overflow-hidden bg-gunmetal"
        style={{
          clipPath:
            "polygon(0 0, 100% 0, 100% calc(100% - 20px), calc(100% - 20px) 100%, 0 100%)",
        }}
      >
        <img
          src={images[photoIndex]}
          alt={product.name}
          loading="lazy"
          decoding="async"
          className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

        {hasMultiplePhotos && (
          <>
            <button
              type="button"
              aria-label="Foto anterior"
              onClick={goToPrevPhoto}
              className="absolute left-2 top-1/2 z-10 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-black/50 text-white opacity-0 backdrop-blur transition-opacity group-hover:opacity-100 hover:bg-black/70"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              aria-label="Próxima foto"
              onClick={goToNextPhoto}
              className="absolute right-2 top-1/2 z-10 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-black/50 text-white opacity-0 backdrop-blur transition-opacity group-hover:opacity-100 hover:bg-black/70"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
            <div className="absolute left-1/2 top-3 z-10 flex -translate-x-1/2 gap-1.5">
              {images.map((_, i) => (
                <span
                  key={i}
                  className={`h-1.5 rounded-full transition-all ${
                    i === photoIndex ? "w-4 bg-neon" : "w-1.5 bg-white/50"
                  }`}
                />
              ))}
            </div>
          </>
        )}
        <span
          className={`absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-wide ${
            isCustom
              ? "bg-white/15 text-white backdrop-blur"
              : "bg-neon text-black"
          }`}
        >
          {isCustom ? (
            <>
              <PencilRuler className="h-3 w-3" /> Sob Encomenda
            </>
          ) : (
            <>
              <Zap className="h-3 w-3" /> Pronta Entrega
            </>
          )}
        </span>
        <p className="absolute bottom-3 left-3 right-3 font-heading text-lg uppercase tracking-wide leading-tight text-white drop-shadow-lg">
          {product.name}
        </p>
      </div>

      <div className="flex flex-1 flex-col gap-4 p-4">
        <div className="flex items-center justify-between">
          <span className="text-xs uppercase tracking-wider text-muted-foreground">
            {product.category === "manto" ? "Manto" : "Chuteira"}
          </span>
          <span className="font-heading text-xl tracking-wide text-neon">
            {formatBRL(product.price)}
          </span>
        </div>

        <div>
          <p className="mb-2 text-[11px] uppercase tracking-wider text-muted-foreground">
            Tamanho
          </p>
          <div className="flex flex-wrap gap-2">
            {product.sizes.map((s) => {
              const unavail = product.unavailable?.includes(s);
              const selected = size === s;
              return (
                <button
                  key={s}
                  disabled={unavail}
                  onClick={() => setSize(s)}
                  className={`relative min-w-10 rounded-md border px-3 py-2 text-sm font-bold transition-all ${
                    unavail
                      ? "cursor-not-allowed border-border/50 text-muted-foreground/40"
                      : selected
                      ? "border-neon bg-neon text-black"
                      : "border-border text-white hover:border-neon"
                  }`}
                >
                  {s}
                  {unavail && (
                    <span className="absolute inset-0 flex items-center justify-center">
                      <span className="h-px w-full rotate-[-20deg] bg-muted-foreground/60" />
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {isCustom && (
          <div className="space-y-2">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nome (personalização)"
              maxLength={12}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm font-semibold uppercase tracking-wider text-white placeholder:normal-case placeholder:font-normal placeholder:tracking-normal placeholder:text-muted-foreground/60 focus:border-neon focus:outline-none"
            />
            <input
              value={number}
              onChange={(e) => setNumber(e.target.value)}
              placeholder="Número (opcional)"
              maxLength={3}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-white placeholder:text-muted-foreground/60 focus:border-neon focus:outline-none"
            />
          </div>
        )}

        <button
          onClick={handleAdd}
          className="mt-auto inline-flex items-center justify-center gap-2 rounded-md bg-neon py-3 text-sm font-black uppercase tracking-wide text-black transition-transform hover:scale-[1.02] active:scale-95"
        >
          <Plus className="h-4 w-4" /> Adicionar ao Pedido
        </button>
      </div>
    </div>
  );
}