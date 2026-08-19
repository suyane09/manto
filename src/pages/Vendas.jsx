import { useEffect, useState } from "react";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Loader2,
  MapPin,
  Plus,
  Truck,
  X,
  Search,
  Trash2,
  FileDown,
} from "lucide-react";
import api from "@/lib/api";
import { formatBRL } from "@/lib/config";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

const PAGE_SIZE = 15;

const REPORT_PERIODS = [
  { key: "hoje", label: "Hoje" },
  { key: "7dias", label: "Últimos 7 dias" },
  { key: "30dias", label: "Últimos 30 dias" },
  { key: "mes", label: "Este mês" },
  { key: "tudo", label: "Tudo" },
];

function periodToRange(key) {
  const now = new Date();
  const toISO = (d) => d.toISOString().slice(0, 19).replace("T", " ");
  const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0);

  if (key === "tudo") return { from: null, to: null };

  if (key === "hoje") {
    return { from: toISO(startOfDay(now)), to: toISO(now) };
  }
  if (key === "7dias") {
    const from = new Date(now);
    from.setDate(from.getDate() - 7);
    return { from: toISO(startOfDay(from)), to: toISO(now) };
  }
  if (key === "30dias") {
    const from = new Date(now);
    from.setDate(from.getDate() - 30);
    return { from: toISO(startOfDay(from)), to: toISO(now) };
  }
  if (key === "mes") {
    const from = new Date(now.getFullYear(), now.getMonth(), 1);
    return { from: toISO(startOfDay(from)), to: toISO(now) };
  }
  return { from: null, to: null };
}

