import { useLocation } from "react-router-dom";
import { Menu } from "lucide-react";

const TITLES = {
  "/dashboard": ["Dashboard", "Visão geral do seu negócio"],
  "/produtos": ["Produtos", "Gerenciamento de produtos"],
  "/vendas": ["Vendas", "Pedidos registrados pela loja"],
};

function Header({ onMenuClick = () => {} }) {
  const { pathname } = useLocation();
  const [title, subtitle] = TITLES[pathname] || ["Sistema Arsenal", ""];

  return (
    <header className="flex h-16 flex-shrink-0 items-center gap-3 border-b border-border bg-background/80 px-4 backdrop-blur-xl sm:px-6 lg:px-8">
      <button
        onClick={onMenuClick}
        className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-white/5 hover:text-white lg:hidden"
        aria-label="Abrir menu"
      >
        <Menu className="h-5 w-5" />
      </button>
      <div className="min-w-0">
        <h1 className="truncate font-heading text-lg uppercase tracking-wide text-white">
          {title}
        </h1>
        {subtitle && <p className="truncate text-xs text-muted-foreground">{subtitle}</p>}
      </div>
    </header>
  );
}

export default Header;
