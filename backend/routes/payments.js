import crypto from "crypto";
import { Router } from "express";
import { all, get, run, insertAndGetId } from "../db.js";
import { attachCustomerIfPresent, requireCustomerAuth } from "../middleware/customerAuth.js";
import { sendMail, getAdminEmail } from "../utils/mailer.js";

const router = Router();

const MP_ACCESS_TOKEN = process.env.MP_ACCESS_TOKEN;
const MP_API = "https://api.mercadopago.com";
const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:5173";

async function loadOrder(id) {
  const order = await get("SELECT * FROM orders WHERE id = ?", [id]);
  if (!order) return null;
  const items = await all("SELECT * FROM order_items WHERE order_id = ?", [id]);
  return { ...order, items };
}

async function deletePendingOrder(orderId) {
  if (!orderId) return;
  await run("DELETE FROM order_items WHERE order_id = ?", [orderId]);
  await run("DELETE FROM orders WHERE id = ?", [orderId]);
}

// POST /api/payments/create-preference
// Cria o pedido (status "aguardando_pagamento") e gera o link de pagamento do Mercado Pago.
//
// IMPORTANTE: preço e disponibilidade de estoque NUNCA são confiados a partir do
// que o navegador manda. Tudo é validado/recalculado contra o banco aqui.
router.post("/create-preference", attachCustomerIfPresent, async (req, res) => {
  if (!MP_ACCESS_TOKEN) {
    return res.status(500).json({
      error:
        "Pagamento online ainda não configurado. Peça pro administrador da loja configurar o MP_ACCESS_TOKEN no backend.",
    });
  }

  const {
    customerName = "",
    customerPhone = "",
    customerEmail = "",
    cep = "",
    street = "",
    number = "",
    complement = "",
    neighborhood = "",
    city = "",
    uf = "",
    shippingCost = 0,
    shippingDaysMin = null,
    shippingDaysMax = null,
    items = [],
  } = req.body || {};

  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: "O pedido precisa ter ao menos um item." });
  }
  if (!customerName || !customerPhone) {
    return res.status(400).json({ error: "Nome e telefone são obrigatórios." });
  }
  if (!cep || !street || !number || !city || !uf) {
    return res.status(400).json({ error: "Endereço de entrega incompleto." });
  }

  // 1. Revalida cada item contra o banco: produto existe, está ativo, o preço
  //    real é o do banco (nunca o que veio do cliente) e, pra itens de pronta
  //    entrega, há estoque suficiente.
  const resolvedItems = [];
  const qtyByProduct = new Map();

  for (const it of items) {
    const qty = Math.max(1, Number(it.qty) || 1);

    if (!it.id) {
      // item sem produto cadastrado - não deveria acontecer no fluxo normal
      // da loja, então rejeita por segurança.
      return res.status(400).json({ error: "Item de pedido inválido." });
    }

    const product = await get("SELECT * FROM products WHERE id = ?", [it.id]);
    if (!product || !product.active) {
      return res.status(409).json({ error: `Produto indisponível: ${it.name || it.id}.` });
    }

    qtyByProduct.set(it.id, (qtyByProduct.get(it.id) || 0) + qty);

    resolvedItems.push({
      id: product.id,
      name: product.name,
      type: product.type,
      size: it.size || null,
      customName: it.customName || null,
      customNumber: it.customNumber || null,
      qty,
      price: Number(product.price) || 0, // preço vem do banco, nunca do cliente
    });
  }

  // Estoque só é controlado para itens de pronta entrega; sob encomenda é
  // produzido depois, então não depende de estoque físico.
  for (const [productId, qty] of qtyByProduct.entries()) {
    const product = await get("SELECT * FROM products WHERE id = ?", [productId]);
    if (product.type === "encomenda") continue;
    if ((product.stock || 0) < qty) {
      return res.status(409).json({
        error: `Estoque insuficiente para "${product.name}". Disponível: ${product.stock || 0}.`,
      });
    }
  }

  const subtotal = resolvedItems.reduce((sum, it) => sum + it.price * it.qty, 0);
  const total = subtotal + (Number(shippingCost) || 0);

  console.log("CLIENTE NO CHECKOUT:", req.customer);

  // 2. cria o pedido no nosso banco, ainda aguardando pagamento
  const orderId = await insertAndGetId(
    `INSERT INTO orders
      (customer_id, customer_name, customer_phone, customer_email, cep, street, number, complement, neighborhood, city, uf,
       shipping_cost, shipping_days_min, shipping_days_max, subtotal, total, status, payment_status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'aguardando_pagamento', 'pending')`,
    [
      req.customer?.id || null,
      customerName,
      customerPhone,
      customerEmail,
      cep,
      street,
      number,
      complement,
      neighborhood,
      city,
      uf,
      shippingCost,
      shippingDaysMin,
      shippingDaysMax,
      subtotal,
      total,
    ]
  );

  for (const it of resolvedItems) {
    await run(
      `INSERT INTO order_items (order_id, product_id, product_name, size, custom_name, custom_number, qty, unit_price, subtotal)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [orderId, it.id, it.name, it.size, it.customName, it.customNumber, it.qty, it.price, it.price * it.qty]
    );
  }

  // 3. monta a preferência no Mercado Pago (sempre com os preços do banco)
  const mpItems = resolvedItems.map((it) => ({
    title: it.name,
    quantity: it.qty,
    unit_price: it.price,
    currency_id: "BRL",
  }));

  if (Number(shippingCost) > 0) {
    mpItems.push({
      title: "Frete",
      quantity: 1,
      unit_price: Number(shippingCost),
      currency_id: "BRL",
    });
  }

  const preferenceBody = {
    items: mpItems,
    payer: {
      name: customerName,
      email: customerEmail || undefined,
      phone: customerPhone ? { number: customerPhone } : undefined,
    },
    external_reference: String(orderId),
    back_urls: {
      success: `${FRONTEND_URL}/checkout/sucesso?pedido=${orderId}`,
      failure: `${FRONTEND_URL}/checkout/falha?pedido=${orderId}`,
      pending: `${FRONTEND_URL}/checkout/pendente?pedido=${orderId}`,
    },
    notification_url: process.env.BACKEND_URL
      ? `${process.env.BACKEND_URL}/api/payments/webhook`
      : undefined,
  };

  try {
    const mpRes = await fetch(`${MP_API}/checkout/preferences`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${MP_ACCESS_TOKEN}`,
      },
      body: JSON.stringify(preferenceBody),
    });

    const mpData = await mpRes.json();

    if (!mpRes.ok) {
      console.error("Erro do Mercado Pago:", mpData);

      await deletePendingOrder(orderId);

      return res.status(502).json({
        error: "N�o foi poss�vel gerar o link de pagamento.",
        details: mpData
      });
    }

    await run("UPDATE orders SET mp_preference_id = ? WHERE id = ?", [mpData.id, orderId]);

    res.status(201).json({
      orderId,
      initPoint: mpData.init_point,
      sandboxInitPoint: mpData.sandbox_init_point,
    });
  } catch (err) {
    console.error("Falha ao chamar o Mercado Pago:", err);

    await deletePendingOrder(orderId);

    res.status(502).json({
      error: "Falha de comunica��o com o Mercado Pago."
    });
  }
});

