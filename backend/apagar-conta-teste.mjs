// Script de uso único: apaga uma conta de cliente (customer) pelo e-mail.
// Útil pra remover a conta que você criou só pra testar o cadastro/login.
//
// O que é apagado junto (por causa do ON DELETE CASCADE/SET NULL no banco):
//   - password_resets dessa conta (apagados)
//   - orders dessa conta continuam existindo, mas ficam sem dono (customer_id = NULL)
//
// Como rodar (dentro da pasta backend):
//   node scripts/apagar-conta-teste.mjs email@teste.com
import { initDb, run, get } from "../db.js";

async function main() {
  const email = process.argv[2];

  if (!email) {
    console.error("Uso: node scripts/apagar-conta-teste.mjs email@teste.com");
    process.exit(1);
  }

  await initDb();

  const customer = await get("SELECT id, name, email FROM customers WHERE email = ?", [email]);

  if (!customer) {
    console.log(`Nenhuma conta encontrada com o e-mail "${email}".`);
    process.exit(0);
  }

  await run("DELETE FROM customers WHERE id = ?", [customer.id]);

  console.log(`Conta apagada: ${customer.name} <${customer.email}> (id ${customer.id})`);

  // Dá tempo do SQLite terminar de salvar em disco antes do processo sair.
  await new Promise((resolve) => setTimeout(resolve, 500));
  process.exit(0);
}

main().catch((err) => {
  console.error("Erro ao apagar conta de teste:", err);
  process.exit(1);
});
