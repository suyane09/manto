import { Toaster } from "sonner";
import { CartProvider } from "@/context/CartContext";
import { CustomerAuthProvider } from "@/context/CustomerAuthContext";
import { AuthProvider } from "@/lib/AuthContext";
import AppRoutes from "@/routes/AppRoutes";

function App() {
  return (
    <AuthProvider>
      <CustomerAuthProvider>
        <CartProvider>
          <AppRoutes />
          <Toaster
            theme="dark"
            position="bottom-center"
            toastOptions={{
              style: {
                background: "hsl(220 18% 9%)",
                border: "1px solid hsl(220 14% 18%)",
                color: "white",
              },
            }}
          />
        </CartProvider>
      </CustomerAuthProvider>
    </AuthProvider>
  );
}

export default App;
