import { createContext, useContext, useState, useCallback, useEffect } from "react";
import customerApi, { CUSTOMER_TOKEN_KEY } from "@/lib/customerApi";

const PROFILE_KEY = "arsenal_customer_profile";
const CustomerAuthContext = createContext(null);

export function CustomerAuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem(CUSTOMER_TOKEN_KEY));
  const [customer, setCustomer] = useState(() => {
    const raw = localStorage.getItem(PROFILE_KEY);
    return raw ? JSON.parse(raw) : null;
  });
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  const isAuthenticated = !!token;

  const persist = useCallback((newToken, newCustomer) => {
    localStorage.setItem(CUSTOMER_TOKEN_KEY, newToken);
    localStorage.setItem(PROFILE_KEY, JSON.stringify(newCustomer));
    setToken(newToken);
    setCustomer(newCustomer);
  }, []);

  const register = useCallback(
    async ({ name, email, phone, password, cep, street, number, complement, neighborhood, city, uf }) => {
      const { data } = await customerApi.post("/customer-auth/register", {
        name,
        email,
        phone,
        password,
        cep,
        street,
        number,
        complement,
        neighborhood,
        city,
        uf,
      });
      persist(data.token, data.customer);
      return data.customer;
    },
    [persist]
  );

  const login = useCallback(
    async (email, password) => {
      const { data } = await customerApi.post("/customer-auth/login", { email, password });
      persist(data.token, data.customer);
      return data.customer;
    },
    [persist]
  );

  const logout = useCallback(() => {
    localStorage.removeItem(CUSTOMER_TOKEN_KEY);
    localStorage.removeItem(PROFILE_KEY);
    setToken(null);
    setCustomer(null);
  }, []);

  const updateProfile = useCallback(
    async (fields) => {
      const { data } = await customerApi.put("/customer-auth/me", fields);
      localStorage.setItem(PROFILE_KEY, JSON.stringify(data));
      setCustomer(data);
      return data;
    },
    []
  );

  const changePassword = useCallback(async (currentPassword, newPassword) => {
    await customerApi.post("/customer-auth/change-password", { currentPassword, newPassword });
  }, []);

  const fetchOrders = useCallback(async () => {
    const { data } = await customerApi.get("/customer-auth/orders");
    return data;
  }, []);

  // Se o token expirar/for inválido em algum momento, sincroniza o estado local.
  useEffect(() => {
    function handleStorage(e) {
      if (e.key === CUSTOMER_TOKEN_KEY && !e.newValue) {
        setToken(null);
        setCustomer(null);
      }
    }
    function handleForcedLogout() {
      setToken(null);
      setCustomer(null);
    }
    window.addEventListener("storage", handleStorage);
    window.addEventListener("arsenal:customer-logout", handleForcedLogout);
    return () => {
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener("arsenal:customer-logout", handleForcedLogout);
    };
  }, []);

  const openDrawer = useCallback(() => setIsDrawerOpen(true), []);
  const closeDrawer = useCallback(() => setIsDrawerOpen(false), []);

  const value = {
    token,
    customer,
    isAuthenticated,
    register,
    login,
    logout,
    updateProfile,
    changePassword,
    fetchOrders,
    isDrawerOpen,
    openDrawer,
    closeDrawer,
  };

  return <CustomerAuthContext.Provider value={value}>{children}</CustomerAuthContext.Provider>;
}

export function useCustomerAuth() {
  const ctx = useContext(CustomerAuthContext);
  if (!ctx) throw new Error("useCustomerAuth deve ser usado dentro de CustomerAuthProvider");
  return ctx;
}