// POST /api/payments/retry/:orderId - gera um novo link de pagamento para um pedido
// que já existe e ainda está aguardando pagamento (cliente desistiu da 1ª tentativa).
router.post("/retry/:orderId", requireCustomerAuth, async (req, res) => {
  if (!MP_ACCESS_TOKEN) {
    return res.status(500).json({ error: "Pagamento online ainda não configurado." });
  }

  const order = await get("SELECT * FROM orders WHERE id = ?", [req.params.orderId]);
  if (!order) return res.status(404).json({ error: "Pedido não encontrado." });
  if (order.customer_id !== req.customer.id) {
    return res.status(403).json({ error: "Este pedido não pertence a você." });
  }
  if (order.status !== "aguardando_pagamento") {
    return res.status(409).json({ error: "Este pedido não está mais aguardando pagamento." });
  }

  const items = await all("SELECT * FROM order_items WHERE order_id = ?", [order.id]);

  const mpItems = items.map((it) => ({
    title: it.product_name,
    quantity: it.qty,
    unit_price: Number(it.unit_price),
    currency_id: "BRL",
  }));

  if (Number(order.shipping_cost) > 0) {
    mpItems.push({
      title: "Frete",
      quantity: 1,
      unit_price: Number(order.shipping_cost),
      currency_id: "BRL",
    });
  }

  const preferenceBody = {
    items: mpItems,
    payer: {
      name: order.customer_name,
      email: order.customer_email || undefined,
      phone: order.customer_phone ? { number: order.customer_phone } : undefined,
    },
    external_reference: String(order.id),
    back_urls: {
      success: `${FRONTEND_URL}/checkout/sucesso?pedido=${order.id}`,
      failure: `${FRONTEND_URL}/checkout/falha?pedido=${order.id}`,
      pending: `${FRONTEND_URL}/checkout/pendente?pedido=${order.id}`,
    },
    notification_url: process.env.BACKEND_URL
      ? `${process.env.BACKEND_URL}/api/payments/webhook`
      : undefined,
  };

  try {
    const mpRes = await fetch(`${MP_API}/checkout/preferences`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${MP_ACCESS_TOKEN}`,
      },
      body: JSON.stringify(preferenceBody),
    });

    const mpData = await mpRes.json();

    if (!mpRes.ok) {
      console.error("Erro do Mercado Pago:", mpData);
      return res.status(502).json({ error: "Não foi possível gerar o link de pagamento." });
    }

    await run("UPDATE orders SET mp_preference_id = ? WHERE id = ?", [mpData.id, order.id]);

    res.json({
      orderId: order.id,
      initPoint: mpData.init_point,
      sandboxInitPoint: mpData.sandbox_init_point,
    });
  } catch (err) {
    console.error("Falha ao chamar o Mercado Pago:", err);
    res.status(502).json({ error: "Falha de comunicação com o Mercado Pago." });
  }
});

// POST /api/payments/retry/:orderId - gera um novo link de pagamento para um pedido
// que já existe e ainda está aguardando pagamento (cliente desistiu da 1ª tentativa).
router.post("/retry/:orderId", requireCustomerAuth, async (req, res) => {
  if (!MP_ACCESS_TOKEN) {
    return res.status(500).json({ error: "Pagamento online ainda não configurado." });
  }

  const order = await get("SELECT * FROM orders WHERE id = ?", [req.params.orderId]);
  if (!order) return res.status(404).json({ error: "Pedido não encontrado." });
  if (order.customer_id !== req.customer.id) {
    return res.status(403).json({ error: "Este pedido não pertence a você." });
  }
  if (order.status !== "aguardando_pagamento") {
    return res.status(409).json({ error: "Este pedido não está mais aguardando pagamento." });
  }

  const items = await all("SELECT * FROM order_items WHERE order_id = ?", [order.id]);

  const mpItems = items.map((it) => ({
    title: it.product_name,
    quantity: it.qty,
    unit_price: Number(it.unit_price),
    currency_id: "BRL",
  }));

  if (Number(order.shipping_cost) > 0) {
    mpItems.push({
      title: "Frete",
      quantity: 1,
      unit_price: Number(order.shipping_cost),
      currency_id: "BRL",
    });
  }

  const preferenceBody = {
    items: mpItems,
    payer: {
      name: order.customer_name,
      email: order.customer_email || undefined,
      phone: order.customer_phone ? { number: order.customer_phone } : undefined,
    },
    external_reference: String(order.id),
    back_urls: {
      success: `${FRONTEND_URL}/checkout/sucesso?pedido=${order.id}`,
      failure: `${FRONTEND_URL}/checkout/falha?pedido=${order.id}`,
      pending: `${FRONTEND_URL}/checkout/pendente?pedido=${order.id}`,
    },
    notification_url: process.env.BACKEND_URL
      ? `${process.env.BACKEND_URL}/api/payments/webhook`
      : undefined,
  };

  try {
    const mpRes = await fetch(`${MP_API}/checkout/preferences`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${MP_ACCESS_TOKEN}`,
      },
      body: JSON.stringify(preferenceBody),
    });

    const mpData = await mpRes.json();

    if (!mpRes.ok) {
      console.error("Erro do Mercado Pago:", mpData);
      return res.status(502).json({ error: "Não foi possível gerar o link de pagamento." });
    }

    await run("UPDATE orders SET mp_preference_id = ? WHERE id = ?", [mpData.id, order.id]);

    res.json({
      orderId: order.id,
      initPoint: mpData.init_point,
      sandboxInitPoint: mpData.sandbox_init_point,
    });
  } catch (err) {
    console.error("Falha ao chamar o Mercado Pago:", err);
    res.status(502).json({ error: "Falha de comunicação com o Mercado Pago." });
  }
});

