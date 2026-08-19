import { Router } from "express";
import { all, get, run, insertAndGetId } from "../db.js";import { requireAuth } from "../middleware/auth.js";
import { sendMail } from "../utils/mailer.js";

const router = Router();

const STATUS_EMAIL = {
  confirmado: {
    subject: (id) => `Pedido confirmado - Pedido #${id}`,
    title: "Pedido confirmado",
    message: "Seu pedido foi confirmado e já está sendo preparado para envio.",
  },
  enviado: {
    subject: (id) => `Seu pedido saiu para entrega - Pedido #${id}`,
    title: "Pedido enviado",
    message: "Boas notícias! Seu pedido acabou de ser enviado e está a caminho.",
  },
  concluido: {
    subject: (id) => `Pedido entregue - Pedido #${id}`,
    title: "Pedido concluído",
    message: "Seu pedido foi entregue. Esperamos que você aproveite muito a sua compra!",
  },
  cancelado: {
    subject: (id) => `Pedido cancelado - Pedido #${id}`,
    title: "Pedido cancelado",
    message: "Seu pedido foi cancelado. Se você não esperava por isso, entre em contato com a gente.",
  },
};

function statusUpdateEmailHtml({ title, message }, order) {
  return `
    <h2>${title} - Pedido #${order.id}</h2>
    <p>${message}</p>
    <p>Você pode acompanhar todos os detalhes do pedido na área "Minha Conta &gt; Meus pedidos" do site.</p>
  `;
}

async function loadOrder(id) {
  const order = await get("SELECT * FROM orders WHERE id = ?", [id]);
  if (!order) return null;
  const items = await all("SELECT * FROM order_items WHERE order_id = ?", [id]);
  return { ...order, items };
}

async function withItems(orders) {
  return Promise.all(
    orders.map(async (o) => ({
      ...o,
      items: await all("SELECT * FROM order_items WHERE order_id = ?", [o.id]),
    }))
  );
}

const VALID_STATUS = [
  "aguardando_pagamento",
  "confirmado",
  "enviado",
  "concluido",
  "cancelado",
  "pagamento_recusado",
];

// GET /api/orders - listar pedidos (protegido)
// Suporta ?status= para filtrar e ?page/?pageSize para paginar. Sem esses
// parâmetros, mantém o comportamento antigo (lista tudo) por compatibilidade.
router.get("/", requireAuth, async (req, res) => {
  const { status, page, pageSize } = req.query;

  const where = [];
  const params = [];
  if (status && VALID_STATUS.includes(status)) {
    where.push("status = ?");
    params.push(status);
  }
  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

  if (!page && !pageSize) {
    const orders = await all(`SELECT * FROM orders ${whereSql} ORDER BY created_at DESC`, params);
    return res.json(await withItems(orders));
  }

  const p = Math.max(1, parseInt(page, 10) || 1);
  const size = Math.min(200, Math.max(1, parseInt(pageSize, 10) || 20));
  const offset = (p - 1) * size;

  const total = (await get(`SELECT COUNT(*) as c FROM orders ${whereSql}`, params))?.c || 0;
  const orders = await all(`SELECT * FROM orders ${whereSql} ORDER BY created_at DESC LIMIT ? OFFSET ?`, [
    ...params,
    size,
    offset,
  ]);

  res.json({
    data: await withItems(orders),
    page: p,
    pageSize: size,
    total,
    totalPages: Math.max(1, Math.ceil(total / size)),
  });
});

// GET /api/orders/:id - detalhe (protegido)
router.get("/:id", requireAuth, async (req, res) => {
  const order = await loadOrder(req.params.id);
  if (!order) return res.status(404).json({ error: "Pedido não encontrado." });
  res.json(order);
});

// PATCH /api/orders/:id/status - atualizar status manualmente (protegido)
// Uso: mudar pra "enviado" ou "concluido" depois de despachar. O status de
// pagamento em si (aprovado/pendente/recusado) só muda sozinho, via Mercado Pago.
router.patch("/:id/status", requireAuth, async (req, res) => {
  const { status } = req.body || {};
  if (!VALID_STATUS.includes(status)) {
    return res.status(400).json({ error: `status deve ser um de: ${VALID_STATUS.join(", ")}` });
  }

  const existing = await get("SELECT * FROM orders WHERE id = ?", [req.params.id]);
  if (!existing) return res.status(404).json({ error: "Pedido não encontrado." });

  // Quando o admin cancela um pedido manualmente (ou marca pagamento recusado),
  // o payment_status acompanha - assim ele sai da contagem de "pendentes".
  // Em qualquer outro status, payment_status continua só sob controle do
  // webhook do Mercado Pago (nunca é setado como aprovado por aqui).
  const paymentStatusOverride =
    status === "cancelado" ? "cancelado" : status === "pagamento_recusado" ? "recusado" : null;

  if (paymentStatusOverride) {
    await run("UPDATE orders SET status = ?, payment_status = ? WHERE id = ?", [
      status,
      paymentStatusOverride,
      req.params.id,
    ]);
  } else {
    await run("UPDATE orders SET status = ? WHERE id = ?", [status, req.params.id]);
  }
  const updated = await loadOrder(req.params.id);

  // Avisa o cliente por e-mail quando o status muda de verdade, pra ele poder
  // acompanhar o andamento do pedido sem precisar entrar no site toda hora.
  const template = STATUS_EMAIL[status];
  if (template && existing.status !== status && updated.customer_email) {
    sendMail({
      to: updated.customer_email,
      subject: template.subject(updated.id),
      html: statusUpdateEmailHtml(template, updated),
    });
  }

  res.json(updated);
});
// POST /api/orders/manual - registra uma venda fechada fora do sistema (WhatsApp).
// Sem frete e sem forma de pagamento: entra direto como concluída e aprovada,
// só pra manter estoque e estatísticas (mais vendidos, faturamento) corretos.
router.post("/manual", requireAuth, async (req, res) => {
  const { items, customerName = "" } = req.body || {};

  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: "Informe ao menos um produto vendido." });
  }

  const resolvedItems = [];
  for (const it of items) {
    const qty = Math.max(1, Number(it.qty) || 1);
    const product = await get("SELECT * FROM products WHERE id = ?", [it.productId]);
    if (!product) {
      return res.status(404).json({ error: `Produto não encontrado: ${it.productId}` });
    }
    resolvedItems.push({
      id: product.id,
      name: product.name,
      type: product.type,
      stock: product.stock,
      qty,
      price: Number(product.price) || 0,
    });
  }

  const total = resolvedItems.reduce((sum, it) => sum + it.price * it.qty, 0);

  const orderId = await insertAndGetId(
    `INSERT INTO orders (customer_name, shipping_cost, subtotal, total, status, payment_status, payment_method)
     VALUES (?, 0, ?, ?, 'concluido', 'aprovado', 'whatsapp')`,
    [customerName || "Venda WhatsApp", total, total]
  );

  for (const it of resolvedItems) {
    await run(
      `INSERT INTO order_items (order_id, product_id, product_name, qty, unit_price, subtotal)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [orderId, it.id, it.name, it.qty, it.price, it.price * it.qty]
    );

    if (it.type !== "encomenda") {
      const newStock = Math.max(0, (it.stock || 0) - it.qty);
      await run("UPDATE products SET stock = ? WHERE id = ?", [newStock, it.id]);
    }
  }

  const created = await get("SELECT * FROM orders WHERE id = ?", [orderId]);
  res.status(201).json(created);
});
export default router;