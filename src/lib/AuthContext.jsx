import { createContext, useContext, useState, useCallback } from "react";
import api from "./api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem("arsenal_admin_token"));
  const [username, setUsername] = useState(() => localStorage.getItem("arsenal_admin_username"));

  const login = useCallback(async (usernameInput, password) => {
    const { data } = await api.post("/auth/login", { username: usernameInput, password });
    localStorage.setItem("arsenal_admin_token", data.token);
    localStorage.setItem("arsenal_admin_username", data.username);
    setToken(data.token);
    setUsername(data.username);
    return data;
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem("arsenal_admin_token");
    localStorage.removeItem("arsenal_admin_username");
    setToken(null);
    setUsername(null);
  }, []);

  const isAuthenticated = !!token;

  return (
    <AuthContext.Provider value={{ token, username, isAuthenticated, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth deve ser usado dentro de AuthProvider");
  return ctx;
}