// POST /api/payments/retry/:orderId - gera um novo link de pagamento para um pedido
// que já existe e ainda está aguardando pagamento (cliente desistiu da 1ª tentativa).
router.post("/retry/:orderId", requireCustomerAuth, async (req, res) => {
  if (!MP_ACCESS_TOKEN) {
    return res.status(500).json({ error: "Pagamento online ainda não configurado." });
  }

  const order = await get("SELECT * FROM orders WHERE id = ?", [req.params.orderId]);
  if (!order) return res.status(404).json({ error: "Pedido não encontrado." });
  if (order.customer_id !== req.customer.id) {
    return res.status(403).json({ error: "Este pedido não pertence a você." });
  }
  if (order.status !== "aguardando_pagamento") {
    return res.status(409).json({ error: "Este pedido não está mais aguardando pagamento." });
  }

  const items = await all("SELECT * FROM order_items WHERE order_id = ?", [order.id]);

  const mpItems = items.map((it) => ({
    title: it.product_name,
    quantity: it.qty,
    unit_price: Number(it.unit_price),
    currency_id: "BRL",
  }));

  if (Number(order.shipping_cost) > 0) {
    mpItems.push({
      title: "Frete",
      quantity: 1,
      unit_price: Number(order.shipping_cost),
      currency_id: "BRL",
    });
  }

  const preferenceBody = {
    items: mpItems,
    payer: {
      name: order.customer_name,
      email: order.customer_email || undefined,
      phone: order.customer_phone ? { number: order.customer_phone } : undefined,
    },
    external_reference: String(order.id),
    back_urls: {
      success: `${FRONTEND_URL}/checkout/sucesso?pedido=${order.id}`,
      failure: `${FRONTEND_URL}/checkout/falha?pedido=${order.id}`,
      pending: `${FRONTEND_URL}/checkout/pendente?pedido=${order.id}`,
    },
    notification_url: process.env.BACKEND_URL
      ? `${process.env.BACKEND_URL}/api/payments/webhook`
      : undefined,
  };

  try {
    const mpRes = await fetch(`${MP_API}/checkout/preferences`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${MP_ACCESS_TOKEN}`,
      },
      body: JSON.stringify(preferenceBody),
    });

    const mpData = await mpRes.json();

    if (!mpRes.ok) {
      console.error("Erro do Mercado Pago:", mpData);
      return res.status(502).json({ error: "Não foi possível gerar o link de pagamento." });
    }

    await run("UPDATE orders SET mp_preference_id = ? WHERE id = ?", [mpData.id, order.id]);

    res.json({
      orderId: order.id,
      initPoint: mpData.init_point,
      sandboxInitPoint: mpData.sandbox_init_point,
    });
  } catch (err) {
    console.error("Falha ao chamar o Mercado Pago:", err);
    res.status(502).json({ error: "Falha de comunicação com o Mercado Pago." });
  }
});

// POST /api/payments/retry/:orderId - gera um novo link de pagamento para um pedido
// que já existe e ainda está aguardando pagamento (cliente desistiu da 1ª tentativa).
router.post("/retry/:orderId", requireCustomerAuth, async (req, res) => {
  if (!MP_ACCESS_TOKEN) {
    return res.status(500).json({ error: "Pagamento online ainda não configurado." });
  }

  const order = await get("SELECT * FROM orders WHERE id = ?", [req.params.orderId]);
  if (!order) return res.status(404).json({ error: "Pedido não encontrado." });
  if (order.customer_id !== req.customer.id) {
    return res.status(403).json({ error: "Este pedido não pertence a você." });
  }
  if (order.status !== "aguardando_pagamento") {
    return res.status(409).json({ error: "Este pedido não está mais aguardando pagamento." });
  }

  const items = await all("SELECT * FROM order_items WHERE order_id = ?", [order.id]);

  const mpItems = items.map((it) => ({
    title: it.product_name,
    quantity: it.qty,
    unit_price: Number(it.unit_price),
    currency_id: "BRL",
  }));

  if (Number(order.shipping_cost) > 0) {
    mpItems.push({
      title: "Frete",
      quantity: 1,
      unit_price: Number(order.shipping_cost),
      currency_id: "BRL",
    });
  }

  const preferenceBody = {
    items: mpItems,
    payer: {
      name: order.customer_name,
      email: order.customer_email || undefined,
      phone: order.customer_phone ? { number: order.customer_phone } : undefined,
    },
    external_reference: String(order.id),
    back_urls: {
      success: `${FRONTEND_URL}/checkout/sucesso?pedido=${order.id}`,
      failure: `${FRONTEND_URL}/checkout/falha?pedido=${order.id}`,
      pending: `${FRONTEND_URL}/checkout/pendente?pedido=${order.id}`,
    },
    notification_url: process.env.BACKEND_URL
      ? `${process.env.BACKEND_URL}/api/payments/webhook`
      : undefined,
  };

  try {
    const mpRes = await fetch(`${MP_API}/checkout/preferences`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${MP_ACCESS_TOKEN}`,
      },
      body: JSON.stringify(preferenceBody),
    });

    const mpData = await mpRes.json();

    if (!mpRes.ok) {
      console.error("Erro do Mercado Pago:", mpData);
      return res.status(502).json({ error: "Não foi possível gerar o link de pagamento." });
    }

    await run("UPDATE orders SET mp_preference_id = ? WHERE id = ?", [mpData.id, order.id]);

    res.json({
      orderId: order.id,
      initPoint: mpData.init_point,
      sandboxInitPoint: mpData.sandbox_init_point,
    });
  } catch (err) {
    console.error("Falha ao chamar o Mercado Pago:", err);
    res.status(502).json({ error: "Falha de comunicação com o Mercado Pago." });
  }
});

