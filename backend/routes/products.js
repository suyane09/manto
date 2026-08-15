import { Router } from "express";
import { all, get, run } from "../db.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

function parseProduct(row) {
  return {
    ...row,
    sizes: JSON.parse(row.sizes || "[]"),
    unavailable: JSON.parse(row.unavailable || "[]"),
    images: JSON.parse(row.images || "[]"),
    active: !!row.active,
  };
}

// GET /api/products - lista p�blica (usada pela loja e pelo painel)
// Sem par�metros, continua devolvendo a lista inteira (� o que a loja precisa
// pra filtrar no cliente). Se vier ?page e ?pageSize, devolve paginado -
// �til pro painel admin quando o cat�logo crescer bastante.
router.get("/", async (req, res) => {
  const { page, pageSize } = req.query;

  if (!page && !pageSize) {
    const rows = await all("SELECT * FROM products ORDER BY created_at DESC");
    return res.json(rows.map(parseProduct));
  }

  const p = Math.max(1, parseInt(page, 10) || 1);
  const size = Math.min(200, Math.max(1, parseInt(pageSize, 10) || 20));
  const offset = (p - 1) * size;

  const total = (await get("SELECT COUNT(*) as c FROM products"))?.c || 0;
  const rows = await all("SELECT * FROM products ORDER BY created_at DESC LIMIT ? OFFSET ?", [size, offset]);

  res.json({
    data: rows.map(parseProduct),
    page: p,
    pageSize: size,
    total,
    totalPages: Math.max(1, Math.ceil(total / size)),
  });
});

// GET /api/products/:id
router.get("/:id", async (req, res) => {
  const row = await get("SELECT * FROM products WHERE id = ?", [req.params.id]);
  if (!row) return res.status(404).json({ error: "Produto n�o encontrado." });
  res.json(parseProduct(row));
});

// POST /api/products - criar (protegido)
router.post("/", requireAuth, async (req, res) => {
  const {
    id,
    name,
    category = "",
    type = "",
    price = 0,
    sizes = [],
    unavailable = [],
    images = [],
    stock = 0,
  } = req.body || {};

  if (!id || !name) {
    return res.status(400).json({ error: "id e name s�o obrigat�rios." });
  }

  const exists = await get("SELECT id FROM products WHERE id = ?", [id]);
  if (exists) {
    return res.status(409).json({ error: "J� existe um produto com esse id." });
  }

  await run(
    `INSERT INTO products (id, name, category, type, price, sizes, unavailable, images, stock)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, name, category, type, price, JSON.stringify(sizes), JSON.stringify(unavailable), JSON.stringify(images), stock]
  );

  const row = await get("SELECT * FROM products WHERE id = ?", [id]);
  res.status(201).json(parseProduct(row));
});

// PUT /api/products/:id - atualizar (protegido)
router.put("/:id", requireAuth, async (req, res) => {
  const existing = await get("SELECT * FROM products WHERE id = ?", [req.params.id]);
  if (!existing) return res.status(404).json({ error: "Produto n�o encontrado." });

  const {
    name = existing.name,
    category = existing.category,
    type = existing.type,
    price = existing.price,
    sizes,
    unavailable,
    images,
    stock = existing.stock,
    active = existing.active,
  } = req.body || {};

  await run(
    `UPDATE products SET name=?, category=?, type=?, price=?, sizes=?, unavailable=?, images=?, stock=?, active=?, updated_at=datetime('now')
     WHERE id=?`,
    [
      name,
      category,
      type,
      price,
      JSON.stringify(sizes ?? JSON.parse(existing.sizes || "[]")),
      JSON.stringify(unavailable ?? JSON.parse(existing.unavailable || "[]")),
      JSON.stringify(images ?? JSON.parse(existing.images || "[]")),
      stock,
      active ? 1 : 0,
      req.params.id,
    ]
  );

  const row = await get("SELECT * FROM products WHERE id = ?", [req.params.id]);
  res.json(parseProduct(row));
});

// DELETE /api/products/:id - remover (protegido)
router.delete("/:id", requireAuth, async (req, res) => {
  const existing = await get("SELECT id FROM products WHERE id = ?", [req.params.id]);
  if (!existing) return res.status(404).json({ error: "Produto n�o encontrado." });

  await run("DELETE FROM products WHERE id = ?", [req.params.id]);
  res.json({ ok: true });
});

export default router;
