import { useEffect, useState } from "react";
import { useParams, useSearchParams, Link } from "react-router-dom";
import { CheckCircle2, XCircle, Clock, Loader2 } from "lucide-react";
import api from "@/lib/api";
import { STORE_NAME } from "@/lib/config";

const CONFIG = {
  sucesso: {
    icon: CheckCircle2,
    color: "text-neon",
    ring: "ring-neon",
    title: "Pagamento aprovado!",
    subtitle: "Seu pedido foi confirmado e já vamos preparar o envio.",
  },
  pendente: {
    icon: Clock,
    color: "text-amber-400",
    ring: "ring-amber-400",
    title: "Pagamento em análise",
    subtitle: "Assim que for aprovado, seu pedido é confirmado automaticamente.",
  },
  falha: {
    icon: XCircle,
    color: "text-destructive",
    ring: "ring-destructive",
    title: "Pagamento não aprovado",
    subtitle: "Algo deu errado com o pagamento. Você pode tentar novamente.",
  },
};

function CheckoutStatus({ variant }) {
  const [searchParams] = useSearchParams();
  const orderId = searchParams.get("pedido");
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(!!orderId);

  const { icon: Icon, color, ring, title, subtitle } = CONFIG[variant];

  useEffect(() => {
    if (!orderId) return;
    api
      .get(`/payments/status/${orderId}`)
      .then(({ data }) => setOrder(data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [orderId]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 text-center">
      <div className={`mb-6 flex h-20 w-20 items-center justify-center rounded-full ring-2 ${ring}`}>
        <Icon className={`h-10 w-10 ${color}`} />
      </div>

      <h1 className="mb-2 font-heading text-2xl uppercase tracking-wide text-white">{title}</h1>
      <p className="mb-6 max-w-sm text-sm text-muted-foreground">{subtitle}</p>

      {orderId && (
        <div className="mb-8 rounded-lg border border-border bg-card px-5 py-3 text-sm text-muted-foreground">
          Pedido <span className="text-white">#{orderId}</span>
          {loading && <Loader2 className="ml-2 inline h-3.5 w-3.5 animate-spin" />}
          {!loading && order && (
            <span className="ml-2 text-white">{formatMoney(order.total)}</span>
          )}
        </div>
      )}

      <Link
        to="/"
        className="rounded-lg bg-neon px-6 py-3 text-xs font-bold uppercase tracking-wide text-black transition-transform hover:scale-[1.02]"
      >
        Voltar para {STORE_NAME}
      </Link>
    </div>
  );
}

function formatMoney(v) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v || 0);
}

export default CheckoutStatus;
