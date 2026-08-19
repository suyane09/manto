import { Router } from "express";
import { all, get } from "../db.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

router.get("/stats", requireAuth, async (req, res) => {
  const totalProducts = (await get("SELECT COUNT(*) as c FROM products"))?.c || 0;
  const lowStock = (await get("SELECT COUNT(*) as c FROM products WHERE stock <= 3"))?.c || 0;

  const totalRevenue =
    (await get("SELECT COALESCE(SUM(total),0) as v FROM orders WHERE payment_status = 'aprovado'"))?.v || 0;
  const totalOrders = (await get("SELECT COUNT(*) as c FROM orders"))?.c || 0;

  const salesToday = await get(
    `SELECT COUNT(*) as c, COALESCE(SUM(total),0) as v FROM orders
     WHERE date(created_at) = date('now') AND payment_status = 'aprovado'`
  );

  const recentOrders = await all("SELECT * FROM orders ORDER BY created_at DESC LIMIT 5");

  const topProducts = await all(`
    SELECT oi.product_name as name, SUM(oi.qty) as totalQty, SUM(oi.subtotal) as totalRevenue
    FROM order_items oi
    JOIN orders o ON o.id = oi.order_id
    WHERE o.payment_status = 'aprovado'
    GROUP BY oi.product_name
    ORDER BY totalQty DESC
    LIMIT 5
  `);

  res.json({
    totalProducts,
    lowStock,
    totalRevenue,
    totalOrders,
    ordersToday: salesToday?.c || 0,
    revenueToday: salesToday?.v || 0,
    recentOrders,
    topProducts,
  });
});

export default router;