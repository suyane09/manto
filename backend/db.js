import fs from "fs";
import path from "path";
import { fileURLToPath, pathToFileURL } from "url";
import bcrypt from "bcryptjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// --------------------------------------------------------------------------
// Modo do banco: SQLite (padr�o, via sql.js - bom pra come�ar/baixo volume)
// ou Postgres (recomendado quando a loja crescer - configure DATABASE_URL).
//
// Todas as rotas do backend s� falam com este arquivo atrav�s de
// run/all/get/insertAndGetId, ent�o trocar de banco n�o exige mexer em
// nenhuma rota.
// --------------------------------------------------------------------------
const DATABASE_URL = process.env.DATABASE_URL;
const MODE = DATABASE_URL ? "postgres" : "sqlite";

const DB_PATH = process.env.SQLITE_PATH || path.join(__dirname, "data", "arsenal.sqlite");

let sqliteDb = null; // inst�ncia sql.js (modo sqlite)
let pgPool = null; // Pool do 'pg' (modo postgres)
let saveTimeout = null;

const SQLITE_SCHEMA = `
CREATE TABLE IF NOT EXISTS admins (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  failed_attempts INTEGER DEFAULT 0,
  locked_until TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT,
  type TEXT,
  price REAL NOT NULL DEFAULT 0,
  sizes TEXT DEFAULT '[]',
  unavailable TEXT DEFAULT '[]',
  images TEXT DEFAULT '[]',
  stock INTEGER DEFAULT 10,
  active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS customers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  phone TEXT,
  password_hash TEXT NOT NULL,
  cep TEXT,
  street TEXT,
  number TEXT,
  complement TEXT,
  neighborhood TEXT,
  city TEXT,
  uf TEXT,
  failed_attempts INTEGER DEFAULT 0,
  locked_until TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS password_resets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  used INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_id INTEGER REFERENCES customers(id) ON DELETE SET NULL,
  customer_name TEXT,
  customer_phone TEXT,
  customer_email TEXT,
  cep TEXT,
  street TEXT,
  number TEXT,
  complement TEXT,
  neighborhood TEXT,
  city TEXT,
  uf TEXT,
  shipping_cost REAL NOT NULL DEFAULT 0,
  shipping_days_min INTEGER,
  shipping_days_max INTEGER,
  subtotal REAL NOT NULL DEFAULT 0,
  total REAL NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'aguardando_pagamento',
  payment_status TEXT NOT NULL DEFAULT 'pending',
  payment_method TEXT,
  mp_preference_id TEXT,
  mp_payment_id TEXT,
  notes TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS order_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id TEXT,
  product_name TEXT NOT NULL,
  size TEXT,
  custom_name TEXT,
  custom_number TEXT,
  qty INTEGER NOT NULL DEFAULT 1,
  unit_price REAL NOT NULL DEFAULT 0,
  subtotal REAL NOT NULL DEFAULT 0
);
`;

// Mesmo modelo de dados, sintaxe adaptada pro Postgres (SERIAL em vez de
// AUTOINCREMENT, TIMESTAMPTZ em vez de TEXT+datetime()). 'active' e 'used'
// continuam INTEGER (0/1) de prop�sito, pra n�o precisar mexer nas rotas
// que j� leem/escrevem esses campos como 0/1.
const POSTGRES_SCHEMA = `
CREATE TABLE IF NOT EXISTS admins (
  id SERIAL PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  failed_attempts INTEGER DEFAULT 0,
  locked_until TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT,
  type TEXT,
  price REAL NOT NULL DEFAULT 0,
  sizes TEXT DEFAULT '[]',
  unavailable TEXT DEFAULT '[]',
  images TEXT DEFAULT '[]',
  stock INTEGER DEFAULT 10,
  active INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS customers (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  phone TEXT,
  password_hash TEXT NOT NULL,
  cep TEXT,
  street TEXT,
  number TEXT,
  complement TEXT,
  neighborhood TEXT,
  city TEXT,
  uf TEXT,
  failed_attempts INTEGER DEFAULT 0,
  locked_until TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS password_resets (
  id SERIAL PRIMARY KEY,
  customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  used INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS orders (
  id SERIAL PRIMARY KEY,
  customer_id INTEGER REFERENCES customers(id) ON DELETE SET NULL,
  customer_name TEXT,
  customer_phone TEXT,
  customer_email TEXT,
  cep TEXT,
  street TEXT,
  number TEXT,
  complement TEXT,
  neighborhood TEXT,
  city TEXT,
  uf TEXT,
  shipping_cost REAL NOT NULL DEFAULT 0,
  shipping_days_min INTEGER,
  shipping_days_max INTEGER,
  subtotal REAL NOT NULL DEFAULT 0,
  total REAL NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'aguardando_pagamento',
  payment_status TEXT NOT NULL DEFAULT 'pending',
  payment_method TEXT,
  mp_preference_id TEXT,
  mp_payment_id TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS order_items (
  id SERIAL PRIMARY KEY,
  order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id TEXT,
  product_name TEXT NOT NULL,
  size TEXT,
  custom_name TEXT,
  custom_number TEXT,
  qty INTEGER NOT NULL DEFAULT 1,
  unit_price REAL NOT NULL DEFAULT 0,
  subtotal REAL NOT NULL DEFAULT 0
);
`;

