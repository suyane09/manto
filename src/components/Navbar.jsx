import React from "react";
import { ShoppingBag, User } from "lucide-react";
import { useCart } from "@/context/CartContext";
import { useCustomerAuth } from "@/context/CustomerAuthContext";
import { STORE_NAME, LOGO_URL } from "@/lib/config";

const links = [
  { label: "Pronta Entrega", href: "#produtos" },
  { label: "Sob Encomenda", href: "#produtos" },
  { label: "Mantos", href: "#produtos" },
  { label: "Chuteiras", href: "#produtos" },
  { label: "Sobre", href: "#sobre" },
];

export default function Navbar() {
  const { totalCount, openCart } = useCart();
  const { isAuthenticated, customer, openDrawer } = useCustomerAuth();

  return (
    <header className="sticky top-0 z-30 border-b border-border/60 bg-background/80 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6">
        <a href="#top" className="flex items-center gap-3">
          <img
            src={LOGO_URL}
            alt="Arsenal do Manto"
            width="44"
            height="44"
            decoding="async"
            className="h-11 w-11 rounded-full object-cover ring-2 ring-neon"
          />
          <div className="leading-none">
            <p className="font-heading text-sm uppercase tracking-wider text-white">
              {STORE_NAME}
            </p>
            <p className="text-[10px] uppercase tracking-[0.3em] text-neon">
              Sport's Club
            </p>
          </div>
        </a>

        <nav className="hidden items-center gap-7 md:flex">
          {links.map((l) => (
            <a
              key={l.label}
              href={l.href}
              className="text-xs font-semibold uppercase tracking-wide text-muted-foreground transition-colors hover:text-neon"
            >
              {l.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <button
            onClick={openDrawer}
            className="relative flex items-center gap-2 rounded-full border border-border p-2.5 text-white transition-colors hover:border-neon hover:text-neon"
            aria-label={isAuthenticated ? "Minha conta" : "Entrar ou criar conta"}
          >
            <User className="h-5 w-5" />
            {isAuthenticated && (
              <span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full bg-neon ring-2 ring-background" />
            )}
            {isAuthenticated && customer?.name && (
              <span className="hidden max-w-[90px] truncate pr-1 text-xs font-semibold md:inline">
                {customer.name.split(" ")[0]}
              </span>
            )}
          </button>

          <button
            onClick={openCart}
            className="relative rounded-full border border-border p-2.5 text-white transition-colors hover:border-neon hover:text-neon"
            aria-label="Abrir carrinho"
          >
            <ShoppingBag className="h-5 w-5" />
            {totalCount > 0 && (
              <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-neon px-1 text-[10px] font-bold text-black">
                {totalCount}
              </span>
            )}
          </button>
        </div>
      </div>
    </header>
  );
}