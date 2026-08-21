import { useEffect, useRef, useState } from "react";
import { Plus, Pencil, Trash2, X, Search, Loader2, ImagePlus, ImageOff, TriangleAlert } from "lucide-react";
import api from "@/lib/api";
import { formatBRL } from "@/lib/config";
import { sizesToFormStrings, formStringsToSizes } from "@/lib/sizes";

const emptyForm = {
  id: "",
  name: "",
  category: "manto",
  type: "pronta",
  price: "",
  sizesTorcedor: "P,M,G,GG",
  sizesJogador: "",
  sizesInfantil: "",
  stock: 10,
  images: [],
};

function slugify(text) {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function Produtos() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const fileInputRef = useRef(null);

  function loadProducts() {
    setLoading(true);
    api
      .get("/products")
      .then(({ data }) => setProducts(data))
      .catch(() => setError("Não foi possível carregar os produtos."))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    loadProducts();
  }, []);

  function openNew() {
    setForm(emptyForm);
    setEditingId(null);
    setShowForm(true);
  }

  function openEdit(p) {
    setForm({
      id: p.id,
      name: p.name,
      category: p.category || "",
      type: p.type || "",
      price: p.price,
      ...sizesToFormStrings(p.sizes),
      stock: p.stock,
      images: p.images || [],
    });
    setEditingId(p.id);
    setShowForm(true);
  }

  async function handleImageUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setError("");
    const formData = new FormData();
    formData.append("image", file);

    try {
      const { data } = await api.post("/uploads", formData);
      setForm((f) => ({ ...f, images: [...f.images, data.url] }));
    } catch (err) {
      setError(err?.response?.data?.error || "Erro ao enviar imagem.");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  function removeImage(index) {
    setForm((f) => ({ ...f, images: f.images.filter((_, i) => i !== index) }));
  }

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    setError("");

    const payload = {
      name: form.name,
      category: form.category,
      type: form.type,
      price: Number(form.price),
      sizes: formStringsToSizes(form),
      stock: Number(form.stock),
      images: form.images,
    };

    try {
      if (editingId) {
        await api.put(`/products/${editingId}`, payload);
      } else {
        const id = form.id ? slugify(form.id) : slugify(form.name) + "-" + Date.now().toString().slice(-4);
        await api.post("/products", { id, ...payload });
      }
      setShowForm(false);
      loadProducts();
    } catch (err) {
      setError(err?.response?.data?.error || "Erro ao salvar produto.");
    } finally {
      setSaving(false);
    }
  }

  function handleDelete(product) {
    setDeleteTarget(product);
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.delete(`/products/${deleteTarget.id}`);
      loadProducts();
      setDeleteTarget(null);
    } catch {
      setError("Erro ao remover produto.");
      setDeleteTarget(null);
    } finally {
      setDeleting(false);
    }
  }

  const filtered = products.filter(
    (p) =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.category?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div className="relative w-full max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            placeholder="Buscar por nome ou categoria..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-border bg-card py-2.5 pl-9 pr-3 text-sm text-white placeholder:text-muted-foreground focus:border-neon focus:outline-none"
          />
        </div>

        <button
          onClick={openNew}
          className="flex items-center gap-2 rounded-lg bg-neon px-4 py-2.5 text-xs font-bold uppercase tracking-wide text-black transition-transform hover:scale-[1.02] active:scale-95"
        >
          <Plus className="h-4 w-4" />
          Novo produto
        </button>
      </div>

      {error && (
        <p className="mb-4 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}

      {loading ? (
        <div className="flex h-64 items-center justify-center text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border bg-card">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-white/[0.02] text-xs uppercase tracking-wide text-muted-foreground">
                <th className="px-5 py-3.5 text-left font-semibold">Produto</th>
                <th className="px-5 py-3.5 text-left font-semibold">Categoria</th>
                <th className="px-5 py-3.5 text-left font-semibold">Tipo</th>
                <th className="px-5 py-3.5 text-left font-semibold">Preço</th>
                <th className="px-5 py-3.5 text-left font-semibold">Estoque</th>
                <th className="px-5 py-3.5"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => (
                <tr key={p.id} className="border-b border-border/60 last:border-0 hover:bg-white/[0.02]">
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-3">
                      {p.images?.[0] ? (
                        <img
                          src={p.images[0]}
                          alt={p.name}
                          className="h-10 w-10 rounded-lg border border-border object-cover"
                        />
                      ) : (
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-dashed border-border text-muted-foreground">
                          <ImageOff className="h-4 w-4" />
                        </div>
                      )}
                      <span className="font-medium text-white">{p.name}</span>
                    </div>
                  </td>
                  <td className="px-5 py-3.5 capitalize text-muted-foreground">{p.category}</td>
                  <td className="px-5 py-3.5 capitalize text-muted-foreground">{p.type}</td>
                  <td className="px-5 py-3.5 text-white">{formatBRL(p.price)}</td>
                  <td className="px-5 py-3.5">
                    <span
                      className={`font-semibold ${
                        p.stock <= 3 ? "text-destructive" : "text-white"
                      }`}
                    >
                      {p.stock}
                    </span>
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => openEdit(p)}
                        className="rounded-lg border border-border p-2 text-muted-foreground transition-colors hover:border-neon hover:text-neon"
                        aria-label="Editar"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => handleDelete(p)}
                        className="rounded-lg border border-border p-2 text-muted-foreground transition-colors hover:border-destructive hover:text-destructive"
                        aria-label="Excluir"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-5 py-10 text-center text-muted-foreground">
                    Nenhum produto encontrado.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {showForm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
          onClick={() => setShowForm(false)}
        >
          <form
            onClick={(e) => e.stopPropagation()}
            onSubmit={handleSave}
            className="flex max-h-[90vh] w-full max-w-md flex-col overflow-y-auto rounded-2xl border border-border bg-card p-7"
          >
            <div className="mb-5 flex items-center justify-between">
              <h2 className="font-heading text-base uppercase tracking-wide text-white">
                {editingId ? "Editar produto" : "Novo produto"}
              </h2>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="text-muted-foreground hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4">
              <Field label="Imagens">
                <div className="flex flex-wrap gap-2">
                  {form.images.map((url, i) => (
                    <div key={i} className="group relative h-16 w-16">
                      <img
                        src={url}
                        alt=""
                        className="h-16 w-16 rounded-lg border border-border object-cover"
                      />
                      <button
                        type="button"
                        onClick={() => removeImage(i)}
                        className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-white opacity-0 transition-opacity group-hover:opacity-100"
                        aria-label="Remover imagem"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}

                  <label className="flex h-16 w-16 cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-border text-muted-foreground transition-colors hover:border-neon hover:text-neon">
                    {uploading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <>
                        <ImagePlus className="h-4 w-4" />
                        <span className="text-[9px] uppercase">Add</span>
                      </>
                    )}
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/png,image/jpeg,image/webp,image/gif"
                      className="hidden"
                      onChange={handleImageUpload}
                      disabled={uploading}
                    />
                  </label>
                </div>
                <p className="mt-1.5 text-[11px] text-muted-foreground">
                  A primeira imagem é usada como capa do produto.
                </p>
              </Field>

              {!editingId && (
                <Field label="ID (opcional, gerado automaticamente se vazio)">
                  <input className="input" value={form.id} onChange={(e) => setForm({ ...form, id: e.target.value })} />
                </Field>
              )}

              <Field label="Nome">
                <input
                  className="input"
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </Field>

              <Field label="Categoria">
                <input
                  className="input"
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                  placeholder="manto, chuteira..."
                />
              </Field>

              <Field label="Tipo">
                <select
                  className="input"
                  value={form.type}
                  onChange={(e) => setForm({ ...form, type: e.target.value })}
                >
                  <option value="pronta">Pronta entrega</option>
                  <option value="encomenda">Encomenda</option>
                </select>
              </Field>

              <Field label="Preço (R$)">
                <input
                  className="input"
                  required
                  type="number"
                  step="0.01"
                  value={form.price}
                  onChange={(e) => setForm({ ...form, price: e.target.value })}
                />
              </Field>

              <div>
                <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Tamanhos por linha
                </p>
                <p className="mb-3 text-[11px] text-muted-foreground">
                  Preencha só as linhas que esse produto tem. As vazias não aparecem pro cliente.
                </p>
                <div className="space-y-3">
                  <Field label="Torcedor (separados por vírgula)">
                    <input
                      className="input"
                      placeholder="P,M,G,GG"
                      value={form.sizesTorcedor}
                      onChange={(e) => setForm({ ...form, sizesTorcedor: e.target.value })}
                    />
                  </Field>
                  <Field label="Jogador (separados por vírgula)">
                    <input
                      className="input"
                      placeholder="P,M,G,GG"
                      value={form.sizesJogador}
                      onChange={(e) => setForm({ ...form, sizesJogador: e.target.value })}
                    />
                  </Field>
                  <Field label="Infantil (separados por vírgula)">
                    <input
                      className="input"
                      placeholder="2,4,6,8,10,12,14,16"
                      value={form.sizesInfantil}
                      onChange={(e) => setForm({ ...form, sizesInfantil: e.target.value })}
                    />
                  </Field>
                </div>
              </div>

              <Field label="Estoque">
                <input
                  className="input"
                  required
                  type="number"
                  value={form.stock}
                  onChange={(e) => setForm({ ...form, stock: e.target.value })}
                />
              </Field>
            </div>

            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="flex-1 rounded-lg border border-border py-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground hover:text-white"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={saving || uploading}
                className="flex-1 rounded-lg bg-neon py-2.5 text-xs font-bold uppercase tracking-wide text-black disabled:opacity-60"
              >
                {saving ? "Salvando..." : "Salvar"}
              </button>
            </div>
          </form>
        </div>
      )}

      {deleteTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
          onClick={() => !deleting && setDeleteTarget(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm rounded-2xl border border-destructive/30 bg-card p-7"
          >
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-destructive/10 text-destructive">
                <TriangleAlert className="h-5 w-5" />
              </div>
              <h2 className="font-heading text-base uppercase tracking-wide text-white">
                Remover produto
              </h2>
            </div>

            <p className="mb-6 text-sm text-muted-foreground">
              Tem certeza que deseja remover{" "}
              <span className="font-semibold text-white">{deleteTarget.name}</span>? Essa ação não pode ser desfeita.
            </p>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                disabled={deleting}
                className="flex-1 rounded-lg border border-border py-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground hover:text-white disabled:opacity-60"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={confirmDelete}
                disabled={deleting}
                className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-destructive py-2.5 text-xs font-bold uppercase tracking-wide text-white disabled:opacity-60"
              >
                {deleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                {deleting ? "Removendo..." : "Remover"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </label>
      {children}
    </div>
  );
}

export default Produtos;