const STATUS_OPTIONS = ["concluido", "cancelado"];

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
  const [showNovaVenda, setShowNovaVenda] = useState(false);
  const [generatingReport, setGeneratingReport] = useState(false);

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

  async function baixarRelatorio(periodKey) {
    setGeneratingReport(true);
    setError("");
    try {
      const { from, to } = periodToRange(periodKey);
      const { data } = await api.get("/orders/report", { params: { from, to } });
      const periodLabel = REPORT_PERIODS.find((p) => p.key === periodKey)?.label || "Tudo";
      const geradoEm = new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
      const fmtData = (raw) =>
        new Date(raw.replace(" ", "T") + "Z").toLocaleString("pt-BR", {
          timeZone: "America/Sao_Paulo",
        });

      const NEON = [163, 255, 26];
      const DARK = [17, 17, 17];
      const GRAY_TXT = [90, 90, 90];
      const LIGHT_BG = [245, 247, 240];
      const totalRevenue = data.summary.totalRevenue || 0;

      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      const margin = 14;
      const contentWidth = pageWidth - margin * 2;

      // Cabeçalho
      doc.setFillColor(...DARK);
      doc.rect(0, 0, pageWidth, 34, "F");
      doc.setFillColor(...NEON);
      doc.rect(0, 34, pageWidth, 1.2, "F");

      doc.setTextColor(...NEON);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(16);
      doc.text("ARSENAL DO MANTO", margin, 14);

      doc.setTextColor(255, 255, 255);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(11);
      doc.text(`Relatório de vendas - ${periodLabel}`, margin, 22);
      doc.setFontSize(8);
      doc.setTextColor(190, 190, 190);
      doc.text(`Gerado em ${geradoEm}`, margin, 28);

      // Cards de indicadores
      const cards = [
        { label: "Total de vendas", value: String(data.summary.totalOrders) },
        { label: "Itens vendidos", value: String(data.summary.totalItems) },
        { label: "Faturamento total", value: formatBRL(totalRevenue) },
        { label: "Mais vendido", value: data.summary.topProduct?.name || "-" },
      ];
      const gap = 4;
      const cardW = (contentWidth - gap * (cards.length - 1)) / cards.length;
      const cardY = 42;
      const cardH = 22;

      cards.forEach((c, i) => {
        const x = margin + i * (cardW + gap);
        doc.setFillColor(...LIGHT_BG);
        doc.setDrawColor(220, 220, 220);
        doc.roundedRect(x, cardY, cardW, cardH, 2, 2, "FD");
        doc.setTextColor(...GRAY_TXT);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(7.5);
        doc.text(c.label.toUpperCase(), x + 3, cardY + 7, { maxWidth: cardW - 6 });
        doc.setTextColor(...DARK);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(c.value.length > 14 ? 9 : 12);
        doc.text(c.value, x + 3, cardY + 16, { maxWidth: cardW - 6 });
      });

      let cursorY = cardY + cardH + 12;

      // Vendas por categoria
      doc.setTextColor(...DARK);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.text("Vendas por categoria", margin, cursorY);

      autoTable(doc, {
        startY: cursorY + 3,
        margin: { left: margin, right: margin },
        head: [["Categoria", "Qtd. vendida", "Faturamento", "% do faturamento"]],
        body: data.byCategory.map((c) => [
          c.name,
          String(c.qty),
          formatBRL(c.revenue),
          totalRevenue ? `${((c.revenue / totalRevenue) * 100).toFixed(1)}%` : "-",
        ]),
        theme: "grid",
        headStyles: { fillColor: DARK, textColor: NEON, fontStyle: "bold", fontSize: 9 },
        styles: { fontSize: 9, cellPadding: 3 },
        columnStyles: { 1: { halign: "right" }, 2: { halign: "right" }, 3: { halign: "right" } },
      });

      // Produtos mais vendidos
      cursorY = doc.lastAutoTable.finalY + 12;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.text("Produtos mais vendidos", margin, cursorY);

      autoTable(doc, {
        startY: cursorY + 3,
        margin: { left: margin, right: margin },
        head: [["#", "Produto", "Qtd. vendida", "Faturamento"]],
        body: data.byProduct.map((p, i) => [String(i + 1), p.name, String(p.qty), formatBRL(p.revenue)]),
        theme: "grid",
        headStyles: { fillColor: DARK, textColor: NEON, fontStyle: "bold", fontSize: 9 },
        styles: { fontSize: 9, cellPadding: 3 },
        columnStyles: {
          0: { halign: "center", cellWidth: 10 },
          2: { halign: "right" },
          3: { halign: "right" },
        },
        didParseCell: (hookData) => {
          if (hookData.section === "body" && hookData.row.index === 0) {
            hookData.cell.styles.fillColor = [237, 255, 214];
            hookData.cell.styles.fontStyle = "bold";
          }
        },
      });

      // Detalhamento das vendas
      cursorY = doc.lastAutoTable.finalY + 12;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.text("Detalhamento das vendas", margin, cursorY);

      autoTable(doc, {
        startY: cursorY + 3,
        margin: { left: margin, right: margin },
        head: [["Data", "Cliente", "Itens", "Total"]],
        body: data.orders.map((o) => [fmtData(o.created_at), o.customer_name || "-", String(o.itemsCount), formatBRL(o.total)]),
        foot: [["", "", "Total", formatBRL(totalRevenue)]],
        theme: "striped",
        headStyles: { fillColor: DARK, textColor: NEON, fontStyle: "bold", fontSize: 9 },
        footStyles: { fillColor: LIGHT_BG, textColor: DARK, fontStyle: "bold", fontSize: 9 },
        styles: { fontSize: 8.5, cellPadding: 2.5 },
        columnStyles: { 2: { halign: "right" }, 3: { halign: "right" } },
      });

      // Rodapé com número de página em todas as páginas
      const pageCount = doc.internal.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(7.5);
        doc.setTextColor(150, 150, 150);
        doc.text(
          `Arsenal do Manto - Relatório de vendas - Página ${i} de ${pageCount}`,
          margin,
          doc.internal.pageSize.getHeight() - 8
        );
      }

      const fileSuffix = periodKey === "tudo" ? "completo" : periodKey;
      doc.save(`relatorio-vendas-${fileSuffix}.pdf`);
    } catch {
      setError("Erro ao gerar o relatório. Tente novamente.");
    } finally {
      setGeneratingReport(false);
    }
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Pedidos fechados aqui contam pro dashboard; vendas combinadas no WhatsApp precisam ser
          registradas manualmente.
        </p>
        <div className="flex items-center gap-2">
          <div className="relative flex items-center gap-1.5 rounded-full border border-border pl-3 pr-1 py-1">
            <FileDown className="h-4 w-4 text-white" />
            <select
              defaultValue=""
              disabled={generatingReport}
              onChange={(e) => {
                const value = e.target.value;
                if (value) baixarRelatorio(value);
                e.target.value = "";
              }}
              className="bg-transparent py-1.5 pr-2 text-xs font-black uppercase tracking-wide text-white focus:outline-none disabled:opacity-50"
            >
              <option value="" disabled>
                {generatingReport ? "Gerando..." : "Baixar relatório"}
              </option>
              {REPORT_PERIODS.map((p) => (
                <option key={p.key} value={p.key} className="bg-card text-white normal-case">
                  {p.label}
                </option>
              ))}
            </select>
            {generatingReport && <Loader2 className="h-4 w-4 animate-spin text-white" />}
          </div>

          <button
            onClick={() => setShowNovaVenda(true)}
            className="flex items-center gap-2 rounded-full bg-neon px-4 py-2 text-xs font-black uppercase tracking-wide text-black transition-transform hover:scale-[1.02] active:scale-95"
          >
            <Plus className="h-4 w-4" />
            Registrar venda
          </button>
        </div>
      </div>

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
                      {(STATUS_OPTIONS.includes(o.status)
                        ? STATUS_OPTIONS
                        : [o.status, ...STATUS_OPTIONS]
                      ).map((s) => (
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

      {showNovaVenda && (
        <NovaVendaModal
          onClose={() => setShowNovaVenda(false)}
          onSaved={() => {
            setShowNovaVenda(false);
            setPage(1);
            setStatusFilter("todos");
            load();
          }}
        />
      )}
    </div>
  );
}

function NovaVendaModal({ onClose, onSaved }) {
  const [products, setProducts] = useState([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [search, setSearch] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [cart, setCart] = useState([]); // [{ productId, name, price, stock, qty }]
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    api
      .get("/products")
      .then(({ data }) => setProducts(Array.isArray(data) ? data : data.data || []))
      .catch(() => setError("Não foi possível carregar os produtos."))
      .finally(() => setLoadingProducts(false));
  }, []);

  const filteredProducts = products.filter((p) =>
    p.name?.toLowerCase().includes(search.toLowerCase())
  );

  function addToCart(product) {
    setCart((prev) => {
      const existing = prev.find((it) => it.productId === product.id);
      if (existing) {
        return prev.map((it) =>
          it.productId === product.id ? { ...it, qty: it.qty + 1 } : it
        );
      }
      return [
        ...prev,
        {
          productId: product.id,
          name: product.name,
          price: Number(product.price) || 0,
          stock: product.stock,
          qty: 1,
        },
      ];
    });
  }

  function updateQty(productId, qty) {
    const n = Math.max(1, Number(qty) || 1);
    setCart((prev) => prev.map((it) => (it.productId === productId ? { ...it, qty: n } : it)));
  }

  function removeFromCart(productId) {
    setCart((prev) => prev.filter((it) => it.productId !== productId));
  }

  const total = cart.reduce((sum, it) => sum + it.price * it.qty, 0);

  async function handleSubmit(e) {
    e.preventDefault();
    if (cart.length === 0) {
      setError("Adicione ao menos um produto vendido.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await api.post("/orders/manual", {
        customerName,
        items: cart.map((it) => ({ productId: it.productId, qty: it.qty })),
      });
      onSaved();
    } catch (err) {
      setError(err?.response?.data?.error || "Erro ao registrar a venda.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col rounded-2xl border border-border bg-card">
        <header className="flex items-center justify-between border-b border-border p-5">
          <div>
            <p className="font-heading text-lg uppercase tracking-wide text-white">
              Registrar venda
            </p>
            <p className="text-xs text-muted-foreground">
              Venda combinada e fechada pelo WhatsApp — sem frete, sem pagamento online.
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-2 text-white hover:bg-muted"
            aria-label="Fechar"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        <form onSubmit={handleSubmit} className="flex flex-1 flex-col overflow-hidden">
          <div className="flex-1 space-y-4 overflow-y-auto p-5">
            {error && (
              <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error}
              </p>
            )}

            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Cliente (opcional)
              </label>
              <input
                className="input"
                placeholder="Nome de quem comprou"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
              />
            </div>

            <div>
              <label className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <Search className="h-3.5 w-3.5" />
                Buscar produto
              </label>
              <input
                className="input"
                placeholder="Digite o nome do produto..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />

              {loadingProducts ? (
                <div className="flex h-24 items-center justify-center text-muted-foreground">
                  <Loader2 className="h-5 w-5 animate-spin" />
                </div>
              ) : (
                <div className="mt-2 max-h-40 space-y-1 overflow-y-auto rounded-lg border border-border/60 bg-background p-2">
                  {filteredProducts.length === 0 ? (
                    <p className="p-2 text-xs text-muted-foreground">Nenhum produto encontrado.</p>
                  ) : (
                    filteredProducts.map((p) => (
                      <button
                        type="button"
                        key={p.id}
                        onClick={() => addToCart(p)}
                        className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted"
                      >
                        <span className="text-white">{p.name}</span>
                        <span className="flex items-center gap-2 text-xs text-muted-foreground">
                          {formatBRL(p.price)}
                          <Plus className="h-3.5 w-3.5 text-neon" />
                        </span>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>

            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Itens da venda
              </p>
              {cart.length === 0 ? (
                <p className="rounded-lg border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
                  Nenhum produto adicionado ainda.
                </p>
              ) : (
                <div className="space-y-2">
                  {cart.map((it) => (
                    <div
                      key={it.productId}
                      className="flex items-center gap-3 rounded-lg border border-border/60 bg-background p-3"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm text-white">{it.name}</p>
                        <p className="text-xs text-muted-foreground">{formatBRL(it.price)} un.</p>
                      </div>
                      <input
                        type="number"
                        min={1}
                        value={it.qty}
                        onChange={(e) => updateQty(it.productId, e.target.value)}
                        className="input w-16 text-center"
                      />
                      <span className="w-20 text-right text-sm font-semibold text-white">
                        {formatBRL(it.price * it.qty)}
                      </span>
                      <button
                        type="button"
                        onClick={() => removeFromCart(it.productId)}
                        className="text-muted-foreground hover:text-destructive"
                        aria-label="Remover"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <footer className="border-t border-border p-5">
            <div className="mb-4 flex items-center justify-between">
              <span className="text-sm uppercase tracking-wider text-muted-foreground">Total</span>
              <span className="font-heading text-2xl tracking-wide text-white">
                {formatBRL(total)}
              </span>
            </div>
            <button
              type="submit"
              disabled={saving || cart.length === 0}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-neon py-3.5 font-black uppercase tracking-wide text-black transition-transform hover:scale-[1.01] active:scale-95 disabled:opacity-50 disabled:hover:scale-100"
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              Salvar venda
            </button>
          </footer>
        </form>
      </div>
    </div>
  );
}

export default Vendas;