// POST /api/payments/retry/:orderId - gera um novo link de pagamento para um pedido
// que já existe e ainda está aguardando pagamento (cliente desistiu da 1ª tentativa).
router.post("/retry/:orderId", requireCustomerAuth, async (req, res) => {
  if (!MP_ACCESS_TOKEN) {
    return res.status(500).json({ error: "Pagamento online ainda não configurado." });
  }

  const order = await get("SELECT * FROM orders WHERE id = ?", [req.params.orderId]);
  if (!order) return res.status(404).json({ error: "Pedido não encontrado." });
  if (order.customer_id !== req.customer.id) {
    return res.status(403).json({ error: "Este pedido não pertence a você." });
  }
  if (order.status !== "aguardando_pagamento") {
    return res.status(409).json({ error: "Este pedido não está mais aguardando pagamento." });
  }

  const items = await all("SELECT * FROM order_items WHERE order_id = ?", [order.id]);

  const mpItems = items.map((it) => ({
    title: it.product_name,
    quantity: it.qty,
    unit_price: Number(it.unit_price),
    currency_id: "BRL",
  }));

  if (Number(order.shipping_cost) > 0) {
    mpItems.push({
      title: "Frete",
      quantity: 1,
      unit_price: Number(order.shipping_cost),
      currency_id: "BRL",
    });
  }

  const preferenceBody = {
    items: mpItems,
    payer: {
      name: order.customer_name,
      email: order.customer_email || undefined,
      phone: order.customer_phone ? { number: order.customer_phone } : undefined,
    },
    external_reference: String(order.id),
    back_urls: {
      success: `${FRONTEND_URL}/checkout/sucesso?pedido=${order.id}`,
      failure: `${FRONTEND_URL}/checkout/falha?pedido=${order.id}`,
      pending: `${FRONTEND_URL}/checkout/pendente?pedido=${order.id}`,
    },
    notification_url: process.env.BACKEND_URL
      ? `${process.env.BACKEND_URL}/api/payments/webhook`
      : undefined,
  };

  try {
    const mpRes = await fetch(`${MP_API}/checkout/preferences`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${MP_ACCESS_TOKEN}`,
      },
      body: JSON.stringify(preferenceBody),
    });

    const mpData = await mpRes.json();

    if (!mpRes.ok) {
      console.error("Erro do Mercado Pago:", mpData);
      return res.status(502).json({ error: "Não foi possível gerar o link de pagamento." });
    }

    await run("UPDATE orders SET mp_preference_id = ? WHERE id = ?", [mpData.id, order.id]);

    res.json({
      orderId: order.id,
      initPoint: mpData.init_point,
      sandboxInitPoint: mpData.sandbox_init_point,
    });
  } catch (err) {
    console.error("Falha ao chamar o Mercado Pago:", err);
    res.status(502).json({ error: "Falha de comunicação com o Mercado Pago." });
  }
});

// POST /api/payments/retry/:orderId - gera um novo link de pagamento para um pedido
// que já existe e ainda está aguardando pagamento (cliente desistiu da 1ª tentativa).
router.post("/retry/:orderId", requireCustomerAuth, async (req, res) => {
  if (!MP_ACCESS_TOKEN) {
    return res.status(500).json({ error: "Pagamento online ainda não configurado." });
  }

  const order = await get("SELECT * FROM orders WHERE id = ?", [req.params.orderId]);
  if (!order) return res.status(404).json({ error: "Pedido não encontrado." });
  if (order.customer_id !== req.customer.id) {
    return res.status(403).json({ error: "Este pedido não pertence a você." });
  }
  if (order.status !== "aguardando_pagamento") {
    return res.status(409).json({ error: "Este pedido não está mais aguardando pagamento." });
  }

  const items = await all("SELECT * FROM order_items WHERE order_id = ?", [order.id]);

  const mpItems = items.map((it) => ({
    title: it.product_name,
    quantity: it.qty,
    unit_price: Number(it.unit_price),
    currency_id: "BRL",
  }));

  if (Number(order.shipping_cost) > 0) {
    mpItems.push({
      title: "Frete",
      quantity: 1,
      unit_price: Number(order.shipping_cost),
      currency_id: "BRL",
    });
  }

  const preferenceBody = {
    items: mpItems,
    payer: {
      name: order.customer_name,
      email: order.customer_email || undefined,
      phone: order.customer_phone ? { number: order.customer_phone } : undefined,
    },
    external_reference: String(order.id),
    back_urls: {
      success: `${FRONTEND_URL}/checkout/sucesso?pedido=${order.id}`,
      failure: `${FRONTEND_URL}/checkout/falha?pedido=${order.id}`,
      pending: `${FRONTEND_URL}/checkout/pendente?pedido=${order.id}`,
    },
    notification_url: process.env.BACKEND_URL
      ? `${process.env.BACKEND_URL}/api/payments/webhook`
      : undefined,
  };

  try {
    const mpRes = await fetch(`${MP_API}/checkout/preferences`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${MP_ACCESS_TOKEN}`,
      },
      body: JSON.stringify(preferenceBody),
    });

    const mpData = await mpRes.json();

    if (!mpRes.ok) {
      console.error("Erro do Mercado Pago:", mpData);
      return res.status(502).json({ error: "Não foi possível gerar o link de pagamento." });
    }

    await run("UPDATE orders SET mp_preference_id = ? WHERE id = ?", [mpData.id, order.id]);

    res.json({
      orderId: order.id,
      initPoint: mpData.init_point,
      sandboxInitPoint: mpData.sandbox_init_point,
    });
  } catch (err) {
    console.error("Falha ao chamar o Mercado Pago:", err);
    res.status(502).json({ error: "Falha de comunicação com o Mercado Pago." });
  }
});

