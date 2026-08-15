// Converte as imagens de public/produtos para .webp (menores e mais rápidas
// de carregar), sem apagar os arquivos originais.
//
// Uso:
//   npm install --save-dev sharp
//   node scripts/optimize-images.mjs
//
// O script cria um .webp ao lado de cada imagem original (ex: foto.jpg ->
// foto.webp). Ele NÃO apaga os arquivos antigos nem edita o banco de dados -
// depois de rodar, você decide (produto por produto, no painel /produtos)
// se quer trocar as imagens cadastradas pelas versões .webp.
//
// Rodar de novo é seguro: imagens que já têm um .webp mais novo que o
// original são puladas.

import { readdir, stat } from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TARGET_DIR = path.join(__dirname, "..", "public", "produtos");
const EXTENSIONS = new Set([".jpg", ".jpeg", ".png"]);
const QUALITY = 80;

async function loadSharp() {
  try {
    const mod = await import("sharp");
    return mod.default;
  } catch {
    console.error(
      "O pacote 'sharp' não está instalado. Rode `npm install --save-dev sharp` e tente de novo."
    );
    process.exit(1);
  }
}

async function walk(dir, files = []) {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      await walk(full, files);
    } else if (EXTENSIONS.has(path.extname(entry.name).toLowerCase())) {
      files.push(full);
    }
  }
  return files;
}

async function main() {
  const sharp = await loadSharp();
  const files = await walk(TARGET_DIR);

  console.log(`Encontradas ${files.length} imagens em public/produtos.`);

  let converted = 0;
  let skipped = 0;
  let totalBefore = 0;
  let totalAfter = 0;

  for (const file of files) {
    const webpPath = file.replace(/\.[^.]+$/, ".webp");

    try {
      const originalStat = await stat(file);
      try {
        const webpStat = await stat(webpPath);
        if (webpStat.mtimeMs >= originalStat.mtimeMs) {
          skipped++;
          continue;
        }
      } catch {
        // .webp ainda não existe, segue pra converter
      }

      await sharp(file).webp({ quality: QUALITY }).toFile(webpPath);

      const webpStat = await stat(webpPath);
      totalBefore += originalStat.size;
      totalAfter += webpStat.size;
      converted++;
    } catch (err) {
      console.warn(`Falha ao converter ${file}:`, err.message);
    }
  }

  console.log(`\nConcluído: ${converted} convertidas, ${skipped} já estavam atualizadas.`);
  if (totalBefore > 0) {
    const reduction = (100 * (1 - totalAfter / totalBefore)).toFixed(1);
    console.log(
      `Tamanho: ${(totalBefore / 1024 / 1024).toFixed(1)}MB -> ${(totalAfter / 1024 / 1024).toFixed(1)}MB (-${reduction}%)`
    );
  }
  console.log(
    "\nOs arquivos originais não foram apagados. Pra usar as versões .webp, atualize as imagens do produto no painel (/produtos)."
  );
}

main();
