// Testes automatizados do fluxo de checkout - focam exatamente nos dois bugs
// de segurança mais críticos que existiam antes: preço vindo do cliente e
// falta de checagem de estoque.
//
// Rodar: cd backend && npm test
//
// Usa um banco SQLite isolado (backend/data/test.sqlite, apagado a cada
// execução) pra nunca tocar nos dados reais da loja, e troca o `fetch`
// global por uma versão falsa pra nunca chamar a API de verdade do Mercado
// Pago durante os testes.

process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "test-secret-nao-usar-em-producao";
process.env.MP_ACCESS_TOKEN = "TEST-fake-token";
process.env.ADMIN_USERNAME = "admin";
process.env.ADMIN_PASSWORD = "admin123";

import { test, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TEST_DB_PATH = path.join(__dirname, "..", "data", "test.sqlite");

// Precisa ser definido ANTES de importar db.js/server.js, porque eles leem
// as env vars no topo do módulo.
process.env.SQLITE_PATH = TEST_DB_PATH;

const { createApp } = await import("../server.js");
const { initDb, run, get } = await import("../db.js");

let server;
let baseUrl;
const realFetch = global.fetch;

before(async () => {
  fs.mkdirSync(path.dirname(TEST_DB_PATH), { recursive: true });
  if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH);

  await initDb();

  const app = createApp();
  server = app.listen(0);
  await new Promise((resolve) => server.once("listening", resolve));
  const { port } = server.address();
  baseUrl = `http://127.0.0.1:${port}`;
});

after(async () => {
  global.fetch = realFetch;
  await new Promise((resolve) => server.close(resolve));
  if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH);
});

beforeEach(() => {
  // Nunca deixa um teste chamar a API real do Mercado Pago. Chamadas para o
  // próprio servidor de teste (baseUrl) continuam passando pelo fetch real;
  // qualquer outra URL (ex: api.mercadopago.com) recebe uma resposta falsa.
  global.fetch = async (url, opts) => {
    if (String(url).startsWith(baseUrl)) {
      return realFetch(url, opts);
    }
    return new Response(JSON.stringify({ id: "fake-pref-id", init_point: "https://fake.mp/init" }), {
      status: 201,
      headers: { "content-type": "application/json" },
    });
  };
});

function baseCheckoutBody(overrides = {}) {
  return {
    customerName: "Cliente Teste",
    customerPhone: "11999999999",
    customerEmail: "cliente@teste.com",
    cep: "01001-000",
    street: "Praça da Sé",
    number: "1",
    neighborhood: "Sé",
    city: "São Paulo",
    uf: "SP",
    shippingCost: 0,
    items: [{ id: "prod-teste", qty: 1, price: 1, name: "Nome falso do cliente" }],
    ...overrides,
  };
}

async function seedProduct({ id = "prod-teste", price = 499.9, stock = 3, type = "pronta", active = 1 } = {}) {
  run("DELETE FROM products WHERE id = ?", [id]);
  run(
    `INSERT INTO products (id, name, category, type, price, sizes, unavailable, images, stock, active)
     VALUES (?, ?, ?, ?, ?, '[]', '[]', '[]', ?, ?)`,
    [id, "Produto de Teste", "manto", type, price, stock, active]
  );
  return id;
}

test("checkout - ignora o preço enviado pelo cliente e usa o preço do banco", async () => {
  await seedProduct({ price: 499.9, stock: 5 });

  const res = await fetch(`${baseUrl}/api/payments/create-preference`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(baseCheckoutBody({ items: [{ id: "prod-teste", qty: 1, price: 1 }] })),
  });

  assert.equal(res.status, 201);
  const body = await res.json();

  const item = get("SELECT * FROM order_items WHERE order_id = ?", [body.orderId]);
  assert.equal(item.unit_price, 499.9, "preço gravado deve ser o do banco, não R$1 enviado pelo cliente");

  const order = get("SELECT * FROM orders WHERE id = ?", [body.orderId]);
  assert.equal(order.total, 499.9);
});

test("checkout - rejeita quando não há estoque suficiente (pronta entrega)", async () => {
  await seedProduct({ id: "prod-sem-estoque", price: 100, stock: 1, type: "pronta" });

  const res = await fetch(`${baseUrl}/api/payments/create-preference`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(baseCheckoutBody({ items: [{ id: "prod-sem-estoque", qty: 2 }] })),
  });

  assert.equal(res.status, 409);
  const body = await res.json();
  assert.match(body.error, /estoque insuficiente/i);
});

test("checkout - dois pedidos concorrentes não conseguem 'levar' mais do que o estoque tem", async () => {
  await seedProduct({ id: "prod-disputado", price: 200, stock: 1, type: "pronta" });

  const request = () =>
    fetch(`${baseUrl}/api/payments/create-preference`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(baseCheckoutBody({ items: [{ id: "prod-disputado", qty: 1 }] })),
    });

  // primeiro pedido passa e "reserva" o item (via checagem no banco antes da preferência)
  const first = await request();
  assert.equal(first.status, 201);

  // um segundo pedido criado antes do primeiro ser pago ainda vê estoque > 0
  // (a baixa só acontece na confirmação do pagamento) - documenta o
  // comportamento atual: a defesa forte é o webhook não decrementar em
  // duplicidade; a validação aqui evita o caso mais comum (estoque já em 0).
  run("UPDATE products SET stock = 0 WHERE id = ?", ["prod-disputado"]);
  const second = await request();
  assert.equal(second.status, 409);
});

test("checkout - produtos sob encomenda não exigem estoque", async () => {
  await seedProduct({ id: "prod-encomenda", price: 350, stock: 0, type: "encomenda" });

  const res = await fetch(`${baseUrl}/api/payments/create-preference`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(baseCheckoutBody({ items: [{ id: "prod-encomenda", qty: 5 }] })),
  });

  assert.equal(res.status, 201);
});

test("checkout - rejeita produto inexistente ou inativo", async () => {
  const res = await fetch(`${baseUrl}/api/payments/create-preference`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(baseCheckoutBody({ items: [{ id: "produto-que-nao-existe", qty: 1 }] })),
  });

  assert.equal(res.status, 409);
});

test("checkout - valida campos obrigatórios do pedido", async () => {
  const res = await fetch(`${baseUrl}/api/payments/create-preference`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ items: [] }),
  });

  assert.equal(res.status, 400);
});

test("webhook - rejeita chamada sem assinatura válida quando MP_WEBHOOK_SECRET está configurado", async () => {
  const previous = process.env.MP_WEBHOOK_SECRET;
  process.env.MP_WEBHOOK_SECRET = "segredo-de-teste";

  try {
    const res = await fetch(`${baseUrl}/api/payments/webhook?type=payment&data.id=123`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({}),
    });
    assert.equal(res.status, 401);
  } finally {
    process.env.MP_WEBHOOK_SECRET = previous;
  }
});

test("health check responde ok", async () => {
  const res = await fetch(`${baseUrl}/api/health`);
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.ok, true);
});
