import React, { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  X,
  User,
  Lock,
  Mail,
  Phone,
  Loader2,
  LogOut,
  MapPin,
  Pencil,
  ChevronRight,
  Eye,
  EyeOff,
} from "lucide-react";
import { useCustomerAuth } from "@/context/CustomerAuthContext";
import customerApi from "@/lib/customerApi";

export default function AccountDrawer() {
  const { isAuthenticated, isDrawerOpen, closeDrawer } = useCustomerAuth();
  const [mode, setMode] = useState("login"); // login | register | account

  useEffect(() => {
    if (isDrawerOpen) setMode(isAuthenticated ? "account" : "login");
  }, [isDrawerOpen, isAuthenticated]);

  return (
    <AnimatePresence>
      {isDrawerOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={closeDrawer}
            className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm"
          />
          <motion.aside
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "tween", ease: "easeInOut", duration: 0.35 }}
            className="fixed right-0 top-0 z-50 flex h-full w-full max-w-md flex-col border-l border-border bg-card"
          >
            <header className="flex items-center justify-between border-b border-border p-5">
              <div>
                <p className="font-heading text-lg uppercase tracking-wide text-white">
                  {mode === "account" ? "Minha Conta" : "Área do Cliente"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {mode === "account"
                    ? "Seus dados"
                    : mode === "register"
                    ? "Crie sua conta"
                    : "Entre para acompanhar seus pedidos"}
                </p>
              </div>
              <button
                onClick={closeDrawer}
                className="rounded-full p-2 text-white hover:bg-muted"
                aria-label="Fechar"
              >
                <X className="h-5 w-5" />
              </button>
            </header>

            <div className="flex-1 overflow-y-auto p-5">
              {mode === "account" ? (
                <AccountPanel />
              ) : mode === "register" ? (
                <RegisterForm onSwitchToLogin={() => setMode("login")} />
              ) : mode === "forgot" ? (
                <ForgotPasswordForm onSwitchToLogin={() => setMode("login")} />
              ) : (
                <LoginForm
                  onSwitchToRegister={() => setMode("register")}
                  onSwitchToForgot={() => setMode("forgot")}
                />
              )}
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}

function Field({ label, icon: Icon, children }) {
  return (
    <div>
      <label className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {Icon && <Icon className="h-3.5 w-3.5" />}
        {label}
      </label>
      {children}
    </div>
  );
}

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

function ErrorBox({ children }) {
  if (!children) return null;
  return (
    <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
      {children}
    </p>
  );
}

function LoginForm({ onSwitchToRegister, onSwitchToForgot }) {
  const { login } = useCustomerAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(email, password);
    } catch (err) {
      setError(err?.response?.data?.error || "Não foi possível entrar. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Field label="E-mail" icon={Mail}>
        <input
          type="email"
          className="input"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
          required
        />
      </Field>
      <Field label="Senha" icon={Lock}>
        <PasswordInput
          className="input"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
          required
        />
      </Field>

      <ErrorBox>{error}</ErrorBox>

      <button
        type="submit"
        disabled={loading}
        className="flex w-full items-center justify-center gap-2 rounded-lg bg-neon py-3 text-sm font-bold uppercase tracking-wide text-black transition-transform hover:scale-[1.01] active:scale-95 disabled:opacity-60"
      >
        {loading && <Loader2 className="h-4 w-4 animate-spin" />}
        {loading ? "Entrando..." : "Entrar"}
      </button>

      <p className="text-center text-xs">
        <button
          type="button"
          onClick={onSwitchToForgot}
          className="font-semibold text-muted-foreground hover:text-neon hover:underline"
        >
          Esqueci minha senha
        </button>
      </p>

      <p className="text-center text-xs text-muted-foreground">
        Ainda não tem conta?{" "}
        <button
          type="button"
          onClick={onSwitchToRegister}
          className="font-semibold text-neon hover:underline"
        >
          Criar conta
        </button>
      </p>
    </form>
  );
}

function ForgotPasswordForm({ onSwitchToLogin }) {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await customerApi.post("/customer-auth/forgot-password", { email });
      setSent(true);
    } catch (err) {
      setError(err?.response?.data?.error || "Não foi possível enviar o link. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  if (sent) {
    return (
      <div className="space-y-4 text-center">
        <p className="text-sm text-white">
          Se existir uma conta com o e-mail informado, enviamos um link de redefinição de senha. Confira sua
          caixa de entrada (e o spam).
        </p>
        <button
          type="button"
          onClick={onSwitchToLogin}
          className="font-semibold text-neon hover:underline"
        >
          Voltar para o login
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <p className="text-xs text-muted-foreground">
        Informe o e-mail da sua conta. Enviaremos um link para você criar uma nova senha.
      </p>
      <Field label="E-mail" icon={Mail}>
        <input
          type="email"
          className="input"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
          required
        />
      </Field>

      <ErrorBox>{error}</ErrorBox>

      <button
        type="submit"
        disabled={loading}
        className="flex w-full items-center justify-center gap-2 rounded-lg bg-neon py-3 text-sm font-bold uppercase tracking-wide text-black transition-transform hover:scale-[1.01] active:scale-95 disabled:opacity-60"
      >
        {loading && <Loader2 className="h-4 w-4 animate-spin" />}
        {loading ? "Enviando..." : "Enviar link de redefinição"}
      </button>

      <p className="text-center text-xs text-muted-foreground">
        <button
          type="button"
          onClick={onSwitchToLogin}
          className="font-semibold text-neon hover:underline"
        >
          Voltar para o login
        </button>
      </p>
    </form>
  );
}

function RegisterForm({ onSwitchToLogin }) {
  const { register } = useCustomerAuth();
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    password: "",
    confirm: "",
    cep: "",
    street: "",
    number: "",
    complement: "",
    neighborhood: "",
    city: "",
    uf: "",
  });
  const [cepLoading, setCepLoading] = useState(false);
  const [cepFound, setCepFound] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  function set(field) {
    return (e) => setForm((f) => ({ ...f, [field]: e.target.value }));
  }

  function formatCep(value) {
    const digits = value.replace(/\D/g, "").slice(0, 8);
    return digits.length > 5 ? `${digits.slice(0, 5)}-${digits.slice(5)}` : digits;
  }

  async function handleCepChange(e) {
    const formatted = formatCep(e.target.value);
    setForm((f) => ({ ...f, cep: formatted }));
    setCepFound(false);

    const clean = formatted.replace(/\D/g, "");
    if (clean.length !== 8) return;

    setCepLoading(true);
    try {
      const res = await fetch(`https://viacep.com.br/ws/${clean}/json/`);
      const data = await res.json();
      if (!data.erro) {
        setForm((f) => ({
          ...f,
          street: data.logradouro || f.street,
          neighborhood: data.bairro || f.neighborhood,
          city: data.localidade || f.city,
          uf: data.uf || f.uf,
        }));
        setCepFound(true);
      }
    } catch {
      // silencioso - o usuário pode preencher manualmente
    } finally {
      setCepLoading(false);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    if (form.password.length < 6) {
      setError("A senha precisa ter pelo menos 6 caracteres.");
      return;
    }
    if (form.password !== form.confirm) {
      setError("As senhas não coincidem.");
      return;
    }

    setLoading(true);
    try {
      await register({
        name: form.name,
        email: form.email,
        phone: form.phone,
        password: form.password,
        cep: form.cep,
        street: form.street,
        number: form.number,
        complement: form.complement,
        neighborhood: form.neighborhood,
        city: form.city,
        uf: form.uf,
      });
    } catch (err) {
      setError(err?.response?.data?.error || "Não foi possível criar sua conta. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Field label="Nome completo" icon={User}>
        <input className="input" required value={form.name} onChange={set("name")} autoComplete="name" />
      </Field>
      <Field label="E-mail" icon={Mail}>
        <input
          type="email"
          className="input"
          required
          value={form.email}
          onChange={set("email")}
          autoComplete="email"
        />
      </Field>
      <Field label="WhatsApp / telefone" icon={Phone}>
        <input
          className="input"
          placeholder="(82) 9xxxx-xxxx"
          value={form.phone}
          onChange={set("phone")}
          autoComplete="tel"
        />
      </Field>
      <Field label="Senha" icon={Lock}>
        <PasswordInput
          className="input"
          required
          value={form.password}
          onChange={set("password")}
          autoComplete="new-password"
        />
      </Field>
      <Field label="Confirmar senha" icon={Lock}>
        <PasswordInput
          className="input"
          required
          value={form.confirm}
          onChange={set("confirm")}
          autoComplete="new-password"
        />
      </Field>

      <div className="space-y-4 rounded-lg border border-border bg-background/50 p-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Endereço de entrega <span className="normal-case text-muted-foreground/70">(opcional, mas agiliza sua próxima compra)</span>
        </p>

        <div>
          <label className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <MapPin className="h-3.5 w-3.5" />
            CEP
          </label>
          <div className="flex gap-2">
            <input
              className="input flex-1"
              placeholder="00000-000"
              maxLength={9}
              value={form.cep}
              onChange={handleCepChange}
              autoComplete="postal-code"
              inputMode="numeric"
            />
            {cepLoading && <Loader2 className="h-5 w-5 animate-spin self-center text-neon" />}
          </div>
          {cepFound && !cepLoading && (
            <p className="mt-1 text-[11px] text-neon">
              {form.neighborhood ? `${form.neighborhood}, ` : ""}
              {form.city}/{form.uf} — confirme o número e complemento abaixo.
            </p>
          )}
          <a
            href="https://buscacepinter.correios.com.br/app/endereco/index.php"
            target="_blank"
            rel="noreferrer"
            className="mt-1 inline-block text-[11px] text-muted-foreground hover:text-neon hover:underline"
          >
            Não sei meu CEP
          </a>
        </div>

        {(form.cep.replace(/\D/g, "").length === 8 || form.street) && (
          <>
            <Field label="Rua">
              <input className="input" value={form.street} onChange={set("street")} autoComplete="address-line1" />
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Número">
                <input className="input" value={form.number} onChange={set("number")} autoComplete="off" />
              </Field>
              <Field label="Complemento">
                <input className="input" value={form.complement} onChange={set("complement")} autoComplete="off" />
              </Field>
            </div>

            <Field label="Bairro">
              <input className="input" value={form.neighborhood} onChange={set("neighborhood")} />
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Cidade">
                <input className="input" value={form.city} onChange={set("city")} />
              </Field>
              <Field label="UF">
                <input className="input" maxLength={2} value={form.uf} onChange={set("uf")} />
              </Field>
            </div>
          </>
        )}
      </div>

      <ErrorBox>{error}</ErrorBox>

      <button
        type="submit"
        disabled={loading}
        className="flex w-full items-center justify-center gap-2 rounded-lg bg-neon py-3 text-sm font-bold uppercase tracking-wide text-black transition-transform hover:scale-[1.01] active:scale-95 disabled:opacity-60"
      >
        {loading && <Loader2 className="h-4 w-4 animate-spin" />}
        {loading ? "Criando conta..." : "Criar conta"}
      </button>

      <p className="text-center text-xs text-muted-foreground">
        Já tem conta?{" "}
        <button type="button" onClick={onSwitchToLogin} className="font-semibold text-neon hover:underline">
          Entrar
        </button>
      </p>
    </form>
  );
}

function AccountPanel() {
  const { customer, logout } = useCustomerAuth();

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3 rounded-lg border border-border bg-background p-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-neon/10 text-neon">
          <User className="h-6 w-6" />
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-bold text-white">{customer?.name}</p>
          <p className="truncate text-xs text-muted-foreground">{customer?.email}</p>
        </div>
      </div>

      <ProfileTab />

      <button
        onClick={logout}
        className="flex w-full items-center justify-center gap-2 rounded-lg border border-border py-3 text-xs font-bold uppercase tracking-wide text-muted-foreground transition-colors hover:border-destructive hover:text-destructive"
      >
        <LogOut className="h-4 w-4" />
        Sair da conta
      </button>
    </div>
  );
}

function ProfileTab() {
  const { customer, updateProfile, changePassword } = useCustomerAuth();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState(() => ({
    name: customer?.name || "",
    phone: customer?.phone || "",
    cep: customer?.cep || "",
    street: customer?.street || "",
    number: customer?.number || "",
    complement: customer?.complement || "",
    neighborhood: customer?.neighborhood || "",
    city: customer?.city || "",
    uf: customer?.uf || "",
  }));
  const [cepLoading, setCepLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  function set(field) {
    return (e) => setForm((f) => ({ ...f, [field]: e.target.value }));
  }

  async function lookupCep() {
    const clean = form.cep.replace(/\D/g, "");
    if (clean.length !== 8) return;
    setCepLoading(true);
    try {
      const res = await fetch(`https://viacep.com.br/ws/${clean}/json/`);
      const data = await res.json();
      if (!data.erro) {
        setForm((f) => ({
          ...f,
          street: data.logradouro || f.street,
          neighborhood: data.bairro || f.neighborhood,
          city: data.localidade || f.city,
          uf: data.uf || f.uf,
        }));
      }
    } catch {
      // silencioso - o usuário pode preencher manualmente
    } finally {
      setCepLoading(false);
    }
  }

  async function handleSave(e) {
    e.preventDefault();
    setError("");
    setSuccess("");
    setSaving(true);
    try {
      await updateProfile(form);
      setSuccess("Dados atualizados com sucesso.");
      setEditing(false);
    } catch (err) {
      setError(err?.response?.data?.error || "Não foi possível salvar. Tente novamente.");
    } finally {
      setSaving(false);
    }
  }

  if (!editing) {
    const hasAddress = form.street && form.city;
    return (
      <div className="space-y-4">
        <div className="rounded-lg border border-border bg-background p-4 text-sm">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Telefone</p>
          <p className="text-white">{customer?.phone || "Não informado"}</p>
        </div>

        <div className="rounded-lg border border-border bg-background p-4 text-sm">
          <div className="mb-1 flex items-center gap-1.5 text-xs uppercase tracking-wide text-muted-foreground">
            <MapPin className="h-3.5 w-3.5" />
            Endereço salvo
          </div>
          {hasAddress ? (
            <p className="text-white">
              {form.street}, {form.number}
              {form.complement ? ` - ${form.complement}` : ""}
              <br />
              {form.neighborhood} - {form.city}/{form.uf} - {form.cep}
            </p>
          ) : (
            <p className="text-muted-foreground">Nenhum endereço salvo ainda.</p>
          )}
        </div>

        <button
          onClick={() => setEditing(true)}
          className="flex w-full items-center justify-center gap-2 rounded-lg border border-neon/40 py-3 text-xs font-bold uppercase tracking-wide text-neon transition-colors hover:bg-neon/10"
        >
          <Pencil className="h-3.5 w-3.5" />
          Editar dados e endereço
        </button>

        <ChangePasswordBox changePassword={changePassword} />
      </div>
    );
  }

  return (
    <form onSubmit={handleSave} className="space-y-4">
      <Field label="Nome completo" icon={User}>
        <input className="input" required value={form.name} onChange={set("name")} />
      </Field>
      <Field label="Telefone" icon={Phone}>
        <input className="input" value={form.phone} onChange={set("phone")} />
      </Field>

      <div>
        <label className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          <MapPin className="h-3.5 w-3.5" />
          CEP
        </label>
        <div className="flex gap-2">
          <input
            className="input flex-1"
            placeholder="00000-000"
            maxLength={9}
            value={form.cep}
            onChange={set("cep")}
            onBlur={lookupCep}
          />
          {cepLoading && <Loader2 className="h-5 w-5 animate-spin self-center text-neon" />}
        </div>
      </div>

      <Field label="Rua">
        <input className="input" value={form.street} onChange={set("street")} />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Número">
          <input className="input" value={form.number} onChange={set("number")} />
        </Field>
        <Field label="Complemento">
          <input className="input" value={form.complement} onChange={set("complement")} />
        </Field>
      </div>

      <Field label="Bairro">
        <input className="input" value={form.neighborhood} onChange={set("neighborhood")} />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Cidade">
          <input className="input" value={form.city} onChange={set("city")} />
        </Field>
        <Field label="UF">
          <input className="input" maxLength={2} value={form.uf} onChange={set("uf")} />
        </Field>
      </div>

      <ErrorBox>{error}</ErrorBox>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setEditing(false)}
          className="flex-1 rounded-lg border border-border py-3 text-xs font-bold uppercase tracking-wide text-muted-foreground hover:text-white"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={saving}
          className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-neon py-3 text-xs font-bold uppercase tracking-wide text-black disabled:opacity-60"
        >
          {saving && <Loader2 className="h-4 w-4 animate-spin" />}
          Salvar
        </button>
      </div>
      {success && <p className="text-center text-xs text-neon">{success}</p>}
    </form>
  );
}

function ChangePasswordBox({ changePassword }) {
  const [open, setOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setSuccess("");
    if (newPassword.length < 6) {
      setError("A nova senha precisa ter pelo menos 6 caracteres.");
      return;
    }
    if (newPassword !== confirm) {
      setError("As senhas não coincidem.");
      return;
    }
    setLoading(true);
    try {
      await changePassword(currentPassword, newPassword);
      setSuccess("Senha alterada com sucesso.");
      setCurrentPassword("");
      setNewPassword("");
      setConfirm("");
    } catch (err) {
      setError(err?.response?.data?.error || "Não foi possível alterar a senha.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-lg border border-border">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-4 py-3 text-xs font-bold uppercase tracking-wide text-muted-foreground hover:text-white"
      >
        <span className="flex items-center gap-2">
          <Lock className="h-3.5 w-3.5" />
          Alterar senha
        </span>
        <ChevronRight className={`h-4 w-4 transition-transform ${open ? "rotate-90" : ""}`} />
      </button>
      {open && (
        <form onSubmit={handleSubmit} className="space-y-3 border-t border-border p-4">
          <PasswordInput
            className="input"
            placeholder="Senha atual"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            autoComplete="current-password"
            required
          />
          <PasswordInput
            className="input"
            placeholder="Nova senha"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            autoComplete="new-password"
            required
          />
          <PasswordInput
            className="input"
            placeholder="Confirmar nova senha"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            autoComplete="new-password"
            required
          />
          <ErrorBox>{error}</ErrorBox>
          {success && <p className="text-xs text-neon">{success}</p>}
          <button
            type="submit"
            disabled={loading}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-neon py-2.5 text-xs font-bold uppercase tracking-wide text-black disabled:opacity-60"
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            Salvar nova senha
          </button>
        </form>
      )}
    </div>
  );
}