// Script de uso único: apaga TODAS as vendas/pedidos cadastrados até agora
// (inclusive os de teste) e devolve o estoque que tinha sido descontado por
// eles. Produtos, categorias e o login do admin não são afetados.
//
// Como rodar (dentro da pasta backend):
//   node scripts/limpar-vendas-teste.mjs
//
// Rode isso só UMA VEZ, pouco antes de colocar a loja no ar de verdade.
import { initDb, run, all, get, dbMode } from "../db.js";

async function main() {
  await initDb();

  const totalOrders = (await get("SELECT COUNT(*) as c FROM orders"))?.c || 0;

  if (totalOrders === 0) {
    console.log("Nenhum pedido encontrado. Nada para limpar.");
    process.exit(0);
  }

  // Devolve ao estoque a quantidade que cada item vendido tinha descontado
  // (produtos do tipo "encomenda" nunca descontam estoque, então são ignorados).
  const items = await all("SELECT product_id, qty FROM order_items");
  const products = await all("SELECT id, type FROM products");
  const productType = new Map(products.map((p) => [p.id, p.type]));

  const restore = new Map();
  for (const it of items) {
    if (!it.product_id) continue;
    if (productType.get(it.product_id) === "encomenda") continue;
    restore.set(it.product_id, (restore.get(it.product_id) || 0) + (Number(it.qty) || 0));
  }

  for (const [productId, qty] of restore) {
    await run("UPDATE products SET stock = stock + ? WHERE id = ?", [qty, productId]);
  }

  await run("DELETE FROM order_items");
  await run("DELETE FROM orders");

  // Reinicia a numeração dos pedidos, pra próxima venda real começar do #1.
  if (dbMode === "sqlite") {
    await run("DELETE FROM sqlite_sequence WHERE name IN ('orders','order_items')");
  } else {
    await run("ALTER SEQUENCE orders_id_seq RESTART WITH 1");
    await run("ALTER SEQUENCE order_items_id_seq RESTART WITH 1");
  }

  console.log(`Pronto! ${totalOrders} pedido(s) apagado(s), estoque devolvido e numeração zerada.`);

  // Dá tempo do SQLite terminar de salvar em disco antes do processo sair.
  await new Promise((resolve) => setTimeout(resolve, 500));
  process.exit(0);
}

main().catch((err) => {
  console.error("Erro ao limpar pedidos de teste:", err);
  process.exit(1);
});
