import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Lock, User, Loader2 } from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import { STORE_NAME, LOGO_URL } from "@/lib/config";

function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(username, password);
      navigate("/dashboard");
    } catch (err) {
      setError(err?.response?.data?.error || "Não foi possível entrar. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <img
            src={LOGO_URL}
            alt={STORE_NAME}
            className="mb-4 h-16 w-16 rounded-full object-cover ring-2 ring-neon"
          />
          <h1 className="font-heading text-xl uppercase tracking-wider text-white">
            {STORE_NAME}
          </h1>
          <p className="text-[10px] uppercase tracking-[0.3em] text-neon">Painel administrativo</p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="space-y-4 rounded-2xl border border-border bg-card p-8 shadow-xl"
        >
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Usuário
            </label>
            <div className="flex items-center gap-2 rounded-lg border border-border bg-background px-3 focus-within:border-neon">
              <User className="h-4 w-4 text-muted-foreground" />
              <input
                className="w-full bg-transparent py-2.5 text-sm text-white outline-none"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
                required
              />
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Senha
            </label>
            <div className="flex items-center gap-2 rounded-lg border border-border bg-background px-3 focus-within:border-neon">
              <Lock className="h-4 w-4 text-muted-foreground" />
              <input
                type="password"
                className="w-full bg-transparent py-2.5 text-sm text-white outline-none"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
              />
            </div>
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
            {loading ? "Entrando..." : "Entrar"}
          </button>
        </form>
      </div>
    </div>
  );
}

export default Login;