// As �nicas fun��es de data espec�ficas do SQLite usadas no projeto.
// Em modo Postgres, a query passa por aqui antes de rodar e essas express�es
// s�o trocadas pelo equivalente em Postgres - assim nenhuma rota precisa
// saber em qual banco est� rodando.
function translateSqlForPostgres(sql) {
  return sql
    .replace(/datetime\('now'\)/gi, "NOW()")
    .replace(/date\(created_at\)\s*=\s*date\('now'\)/gi, "created_at::date = CURRENT_DATE");
}

function toPgPlaceholders(sql) {
  let i = 0;
  return sql.replace(/\?/g, () => `$${++i}`);
}

function persistSqlite() {
  if (saveTimeout) clearTimeout(saveTimeout);
  saveTimeout = setTimeout(() => {
    const data = sqliteDb.export();
    fs.writeFileSync(DB_PATH, Buffer.from(data));
  }, 150);
}

async function initSqlite() {
  const { default: initSqlJs } = await import("sql.js");
  const SQL = await initSqlJs({});
  fs.mkdirSync(path.join(__dirname, "data"), { recursive: true });

  if (fs.existsSync(DB_PATH)) {
    sqliteDb = new SQL.Database(fs.readFileSync(DB_PATH));
  } else {
    sqliteDb = new SQL.Database();
  }

  sqliteDb.run(SQLITE_SCHEMA);
  migrateOrdersTableSqlite();
  migrateAdminsTableSqlite();

  await seedAdmin();
  await seedProducts();

  persistSqlite();
}

async function initPostgres() {
  let pg;
  try {
    pg = await import("pg");
  } catch {
    console.error(
      "DATABASE_URL configurado mas o pacote 'pg' n�o est� instalado. Rode `npm install pg` no backend."
    );
    process.exit(1);
  }
  const { Pool } = pg.default ?? pg;

  pgPool = new Pool({
    connectionString: DATABASE_URL,
    ssl: process.env.DATABASE_SSL === "false" ? false : { rejectUnauthorized: false },
  });

  // roda o schema inteiro numa transa��o simples
  const client = await pgPool.connect();
  try {
    await client.query(POSTGRES_SCHEMA);
  } finally {
    client.release();
  }

  await migrateOrdersTablePostgres();
  await migrateAdminsTablePostgres();

  await seedAdmin();
  await seedProducts();
}

export async function initDb() {
  if (MODE === "postgres") {
    await initPostgres();
    console.log("Banco de dados: Postgres (via DATABASE_URL).");
  } else {
    await initSqlite();
    console.log(`Banco de dados: SQLite em ${DB_PATH} (defina DATABASE_URL pra usar Postgres).`);
  }
  return getDb();
}

// --- migra��es de colunas novas (idempotentes, seguras rodar sempre) ------

const NEW_ORDER_COLUMNS = [
  ["customer_email", "TEXT"],
  ["cep", "TEXT"],
  ["street", "TEXT"],
  ["number", "TEXT"],
  ["complement", "TEXT"],
  ["neighborhood", "TEXT"],
  ["city", "TEXT"],
  ["uf", "TEXT"],
  ["shipping_cost", "REAL NOT NULL DEFAULT 0"],
  ["shipping_days_min", "INTEGER"],
  ["shipping_days_max", "INTEGER"],
  ["subtotal", "REAL NOT NULL DEFAULT 0"],
  ["payment_status", "TEXT NOT NULL DEFAULT 'pending'"],
  ["payment_method", "TEXT"],
  ["mp_preference_id", "TEXT"],
  ["mp_payment_id", "TEXT"],
  ["customer_id", "INTEGER REFERENCES customers(id) ON DELETE SET NULL"],
];

const NEW_ADMIN_COLUMNS = [
  ["failed_attempts", "INTEGER DEFAULT 0"],
  ["locked_until", "TEXT"],
];

function migrateOrdersTableSqlite() {
  const existingCols = sqliteDb.exec("PRAGMA table_info(orders)");
  const colNames = existingCols[0]?.values?.map((row) => row[1]) || [];
  for (const [name, type] of NEW_ORDER_COLUMNS) {
    if (!colNames.includes(name)) {
      sqliteDb.run(`ALTER TABLE orders ADD COLUMN ${name} ${type}`);
      console.log(`Migra��o: coluna "${name}" adicionada em orders`);
    }
  }
}

