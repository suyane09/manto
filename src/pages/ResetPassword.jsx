import { useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { Loader2, Lock, Eye, EyeOff } from "lucide-react";
import customerApi from "@/lib/customerApi";

function PasswordInput({ className = "", ...props }) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="relative">
      <input
        {...props}
        type={visible ? "text" : "password"}
        className={`${className} pr-10`}
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        tabIndex={-1}
        aria-label={visible ? "Ocultar senha" : "Mostrar senha"}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-white"
      >
        {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  );
}

function ResetPassword() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") || "";

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    if (!token) {
      setError("Link inválido. Peça um novo link de redefinição.");
      return;
    }
    if (password.length < 6) {
      setError("A senha precisa ter pelo menos 6 caracteres.");
      return;
    }
    if (password !== confirm) {
      setError("As senhas não coincidem.");
      return;
    }

    setLoading(true);
    try {
      await customerApi.post("/customer-auth/reset-password", { token, newPassword: password });
      setSuccess(true);
    } catch (err) {
      setError(err?.response?.data?.error || "Não foi possível redefinir sua senha. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-6">
        <h1 className="mb-1 font-heading text-xl uppercase tracking-wide text-white">Redefinir senha</h1>
        <p className="mb-6 text-xs text-muted-foreground">Crie uma nova senha para sua conta.</p>

        {success ? (
          <div className="space-y-4 text-center">
            <p className="text-sm text-white">Senha redefinida com sucesso!</p>
            <Link to="/" className="font-semibold text-neon hover:underline">
              Voltar para a loja
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <Lock className="h-3.5 w-3.5" /> Nova senha
              </label>
              <PasswordInput
                className="input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
                required
              />
            </div>
            <div>
              <label className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <Lock className="h-3.5 w-3.5" /> Confirmar nova senha
              </label>
              <PasswordInput
                className="input"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                autoComplete="new-password"
                required
              />
            </div>

            {error && (
              <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-neon py-3 text-sm font-bold uppercase tracking-wide text-black transition-transform hover:scale-[1.01] active:scale-95 disabled:opacity-60"
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              {loading ? "Salvando..." : "Salvar nova senha"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

export default ResetPassword;
