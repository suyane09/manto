import React, { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  X,
  Plus,
  Minus,
  Trash2,
  ShoppingBag,
  Truck,
  MapPin,
  Loader2,
  ChevronLeft,
  CreditCard,
} from "lucide-react";
import { useCart } from "@/context/CartContext";
import { useCustomerAuth } from "@/context/CustomerAuthContext";
import { formatBRL } from "@/lib/config";
import api from "@/lib/api";
import customerApi, { CUSTOMER_TOKEN_KEY } from "@/lib/customerApi";

const STEPS = { CART: "cart", SHIPPING: "shipping", ADDRESS: "address" };

export default function CartDrawer() {
  const {
    items,
    isOpen,
    closeCart,
    removeItem,
    incQty,
    decQty,
    clear,
    totalCount,
    totalPrice,
  } = useCart();

  const { customer, token: customerToken, isAuthenticated } = useCustomerAuth();

  const [step, setStep] = useState(STEPS.CART);
  const [cep, setCep] = useState(() => (isAuthenticated ? customer?.cep || "" : ""));
  const [shipping, setShipping] = useState(null);
  const [shippingLoading, setShippingLoading] = useState(false);
  const [shippingError, setShippingError] = useState("");

  const [form, setForm] = useState({
    name: isAuthenticated ? customer?.name || "" : "",
    phone: isAuthenticated ? customer?.phone || "" : "",
    email: isAuthenticated ? customer?.email || "" : "",
    number: isAuthenticated ? customer?.number || "" : "",
    complement: isAuthenticated ? customer?.complement || "" : "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");

  function resetCheckout() {
    setStep(STEPS.CART);
    setCep(isAuthenticated ? customer?.cep || "" : "");
    setShipping(null);
    setShippingError("");
    setSubmitError("");
  }

  function handleClose() {
    closeCart();
    // não reseta na hora pra não "piscar" o conteúdo enquanto a gaveta fecha
    setTimeout(resetCheckout, 300);
  }

  async function calculateShipping(e) {
    e.preventDefault();
    setShippingError("");
    setShippingLoading(true);
    try {
      const { data } = await api.post("/shipping/calculate", {
        cep,
        itemCount: totalCount,
      });
      setShipping(data);
    } catch (err) {
      setShippingError(err?.response?.data?.error || "Não foi possível calcular o frete.");
      setShipping(null);
    } finally {
      setShippingLoading(false);
    }
  }

  async function handleCheckout(e) {
    e.preventDefault();
    if (!shipping) return;
    setSubmitting(true);
    setSubmitError("");

    try {
      const token = customerToken || localStorage.getItem(CUSTOMER_TOKEN_KEY);
      const { data } = await customerApi.post(
        "/payments/create-preference",
        {
          customerName: form.name,
          customerPhone: form.phone,
          customerEmail: form.email,
          cep: shipping.cep,
          street: shipping.street,
          number: form.number,
          complement: form.complement,
          neighborhood: shipping.neighborhood,
          city: shipping.city,
          uf: shipping.uf,
          shippingCost: shipping.cost,
          shippingDaysMin: shipping.daysMin,
          shippingDaysMax: shipping.daysMax,
          items: items.map((it) => ({
            id: it.id,
            name: it.name,
            size: it.size,
            customName: it.customName,
            customNumber: it.customNumber,
            qty: it.qty,
            price: it.price,
          })),
        },
        token ? { headers: { Authorization: `Bearer ${token}` } } : undefined
      );

      const redirectUrl = data.initPoint || data.sandboxInitPoint;
      if (!redirectUrl) throw new Error("Link de pagamento não retornado.");

      clear();
      window.location.href = redirectUrl;
    } catch (err) {
      setSubmitError(
        err?.response?.data?.error || "Não foi possível iniciar o pagamento. Tente novamente."
      );
      setSubmitting(false);
    }
  }

  const grandTotal = totalPrice + (shipping?.cost || 0);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleClose}
            className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm"
          />
          <motion.aside
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "tween", ease: "easeInOut", duration: 0.35 }}
            className="fixed right-0 top-0 z-50 flex h-full w-full max-w-md flex-col border-l border-border bg-card"
          >
            <header className="flex items-center justify-between border-b border-border p-5">
              <div className="flex items-center gap-2">
                {step !== STEPS.CART && (
                  <button
                    onClick={() => setStep(step === STEPS.ADDRESS ? STEPS.SHIPPING : STEPS.CART)}
                    className="rounded-full p-1.5 text-white hover:bg-muted"
                    aria-label="Voltar"
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </button>
                )}
                <div>
                  <p className="font-heading text-lg uppercase tracking-wide text-white">
                    {step === STEPS.CART && "Pedido Tático"}
                    {step === STEPS.SHIPPING && "Entrega"}
                    {step === STEPS.ADDRESS && "Seus dados"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {totalCount} {totalCount === 1 ? "item" : "itens"}
                  </p>
                </div>
              </div>
              <button
                onClick={handleClose}
                className="rounded-full p-2 text-white hover:bg-muted"
                aria-label="Fechar"
              >
                <X className="h-5 w-5" />
              </button>
            </header>

            <div className="flex-1 overflow-y-auto p-5">
              {items.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center gap-3 text-center text-muted-foreground">
                  <ShoppingBag className="h-12 w-12 opacity-30" />
                  <p className="text-sm">
                    Seu pedido está vazio.
                    <br />
                    Adicione um Manto para começar.
                  </p>
                </div>
              ) : step === STEPS.CART ? (
                <ul className="space-y-4">
                  {items.map((it) => (
                    <li
                      key={it.key}
                      className="flex gap-3 rounded-lg border border-border bg-background p-3"
                    >
                      <img
                        src={it.image}
                        alt={it.name}
                        className="h-20 w-16 rounded-md object-cover"
                      />
                      <div className="flex flex-1 flex-col">
                        <div className="flex justify-between gap-2">
                          <p className="text-sm font-bold text-white">{it.name}</p>
                          <button
                            onClick={() => removeItem(it.key)}
                            className="text-muted-foreground hover:text-destructive"
                            aria-label="Remover"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Tam: {it.size}
                          {it.customName
                            ? ` · ${it.customName}${it.customNumber ? " #" + it.customNumber : ""}`
                            : ""}
                        </p>
                        <div className="mt-auto flex items-center justify-between pt-2">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => decQty(it.key)}
                              className="rounded border border-border p-1 text-white hover:border-neon"
                              aria-label="Diminuir"
                            >
                              <Minus className="h-3 w-3" />
                            </button>
                            <span className="w-6 text-center text-sm text-white">{it.qty}</span>
                            <button
                              onClick={() => incQty(it.key)}
                              className="rounded border border-border p-1 text-white hover:border-neon"
                              aria-label="Aumentar"
                            >
                              <Plus className="h-3 w-3" />
                            </button>
                          </div>
                          <span className="text-sm font-bold text-neon">
                            {formatBRL(it.qty * it.price)}
                          </span>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : step === STEPS.SHIPPING ? (
                <form onSubmit={calculateShipping} className="space-y-4">
                  <div>
                    <label className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      <MapPin className="h-3.5 w-3.5" />
                      CEP de entrega
                    </label>
                    <div className="flex gap-2">
                      <input
                        className="input flex-1"
                        placeholder="00000-000"
                        value={cep}
                        onChange={(e) => setCep(e.target.value)}
                        maxLength={9}
                        required
                      />
                      <button
                        type="submit"
                        disabled={shippingLoading}
                        className="flex items-center justify-center gap-1.5 rounded-lg bg-neon px-4 text-xs font-bold uppercase tracking-wide text-black disabled:opacity-60"
                      >
                        {shippingLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Calcular"}
                      </button>
                    </div>
                    <p className="mt-1.5 text-[11px] text-muted-foreground">
                      Não sabe seu CEP?{" "}
                      <a
                        href="https://buscacepinter.correios.com.br/app/endereco/index.php"
                        target="_blank"
                        rel="noreferrer"
                        className="underline hover:text-neon"
                      >
                        Consultar nos Correios
                      </a>
                    </p>
                  </div>

                  {shippingError && (
                    <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                      {shippingError}
                    </p>
                  )}

                  {shipping && (
                    <div className="space-y-3 rounded-lg border border-neon/30 bg-neon/5 p-4">
                      <div className="flex items-center gap-2 text-sm text-white">
                        <Truck className="h-4 w-4 text-neon" />
                        <span>
                          {shipping.city} / {shipping.uf}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Frete estimado</span>
                        <span className="font-bold text-neon">{formatBRL(shipping.cost)}</span>
                      </div>
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>Prazo estimado</span>
                        <span>
                          {shipping.daysMin}–{shipping.daysMax} dias úteis
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={() => setStep(STEPS.ADDRESS)}
                        className="w-full rounded-lg bg-neon py-3 text-xs font-bold uppercase tracking-wide text-black"
                      >
                        Continuar
                      </button>
                    </div>
                  )}
                </form>
              ) : (
                <form onSubmit={handleCheckout} className="space-y-4">
                  <div className="rounded-lg border border-border bg-background p-3 text-xs text-muted-foreground">
                    Entregando em <span className="text-white">{shipping.street}, {shipping.neighborhood}</span>
                    <br />
                    {shipping.city} / {shipping.uf} — {shipping.cep}
                  </div>

                  <Field label="Nome completo">
                    <input
                      className="input"
                      required
                      value={form.name}
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                    />
                  </Field>

                  <Field label="WhatsApp / telefone">
                    <input
                      className="input"
                      required
                      placeholder="(82) 9xxxx-xxxx"
                      value={form.phone}
                      onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    />
                  </Field>

                  <Field label="E-mail (opcional)">
                    <input
                      type="email"
                      className="input"
                      value={form.email}
                      onChange={(e) => setForm({ ...form, email: e.target.value })}
                    />
                  </Field>

                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Número">
                      <input
                        className="input"
                        required
                        value={form.number}
                        onChange={(e) => setForm({ ...form, number: e.target.value })}
                      />
                    </Field>
                    <Field label="Complemento">
                      <input
                        className="input"
                        value={form.complement}
                        onChange={(e) => setForm({ ...form, complement: e.target.value })}
                      />
                    </Field>
                  </div>

                  {submitError && (
                    <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                      {submitError}
                    </p>
                  )}

                  <button
                    type="submit"
                    disabled={submitting}
                    className="flex w-full items-center justify-center gap-2 rounded-lg bg-neon py-4 font-black uppercase tracking-wide text-black transition-transform hover:scale-[1.01] active:scale-95 disabled:opacity-60"
                  >
                    {submitting ? (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    ) : (
                      <>
                        <CreditCard className="h-5 w-5" />
                        Ir para pagamento
                      </>
                    )}
                  </button>
                </form>
              )}
            </div>

            {items.length > 0 && (
              <footer className="border-t border-border p-5">
                <div className="mb-1 flex items-center justify-between text-sm text-muted-foreground">
                  <span>Produtos</span>
                  <span>{formatBRL(totalPrice)}</span>
                </div>
                {shipping && (
                  <div className="mb-1 flex items-center justify-between text-sm text-muted-foreground">
                    <span>Frete</span>
                    <span>{formatBRL(shipping.cost)}</span>
                  </div>
                )}
                <div className="mb-4 flex items-center justify-between">
                  <span className="text-sm uppercase tracking-wider text-muted-foreground">Total</span>
                  <span className="font-heading text-2xl tracking-wide text-white">
                    {formatBRL(grandTotal)}
                  </span>
                </div>

                {step === STEPS.CART && (
                  <button
                    onClick={() => setStep(STEPS.SHIPPING)}
                    className="flex w-full items-center justify-center gap-2 rounded-md bg-neon py-4 font-black uppercase tracking-wide text-black transition-transform hover:scale-[1.01] active:scale-95"
                  >
                    <Truck className="h-5 w-5" />
                    Calcular frete
                  </button>
                )}

                {step === STEPS.CART && (
                  <button
                    onClick={clear}
                    className="mt-2 w-full text-center text-xs uppercase tracking-wider text-muted-foreground hover:text-destructive"
                  >
                    Limpar pedido
                  </button>
                )}
              </footer>
            )}
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}

function Field({ label, children }) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </label>
      {children}
    </div>
  );
}



