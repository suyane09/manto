import React, { createContext, useContext, useMemo, useState, useCallback } from "react";

const CartContext = createContext(null);

function makeKey(item) {
  return [item.id, item.line, item.size, item.customName, item.customNumber]
    .filter(Boolean)
    .join("::");
}

export function CartProvider({ children }) {
  const [items, setItems] = useState([]);
  const [isOpen, setIsOpen] = useState(false);

  const openCart = useCallback(() => setIsOpen(true), []);
  const closeCart = useCallback(() => setIsOpen(false), []);

  const addItem = useCallback((item) => {
    const key = makeKey(item);
    setItems((prev) => {
      const existing = prev.find((it) => it.key === key);
      if (existing) {
        return prev.map((it) =>
          it.key === key ? { ...it, qty: it.qty + 1 } : it
        );
      }
      return [...prev, { ...item, key, qty: 1 }];
    });
    setIsOpen(true);
  }, []);

  const removeItem = useCallback((key) => {
    setItems((prev) => prev.filter((it) => it.key !== key));
  }, []);

  const incQty = useCallback((key) => {
    setItems((prev) =>
      prev.map((it) => (it.key === key ? { ...it, qty: it.qty + 1 } : it))
    );
  }, []);

  const decQty = useCallback((key) => {
    setItems((prev) =>
      prev
        .map((it) => (it.key === key ? { ...it, qty: it.qty - 1 } : it))
        .filter((it) => it.qty > 0)
    );
  }, []);

  const clear = useCallback(() => setItems([]), []);

  const totalCount = useMemo(
    () => items.reduce((sum, it) => sum + it.qty, 0),
    [items]
  );
  const totalPrice = useMemo(
    () => items.reduce((sum, it) => sum + it.qty * it.price, 0),
    [items]
  );

  const value = {
    items,
    isOpen,
    openCart,
    closeCart,
    addItem,
    removeItem,
    incQty,
    decQty,
    clear,
    totalCount,
    totalPrice,
  };

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart deve ser usado dentro de CartProvider");
  return ctx;
}