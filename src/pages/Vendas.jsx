import { useEffect, useState } from "react";
import { ChevronDown, ChevronLeft, ChevronRight, Loader2, MapPin, Truck } from "lucide-react";
import api from "@/lib/api";
import { formatBRL } from "@/lib/config";

const PAGE_SIZE = 15;

const STATUS_OPTIONS = [
  "aguardando_pagamento",
  "confirmado",
  "enviado",
  "concluido",
  "cancelado",
  "pagamento_recusado",
];

const STATUS_STYLES = {
  aguardando_pagamento: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  confirmado: "bg-blue-500/15 text-blue-400 border-blue-500/30",
  enviado: "bg-purple-500/15 text-purple-400 border-purple-500/30",
  concluido: "bg-green-500/15 text-green-400 border-green-500/30",
  cancelado: "bg-red-500/15 text-red-400 border-red-500/30",
  pagamento_recusado: "bg-red-500/15 text-red-400 border-red-500/30",
};

const PAYMENT_STYLES = {
  aprovado: "text-green-400",
  pendente: "text-amber-400",
  pending: "text-amber-400",
  em_analise: "text-amber-400",
  recusado: "text-destructive",
  cancelado: "text-destructive",
  reembolsado: "text-destructive",
};

function statusLabel(s) {
  return s.replace(/_/g, " ");
}

function Vendas() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [expanded, setExpanded] = useState(null);
  const [statusFilter, setStatusFilter] = useState("todos");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  function load() {
    setLoading(true);
    const params = { page, pageSize: PAGE_SIZE };
    if (statusFilter !== "todos") params.status = statusFilter;
    api
      .get("/orders", { params })
      .then(({ data }) => {
        // se o backend devolver o formato antigo (array), lida com isso também
        if (Array.isArray(data)) {
          setOrders(data);
          setTotalPages(1);
          setTotal(data.length);
        } else {
          setOrders(data.data);
          setTotalPages(data.totalPages);
          setTotal(data.total);
        }
      })
      .catch(() => setError("Não foi possível carregar as vendas."))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, statusFilter]);

  useEffect(() => {
    setPage(1);
  }, [statusFilter]);

  async function updateStatus(id, status) {
    try {
      await api.patch(`/orders/${id}/status`, { status });
      load();
    } catch {
      setError("Erro ao atualizar status do pedido.");
    }
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <button
          onClick={() => setStatusFilter("todos")}
          className={`rounded-full border px-3 py-1.5 text-xs font-semibold capitalize tracking-wide ${
            statusFilter === "todos"
              ? "border-neon bg-neon/10 text-neon"
              : "border-border text-muted-foreground hover:text-white"
          }`}
        >
          Todos
        </button>
        {STATUS_OPTIONS.map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`rounded-full border px-3 py-1.5 text-xs font-semibold capitalize tracking-wide ${
              statusFilter === s
                ? "border-neon bg-neon/10 text-neon"
                : "border-border text-muted-foreground hover:text-white"
            }`}
          >
            {statusLabel(s)}
          </button>
        ))}
      </div>

      {loading && (
        <div className="flex h-64 items-center justify-center text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      )}

      {error && (
        <p className="mb-4 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}

      {!loading && orders.length === 0 ? (
        <div className="rounded-2xl border border-border bg-card p-10 text-center text-muted-foreground">
          Nenhuma venda encontrada{statusFilter !== "todos" ? " com esse status" : ""}.
        </div>
      ) : !loading ? (
        <div className="space-y-3">
          {orders.map((o) => {
            const isOpen = expanded === o.id;
            return (
              <div key={o.id} className="overflow-hidden rounded-2xl border border-border bg-card">
                <button
                  onClick={() => setExpanded(isOpen ? null : o.id)}
                  className="flex w-full flex-col gap-3 px-4 py-4 text-left sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:px-6"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium text-white">
                      #{o.id} — {o.customer_name || "Cliente não informado"}
                    </p>
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                      <span>{o.customer_phone || "Sem telefone"}</span>
                      {o.city && (
                        <>
                          <span>·</span>
                          <span className="flex items-center gap-1">
                            <MapPin className="h-3 w-3" />
                            {o.city}/{o.uf}
                          </span>
                        </>
                      )}
                      {o.payment_status && (
                        <>
                          <span>·</span>
                          <span className={`capitalize ${PAYMENT_STYLES[o.payment_status] || ""}`}>
                            pagamento {statusLabel(o.payment_status)}
                          </span>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-3 sm:flex-nowrap sm:justify-end sm:gap-4">
                    <span className="font-heading text-lg text-white">{formatBRL(o.total)}</span>

                    <select
                      value={o.status}
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) => updateStatus(o.id, e.target.value)}
                      className={`rounded-full border px-3 py-1 text-[11px] font-semibold capitalize tracking-wide focus:outline-none ${
                        STATUS_STYLES[o.status] || "border-border text-muted-foreground"
                      }`}
                    >
                      {STATUS_OPTIONS.map((s) => (
                        <option key={s} value={s} className="bg-card text-white">
                          {statusLabel(s)}
                        </option>
                      ))}
                    </select>

                    <span className="hidden text-xs text-muted-foreground md:inline">
                      {new Date(o.created_at.replace(" ", "T") + "Z").toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}
                    </span>

                    <ChevronDown
                      className={`h-4 w-4 flex-shrink-0 text-muted-foreground transition-transform ${isOpen ? "rotate-180" : ""}`}
                    />
                  </div>
                </button>

                {isOpen && (
                  <div className="space-y-4 border-t border-border/60 px-6 py-4">
                    {(o.street || o.cep) && (
                      <div className="rounded-lg border border-border/60 bg-background p-3 text-xs text-muted-foreground">
                        <p className="mb-1 flex items-center gap-1.5 text-white">
                          <MapPin className="h-3.5 w-3.5" /> Endereço de entrega
                        </p>
                        {o.street}, {o.number} {o.complement ? `- ${o.complement}` : ""}
                        <br />
                        {o.neighborhood} — {o.city}/{o.uf} — CEP {o.cep}
                        {o.shipping_cost > 0 && (
                          <p className="mt-1 flex items-center gap-1.5">
                            <Truck className="h-3.5 w-3.5" />
                            Frete: {formatBRL(o.shipping_cost)}
                            {o.shipping_days_min && ` · ${o.shipping_days_min}-${o.shipping_days_max} dias úteis`}
                          </p>
                        )}
                      </div>
                    )}

                    <div className="space-y-2">
                      {o.items.map((it) => (
                        <div key={it.id} className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">
                            <span className="text-white">{it.qty}x {it.product_name}</span>
                            {it.size ? ` · Tam. ${it.size}` : ""}
                            {it.custom_name
                              ? ` · ${it.custom_name}${it.custom_number ? " #" + it.custom_number : ""}`
                              : ""}
                          </span>
                          <span className="text-white">{formatBRL(it.subtotal)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : null}

      {!loading && totalPages > 1 && (
        <div className="mt-6 flex items-center justify-center gap-3 text-sm">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
            className="flex items-center gap-1 rounded-full border border-border px-3 py-1.5 text-muted-foreground hover:text-white disabled:opacity-40"
          >
            <ChevronLeft className="h-4 w-4" /> Anterior
          </button>
          <span className="text-muted-foreground">
            Página {page} de {totalPages} · {total} pedidos
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
            className="flex items-center gap-1 rounded-full border border-border px-3 py-1.5 text-muted-foreground hover:text-white disabled:opacity-40"
          >
            Próxima <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
}

export default Vendas;

