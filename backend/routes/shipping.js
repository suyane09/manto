import { Router } from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const router = Router();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UF_TABLE_PATH = path.join(__dirname, "..", "data", "frete-uf.json");
const AL_TABLE_PATH = path.join(__dirname, "..", "data", "frete-municipios-al.json");

function loadJson(filePath) {
  const raw = fs.readFileSync(filePath, "utf-8");
  return JSON.parse(raw);
}

function normalize(str) {
  return String(str || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

const EXTRA_PER_ITEM = 3.5;
const MAX_EXTRA_ITEMS_CHARGED = 6;

function cleanCep(cep) {
  return String(cep || "").replace(/\D/g, "");
}

router.post("/calculate", async (req, res) => {
  const cep = cleanCep(req.body?.cep);
  const itemCount = Math.max(1, Number(req.body?.itemCount) || 1);

  if (cep.length !== 8) {
    return res.status(400).json({ error: "CEP inv�lido. Digite os 8 n�meros do CEP." });
  }

  let address;
  try {
    const viaCepRes = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
    address = await viaCepRes.json();
  } catch (err) {
    return res.status(502).json({ error: "N�o foi poss�vel consultar o CEP agora. Tente novamente." });
  }

  if (!address || address.erro) {
    return res.status(404).json({ error: "CEP n�o encontrado." });
  }

  const uf = address.uf;

  let ufTable, alTable;
  try {
    ufTable = loadJson(UF_TABLE_PATH);
    alTable = uf === "AL" ? loadJson(AL_TABLE_PATH) : null;
  } catch (err) {
    return res.status(500).json({ error: "N�o foi poss�vel carregar a tabela de frete." });
  }

  const tier = ufTable[uf];
  if (!tier) {
    return res.status(400).json({ error: `N�o entregamos automaticamente para o estado "${uf}" ainda.` });
  }

  let baseCost = tier.cost;
  let region = tier.label;
  if (alTable) {
    const targetCity = normalize(address.localidade);
    const match = Object.keys(alTable).find((city) => normalize(city) === targetCity);
    if (match) {
      baseCost = alTable[match];
      region = match;
    }
  }

  const extraItems = Math.min(itemCount - 1, MAX_EXTRA_ITEMS_CHARGED);
  const cost = Math.round((baseCost + extraItems * EXTRA_PER_ITEM) * 100) / 100;

  res.json({
    cep: `${cep.slice(0, 5)}-${cep.slice(5)}`,
    city: address.localidade,
    uf,
    neighborhood: address.bairro,
    street: address.logradouro,
    region,
    cost,
    daysMin: tier.daysMin,
    daysMax: tier.daysMax,
  });
});

export default router;
