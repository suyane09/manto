import { useEffect, useState } from "react";
import { Package, ShoppingBag, DollarSign, Wallet, Clock, AlertTriangle, Loader2 } from "lucide-react";
import api from "@/lib/api";
import { formatBRL } from "@/lib/config";

const STAT_CARDS = [
  { key: "totalProducts", label: "Produtos cadastrados", icon: Package, format: (v) => v },
  { key: "ordersToday", label: "Vendas hoje", icon: ShoppingBag, format: (v) => v },
  { key: "revenueToday", label: "Faturamento hoje", icon: DollarSign, format: formatBRL, accent: true },
  { key: "totalRevenue", label: "Faturamento total", icon: Wallet, format: formatBRL },
  { key: "pendingOrders", label: "Pedidos pendentes", icon: Clock, format: (v) => v },
  { key: "lowStock", label: "Estoque baixo", icon: AlertTriangle, format: (v) => v, warn: true },
];

const STATUS_STYLES = {
  aguardando_pagamento: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  confirmado: "bg-blue-500/15 text-blue-400 border-blue-500/30",
  enviado: "bg-purple-500/15 text-purple-400 border-purple-500/30",
  concluido: "bg-green-500/15 text-green-400 border-green-500/30",
  cancelado: "bg-red-500/15 text-red-400 border-red-500/30",
  pagamento_recusado: "bg-red-500/15 text-red-400 border-red-500/30",
};

function Dashboard() {
  const [stats, setStats] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    api
      .get("/dashboard/stats")
      .then(({ data }) => mounted && setStats(data))
      .catch(() => mounted && setError("Não foi possível carregar os dados do painel."))
      .finally(() => mounted && setLoading(false));
    return () => {
      mounted = false;
    };
  }, []);

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }

  if (error) {
    return <p className="text-destructive">{error}</p>;
  }

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 xl:grid-cols-6">
        {STAT_CARDS.map(({ key, label, icon: Icon, format, accent, warn }) => (
          <div
            key={key}
            className="min-w-0 rounded-2xl border border-border bg-card p-4 transition-colors hover:border-neon/40 sm:p-5"
          >
            <div
              className={`mb-3 inline-flex h-9 w-9 items-center justify-center rounded-lg ${
                warn && stats[key] > 0
                  ? "bg-destructive/15 text-destructive"
                  : accent
                  ? "bg-neon/15 text-neon"
                  : "bg-white/5 text-muted-foreground"
              }`}
            >
              <Icon className="h-[18px] w-[18px]" />
            </div>
            <p className="truncate font-heading text-xl text-white sm:text-2xl">{format(stats[key])}</p>
            <p className="mt-1 text-xs text-muted-foreground">{label}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-border bg-card p-6">
          <h3 className="mb-4 font-heading text-sm uppercase tracking-wide text-white">
            Últimos pedidos
          </h3>
          {stats.recentOrders.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum pedido ainda.</p>
          ) : (
            <div className="space-y-2">
              {stats.recentOrders.map((o) => (
                <div
                  key={o.id}
                  className="flex items-center justify-between rounded-lg border border-border/60 bg-background px-4 py-3 text-sm"
                >
                  <div>
                    <p className="font-medium text-white">#{o.id} — {o.customer_name || "Cliente"}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(o.created_at.replace(" ", "T") + "Z").toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-semibold text-white">{formatBRL(o.total)}</span>
                    <span
                      className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide ${
                        STATUS_STYLES[o.status] || "bg-white/5 text-muted-foreground border-border"
                      }`}
                    >
                      {o.status.replace(/_/g, " ")}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-border bg-card p-6">
          <h3 className="mb-4 font-heading text-sm uppercase tracking-wide text-white">
            Mais vendidos
          </h3>
          {stats.topProducts.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sem vendas registradas ainda.</p>
          ) : (
            <div className="space-y-2">
              {stats.topProducts.map((p, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between rounded-lg border border-border/60 bg-background px-4 py-3 text-sm"
                >
                  <div className="flex items-center gap-3">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-neon/15 text-xs font-bold text-neon">
                      {i + 1}
                    </span>
                    <span className="text-white">{p.name}</span>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <span>{p.totalQty} un.</span>
                    <span className="font-semibold text-white">{formatBRL(p.totalRevenue)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default Dashboard;

