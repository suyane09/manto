import { NavLink, useNavigate } from "react-router-dom";
import { LayoutDashboard, Package, ShoppingBag, ExternalLink, LogOut, X } from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import { STORE_NAME, LOGO_URL } from "@/lib/config";

const links = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/produtos", label: "Produtos", icon: Package },
  { to: "/vendas", label: "Vendas", icon: ShoppingBag },
];

function Sidebar({ open = false, onClose = () => {} }) {
  const { logout, username } = useAuth();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate("/login");
  }

  return (
    <>
      {/* Overlay for mobile, shown when sidebar is open */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/60 lg:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex h-[100dvh] w-72 max-w-[85vw] flex-shrink-0 flex-col border-r border-border bg-card transition-transform duration-300 ease-in-out lg:static lg:z-auto lg:h-screen lg:w-64 lg:max-w-none lg:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center gap-3 border-b border-border px-6 py-5">
          <img
            src={LOGO_URL}
            alt={STORE_NAME}
            className="h-10 w-10 flex-shrink-0 rounded-full object-cover ring-2 ring-neon"
          />
          <div className="min-w-0 flex-1 leading-none">
            <p className="truncate font-heading text-sm uppercase tracking-wider text-white">
              {STORE_NAME}
            </p>
            <p className="text-[10px] uppercase tracking-[0.3em] text-neon">Painel</p>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-white/5 hover:text-white lg:hidden"
            aria-label="Fechar menu"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-6">
          {links.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              onClick={onClose}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-neon text-black"
                    : "text-muted-foreground hover:bg-white/5 hover:text-white"
                }`
              }
            >
              <Icon className="h-4 w-4" />
              {label}
            </NavLink>
          ))}

          <a
            href="/"
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-white/5 hover:text-white"
          >
            <ExternalLink className="h-4 w-4" />
            Ver loja
          </a>
        </nav>

        <div className="border-t border-border px-4 py-4">
          {username && (
            <p className="mb-2 truncate px-2 text-xs text-muted-foreground">
              Logado como <span className="text-white">{username}</span>
            </p>
          )}
          <button
            onClick={handleLogout}
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-border py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground transition-colors hover:border-destructive hover:text-destructive"
          >
            <LogOut className="h-3.5 w-3.5" />
            Sair
          </button>
        </div>
      </aside>
    </>
  );
}

export default Sidebar;
