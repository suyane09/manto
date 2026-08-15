import { BrowserRouter, Routes, Route } from "react-router-dom";

import Home from "../pages/Home";
import Login from "../pages/Login";
import Dashboard from "../pages/Dashboard";
import Produtos from "../pages/Produtos";
import Vendas from "../pages/Vendas";
import CheckoutStatus from "../pages/CheckoutStatus";
import ResetPassword from "../pages/ResetPassword";

import DashboardLayout from "../layouts/DashboardLayout";
import ProtectedRoute from "../components/ProtectedRoute";

function AppRoutes() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Página inicial (loja) */}
        <Route path="/" element={<Home />} />

        {/* Login do painel */}
        <Route path="/login" element={<Login />} />

        {/* Redefinição de senha do cliente (link enviado por e-mail) */}
        <Route path="/redefinir-senha" element={<ResetPassword />} />

        {/* Retorno do pagamento (Mercado Pago) */}
        <Route path="/checkout/sucesso" element={<CheckoutStatus variant="sucesso" />} />
        <Route path="/checkout/pendente" element={<CheckoutStatus variant="pendente" />} />
        <Route path="/checkout/falha" element={<CheckoutStatus variant="falha" />} />

        {/* Área administrativa (protegida) */}
        <Route element={<ProtectedRoute />}>
          <Route
            path="/dashboard"
            element={
              <DashboardLayout>
                <Dashboard />
              </DashboardLayout>
            }
          />

          <Route
            path="/produtos"
            element={
              <DashboardLayout>
                <Produtos />
              </DashboardLayout>
            }
          />

          <Route
            path="/vendas"
            element={
              <DashboardLayout>
                <Vendas />
              </DashboardLayout>
            }
          />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default AppRoutes;
