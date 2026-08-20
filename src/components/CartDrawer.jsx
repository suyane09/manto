import React, { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  X,
  Plus,
  Minus,
  Trash2,
  ShoppingBag,
  MapPin,
  ChevronLeft,
  MessageCircle,
} from "lucide-react";
import { useCart } from "@/context/CartContext";
import { useCustomerAuth } from "@/context/CustomerAuthContext";
import { formatBRL } from "@/lib/config";

// Número do WhatsApp que recebe os pedidos (DDI + DDD + número, só dígitos)
const WHATSAPP_NUMBER = "5582996270952";

const STEPS = { CART: "cart", DETAILS: "details" };

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

  const { customer, isAuthenticated, openDrawer } = useCustomerAuth();

  const [step, setStep] = useState(STEPS.CART);

  const [form, setForm] = useState({
    name: "",
    phone: "",
    street: "",
    number: "",
    complement: "",
    neighborhood: "",
    city: "",
    uf: "",
  });

  // Mantém os dados do formulário sincronizados com a conta do cliente.
  // Roda de novo sempre que o login mudar (ex: cliente loga com o carrinho
  // já aberto) ou os dados cadastrais forem atualizados.
  React.useEffect(() => {
    if (isAuthenticated && customer) {
      setForm({
        name: customer.name || "",
        phone: customer.phone || "",
        street: customer.street || "",
        number: customer.number || "",
        complement: customer.complement || "",
        neighborhood: customer.neighborhood || "",
        city: customer.city || "",
        uf: customer.uf || "",
      });
    }
  }, [isAuthenticated, customer]);

  function resetCheckout() {
    setStep(STEPS.CART);
  }

  function handleClose() {
    closeCart();
    // não reseta na hora pra não "piscar" o conteúdo enquanto a gaveta fecha
    setTimeout(resetCheckout, 300);
  }

  function buildWhatsAppMessage() {
    const lines = [];
    lines.push("Olá! Quero fazer o seguinte pedido:");
    lines.push("");

    items.forEach((it) => {
      let line = `• ${it.qty}x ${it.name} (Tam: ${it.size})`;
      if (it.customName) {
        line += ` - ${it.customName}${it.customNumber ? " #" + it.customNumber : ""}`;
      }
      line += ` - ${formatBRL(it.qty * it.price)}`;
      lines.push(line);
    });

    lines.push("");
    lines.push(`Total: ${formatBRL(totalPrice)}`);
    lines.push("");
    lines.push(`Nome: ${form.name}`);
    lines.push(`Telefone: ${form.phone}`);

    const hasAddress = form.street || form.city;
    if (hasAddress) {
      lines.push("");
      lines.push("Endereço para entrega:");
      lines.push(
        `${form.street}${form.number ? ", " + form.number : ""}${
          form.complement ? " - " + form.complement : ""
        }`
      );
      lines.push(`${form.neighborhood ? form.neighborhood + " - " : ""}${form.city}/${form.uf}`);
    }

    return lines.join("\n");
  }

  function handleSendWhatsApp(e) {
    e.preventDefault();
    const message = buildWhatsAppMessage();
    const url = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
    window.open(url, "_blank");
    clear();
    handleClose();
  }

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
                    onClick={() => setStep(STEPS.CART)}
                    className="rounded-full p-1.5 text-white hover:bg-muted"
                    aria-label="Voltar"
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </button>
                )}
                <div>
                  <p className="font-heading text-lg uppercase tracking-wide text-white">
                    {step === STEPS.CART && "Pedido Tático"}
                    {step === STEPS.DETAILS && "Seus dados"}
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
              ) : (
                <form onSubmit={handleSendWhatsApp} className="space-y-4">
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

                  <div className="space-y-3 rounded-lg border border-border bg-background/50 p-3">
                    <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      <MapPin className="h-3.5 w-3.5" />
                      Endereço para entrega (opcional)
                    </p>

                    <Field label="Rua">
                      <input
                        className="input"
                        value={form.street}
                        onChange={(e) => setForm({ ...form, street: e.target.value })}
                      />
                    </Field>

                    <div className="grid grid-cols-2 gap-3">
                      <Field label="Número">
                        <input
                          className="input"
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

                    <Field label="Bairro">
                      <input
                        className="input"
                        value={form.neighborhood}
                        onChange={(e) => setForm({ ...form, neighborhood: e.target.value })}
                      />
                    </Field>

                    <div className="grid grid-cols-2 gap-3">
                      <Field label="Cidade">
                        <input
                          className="input"
                          value={form.city}
                          onChange={(e) => setForm({ ...form, city: e.target.value })}
                        />
                      </Field>
                      <Field label="UF">
                        <input
                          className="input"
                          maxLength={2}
                          value={form.uf}
                          onChange={(e) => setForm({ ...form, uf: e.target.value })}
                        />
                      </Field>
                    </div>
                  </div>

                  <button
                    type="submit"
                    className="flex w-full items-center justify-center gap-2 rounded-lg bg-neon py-4 font-black uppercase tracking-wide text-black transition-transform hover:scale-[1.01] active:scale-95"
                  >
                    <MessageCircle className="h-5 w-5" />
                    Finalizar pelo WhatsApp
                  </button>
                </form>
              )}
            </div>

            {items.length > 0 && (
              <footer className="border-t border-border p-5">
                <div className="mb-4 flex items-center justify-between">
                  <span className="text-sm uppercase tracking-wider text-muted-foreground">Total</span>
                  <span className="font-heading text-2xl tracking-wide text-white">
                    {formatBRL(totalPrice)}
                  </span>
                </div>

                {step === STEPS.CART && (
                  <button
                    onClick={() => {
                      // Só deixa avançar pro checkout se o cliente tiver conta.
                      // Sem login, abre a gaveta de login/cadastro em vez de seguir.
                      if (!isAuthenticated) {
                        openDrawer();
                        return;
                      }
                      setStep(STEPS.DETAILS);
                    }}
                    className="flex w-full items-center justify-center gap-2 rounded-md bg-neon py-4 font-black uppercase tracking-wide text-black transition-transform hover:scale-[1.01] active:scale-95"
                  >
                    <MessageCircle className="h-5 w-5" />
                    {isAuthenticated ? "Finalizar pelo WhatsApp" : "Entrar para finalizar"}
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