// GET /api/payments/status/:orderId - o front consulta pra saber se já confirmou
router.get("/status/:orderId", async (req, res) => {
  const order = await loadOrder(req.params.orderId);
  if (!order) return res.status(404).json({ error: "Pedido não encontrado." });
  res.json({
    orderId: order.id,
    status: order.status,
    paymentStatus: order.payment_status,
    total: order.total,
  });
});

// Valida a assinatura enviada pelo Mercado Pago no header x-signature, seguindo
// o esquema oficial: HMAC-SHA256 de "id:{data.id};request-id:{x-request-id};ts:{ts};"
// usando a Webhook Secret configurada no painel do Mercado Pago (MP_WEBHOOK_SECRET).
// Docs: https://www.mercadopago.com.br/developers/pt/docs/checkout-api/webhooks
function isValidWebhookSignature(req, dataId) {
  const secret = process.env.MP_WEBHOOK_SECRET;
  if (!secret) return { valid: false, configured: false };

  const signatureHeader = req.headers["x-signature"];
  const requestId = req.headers["x-request-id"];
  if (!signatureHeader || !requestId || !dataId) return { valid: false, configured: true };

  const parts = String(signatureHeader)
    .split(",")
    .map((p) => p.trim())
    .reduce((acc, part) => {
      const [key, value] = part.split("=");
      if (key && value) acc[key.trim()] = value.trim();
      return acc;
    }, {});

  const { ts, v1 } = parts;
  if (!ts || !v1) return { valid: false, configured: true };

  const manifest = `id:${String(dataId).toLowerCase()};request-id:${requestId};ts:${ts};`;
  const expectedHash = crypto.createHmac("sha256", secret).update(manifest).digest("hex");

  let valid = false;
  try {
    valid =
      expectedHash.length === v1.length &&
      crypto.timingSafeEqual(Buffer.from(expectedHash), Buffer.from(v1));
  } catch {
    valid = false;
  }

  return { valid, configured: true };
}

