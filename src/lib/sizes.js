// Grupos de tamanho padrão, na mesma lógica usada pra fechar pedido no
// WhatsApp: Torcedor, Jogador e Infantil, cada um com seus próprios
// tamanhos. Um produto pode ter só um dos grupos preenchido, dois, ou
// os três — os vazios simplesmente não aparecem pro cliente.
export const SIZE_GROUPS = [
  { key: "torcedor", label: "Torcedor" },
  { key: "jogador", label: "Jogador" },
  { key: "infantil", label: "Infantil" },
];

// Recebe o campo `sizes` do produto (como vem da API) e devolve uma lista
// só com os grupos que têm tamanho cadastrado, pronta pra renderizar.
// Também aceita o formato antigo (array simples de tamanhos), pra não
// quebrar produtos cadastrados antes dessa mudança.
export function normalizeSizes(sizes) {
  if (!sizes) return [];

  if (Array.isArray(sizes)) {
    return sizes.length ? [{ key: "padrao", label: "Tamanho", sizes }] : [];
  }

  return SIZE_GROUPS.map((g) => ({ ...g, sizes: sizes[g.key] || [] })).filter(
    (g) => g.sizes.length > 0
  );
}

// Converte o campo `sizes` do produto pra strings separadas por vírgula,
// uma por grupo — usado pra popular o formulário de edição. As chaves batem
// com os campos do formulário (sizesTorcedor, sizesJogador, sizesInfantil).
export function sizesToFormStrings(sizes) {
  const base = { sizesTorcedor: "", sizesJogador: "", sizesInfantil: "" };
  if (!sizes) return base;

  if (Array.isArray(sizes)) {
    return { ...base, sizesTorcedor: sizes.join(",") };
  }

  return {
    sizesTorcedor: (sizes.torcedor || []).join(","),
    sizesJogador: (sizes.jogador || []).join(","),
    sizesInfantil: (sizes.infantil || []).join(","),
  };
}

// Converte as três strings do formulário de volta pro objeto que vai pra API.
export function formStringsToSizes({ sizesTorcedor, sizesJogador, sizesInfantil }) {
  const toArr = (s) =>
    (s || "")
      .split(",")
      .map((x) => x.trim())
      .filter(Boolean);

  return {
    torcedor: toArr(sizesTorcedor),
    jogador: toArr(sizesJogador),
    infantil: toArr(sizesInfantil),
  };
}