function migrateAdminsTableSqlite() {
  const existingCols = sqliteDb.exec("PRAGMA table_info(admins)");
  const colNames = existingCols[0]?.values?.map((row) => row[1]) || [];
  for (const [name, type] of NEW_ADMIN_COLUMNS) {
    if (!colNames.includes(name)) {
      sqliteDb.run(`ALTER TABLE admins ADD COLUMN ${name} ${type}`);
      console.log(`Migra��o: coluna "${name}" adicionada em admins`);
    }
  }
}

async function pgColumnNames(table) {
  const res = await pgPool.query("SELECT column_name FROM information_schema.columns WHERE table_name = $1", [
    table,
  ]);
  return res.rows.map((r) => r.column_name);
}

async function migrateOrdersTablePostgres() {
  const colNames = await pgColumnNames("orders");
  for (const [name, type] of NEW_ORDER_COLUMNS) {
    if (!colNames.includes(name)) {
      await pgPool.query(`ALTER TABLE orders ADD COLUMN ${name} ${type}`);
      console.log(`Migra��o: coluna "${name}" adicionada em orders`);
    }
  }
}

async function migrateAdminsTablePostgres() {
  const colNames = await pgColumnNames("admins");
  for (const [name, type] of NEW_ADMIN_COLUMNS) {
    if (!colNames.includes(name)) {
      await pgPool.query(`ALTER TABLE admins ADD COLUMN ${name} ${type}`);
      console.log(`Migra��o: coluna "${name}" adicionada em admins`);
    }
  }
}

// --- seed ------------------------------------------------------------------

async function seedAdmin() {
  const res = await get("SELECT COUNT(*) as c FROM admins");
  const count = res?.c ?? 0;
  if (count > 0) return;

  const username = process.env.ADMIN_USERNAME || "Arsenal";
  const password = process.env.ADMIN_PASSWORD || "Sportclubarsenal";
  const hash = bcrypt.hashSync(password, 10);
  await run("INSERT INTO admins (username, password_hash) VALUES (?, ?)", [username, hash]);
  console.log(`Admin padr�o criado -> usu�rio: "${username}" (senha definida no .env)`);
}

async function seedProducts() {
  const res = await get("SELECT COUNT(*) as c FROM products");
  const count = res?.c ?? 0;
  if (count > 0) return;

  try {
    const productsPath = path.join(__dirname, "..", "src", "lib", "products.js");
    const mod = await import(pathToFileURL(productsPath).href);
    const PRODUCTS = mod.PRODUCTS || [];
    for (const p of PRODUCTS) {
      await run(
        `INSERT INTO products (id, name, category, type, price, sizes, unavailable, images, stock)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          p.id,
          p.name,
          p.category || "",
          p.type || "",
          p.price || 0,
          JSON.stringify(p.sizes || []),
          JSON.stringify(p.unavailable || []),
          JSON.stringify(p.images || []),
          10,
        ]
      );
    }
    console.log(`${PRODUCTS.length} produtos importados de src/lib/products.js`);
  } catch (err) {
    console.warn("N�o foi poss�vel importar src/lib/products.js para seed:", err.message);
  }
}

// --- API p�blica usada pelas rotas -----------------------------------------
// Todas as fun��es abaixo s�o s�ncronas em modo SQLite (sql.js � s�ncrono) e
// retornam Promises em modo Postgres. As rotas do projeto usam `await`/estilo
// s�ncrono livremente porque Express/JS resolve isso bem em ambos os casos
// desde que quem chama sempre trate o retorno como possivelmente ass�ncrono.

export function getDb() {
  return MODE === "postgres" ? pgPool : sqliteDb;
}

export function run(sql, params = []) {
  if (MODE === "postgres") {
    const translated = toPgPlaceholders(translateSqlForPostgres(sql));
    return pgPool.query(translated, params).then(() => {});
  }
  sqliteDb.run(sql, params);
  persistSqlite();
}

export function all(sql, params = []) {
  if (MODE === "postgres") {
    const translated = toPgPlaceholders(translateSqlForPostgres(sql));
    return pgPool.query(translated, params).then((res) => res.rows);
  }
  const stmt = sqliteDb.prepare(sql);
  stmt.bind(params);
  const rows = [];
  while (stmt.step()) {
    rows.push(stmt.getAsObject());
  }
  stmt.free();
  return rows;
}

export function get(sql, params = []) {
  if (MODE === "postgres") {
    return all(sql, params).then((rows) => rows[0] || null);
  }
  const rows = all(sql, params);
  return rows[0] || null;
}

export function insertAndGetId(sql, params = []) {
  if (MODE === "postgres") {
    const translated = toPgPlaceholders(translateSqlForPostgres(sql));
    const withReturning = /returning/i.test(translated) ? translated : `${translated} RETURNING id`;
    return pgPool.query(withReturning, params).then((res) => res.rows[0].id);
  }
  sqliteDb.run(sql, params);
  const res = sqliteDb.exec("SELECT last_insert_rowid() as id");
  persistSqlite();
  return res[0].values[0][0];
}

export const dbMode = MODE;