function orderConfirmationEmailHtml(order) {
  const itemsHtml = order.items
    .map(
      (it) =>
        `<tr><td style="padding:4px 8px;">${it.qty}x ${it.product_name}${
          it.size ? ` (Tam. ${it.size})` : ""
        }</td><td style="padding:4px 8px; text-align:right;">R$ ${Number(it.subtotal).toFixed(2)}</td></tr>`
    )
    .join("");
  return `
    <h2>Pagamento confirmado - Pedido #${order.id}</h2>
    <p>Recebemos seu pagamento e já estamos preparando seu pedido.</p>
    <table style="border-collapse:collapse; width:100%; max-width:480px;">${itemsHtml}</table>
    <p><strong>Total: R$ ${Number(order.total).toFixed(2)}</strong></p>
    <p>Endereço de entrega: ${order.street}, ${order.number} - ${order.neighborhood}, ${order.city}/${order.uf}</p>
  `;
}

// POST /api/payments/webhook - o Mercado Pago chama isso quando o status do pagamento muda
router.post("/webhook", async (req, res) => {
  const paymentId = req.query["data.id"] || req.body?.data?.id;
  const type = req.query.type || req.body?.type;

  // Rejeita chamadas com assinatura inválida (ou ausente, quando a secret
  // está configurada) antes de processar qualquer coisa - evita que qualquer
  // um finja um pagamento aprovado só chamando essa rota.
  const { valid, configured } = isValidWebhookSignature(req, paymentId);
  if (configured && !valid) {
    console.warn("Webhook do Mercado Pago rejeitado: assinatura inválida.");
    return res.sendStatus(401);
  }
  if (!configured) {
    console.warn(
      "MP_WEBHOOK_SECRET não configurado - a assinatura do webhook não está sendo verificada. " +
        "Configure essa variável (painel do Mercado Pago -> Webhooks) antes de vender de verdade."
    );
  }

  // confirma recebimento rápido pro Mercado Pago não ficar reenviando
  res.sendStatus(200);

  try {
    if (type !== "payment" || !paymentId || !MP_ACCESS_TOKEN) return;

    const mpRes = await fetch(`${MP_API}/v1/payments/${paymentId}`, {
      headers: { Authorization: `Bearer ${MP_ACCESS_TOKEN}` },
    });
    const payment = await mpRes.json();
    if (!mpRes.ok) {
      console.error("Erro do Mercado Pago:", mpData);

      await deletePendingOrder(orderId);

      return res.status(502).json({
        error: "N�o foi poss�vel gerar o link de pagamento.",
        details: mpData
      });
    }

    const orderId = payment.external_reference;
    const order = await get("SELECT * FROM orders WHERE id = ?", [orderId]);
    if (!order) return;

    const statusMap = {
      approved: { status: "confirmado", paymentStatus: "aprovado" },
      pending: { status: "aguardando_pagamento", paymentStatus: "pendente" },
      in_process: { status: "aguardando_pagamento", paymentStatus: "em_analise" },
      rejected: { status: "pagamento_recusado", paymentStatus: "recusado" },
      cancelled: { status: "cancelado", paymentStatus: "cancelado" },
      refunded: { status: "cancelado", paymentStatus: "reembolsado" },
    };
    const mapped = statusMap[payment.status] || { status: order.status, paymentStatus: payment.status };

    await run("UPDATE orders SET status = ?, payment_status = ?, payment_method = ?, mp_payment_id = ? WHERE id = ?", [
      mapped.status,
      mapped.paymentStatus,
      payment.payment_type_id || null,
      payment.id,
      orderId,
    ]);

    // baixa o estoque e dispara notificações só quando o pagamento é aprovado, e só uma vez
    if (payment.status === "approved" && order.payment_status !== "aprovado") {
      const items = await all("SELECT * FROM order_items WHERE order_id = ?", [orderId]);
      for (const it of items) {
        if (!it.product_id) continue;
        const product = await get("SELECT * FROM products WHERE id = ?", [it.product_id]);
        if (product && product.type !== "encomenda") {
          const newStock = Math.max(0, (product.stock || 0) - (it.qty || 1));
          if ((product.stock || 0) - (it.qty || 1) < 0) {
            console.warn(`Estoque negativo evitado para o produto ${product.id} - venda registrada mesmo assim.`);
          }
          await run("UPDATE products SET stock = ? WHERE id = ?", [newStock, it.product_id]);
        }
      }

      const fullOrder = await loadOrder(orderId);
      const adminEmail = getAdminEmail();
      if (adminEmail) {
        sendMail({
          to: adminEmail,
          subject: `Nova venda confirmada - Pedido #${orderId}`,
          html: orderConfirmationEmailHtml(fullOrder),
        });
      }
      if (fullOrder.customer_email) {
        sendMail({
          to: fullOrder.customer_email,
          subject: `Recebemos seu pagamento - Pedido #${orderId}`,
          html: orderConfirmationEmailHtml(fullOrder),
        });
      }
    }
  } catch (err) {
    console.error("Falha ao chamar o Mercado Pago:", err);

    await deletePendingOrder(orderId);

    res.status(502).json({
      error: "Falha de comunica��o com o Mercado Pago."
    });
  }
});

export default router;








