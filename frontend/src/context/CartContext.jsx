import { createContext, useContext, useEffect, useMemo, useState } from 'react';

// The cart is kept in localStorage so it survives a page refresh, and only
// becomes a real Order (via POST /api/orders) at checkout. Prices shown here
// are for display - the server always re-prices items from the database.
const CartContext = createContext(null);

const STORAGE_KEY = 'cart';
const MAX_QUANTITY = 100; // Mirrors the limit enforced by the API

const clampQuantity = (value) => {
  const quantity = Math.floor(Number(value));
  if (!Number.isFinite(quantity)) return 1;
  return Math.min(Math.max(quantity, 1), MAX_QUANTITY);
};

function readSavedCart() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return Array.isArray(saved) ? saved : [];
  } catch {
    return [];
  }
}

export function CartProvider({ children }) {
  const [items, setItems] = useState(readSavedCart); // [{ product, name, price, quantity }]

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch {
      // Storage full or blocked - the cart still works for this session.
    }
  }, [items]);

  const value = useMemo(
    () => ({
      items,
      addToCart: (product, quantity = 1) =>
        setItems((prev) => {
          const existing = prev.find((item) => item.product === product._id);
          if (existing) {
            return prev.map((item) =>
              item.product === product._id
                ? { ...item, quantity: clampQuantity(item.quantity + quantity) }
                : item
            );
          }
          return [
            ...prev,
            {
              product: product._id,
              name: product.name,
              price: product.price,
              quantity: clampQuantity(quantity),
            },
          ];
        }),
      removeFromCart: (productId) =>
        setItems((prev) => prev.filter((item) => item.product !== productId)),
      updateQuantity: (productId, quantity) =>
        setItems((prev) =>
          prev.map((item) =>
            item.product === productId ? { ...item, quantity: clampQuantity(quantity) } : item
          )
        ),
      clearCart: () => setItems([]),
      totalAmount: items.reduce((sum, item) => sum + item.price * item.quantity, 0),
      itemCount: items.reduce((sum, item) => sum + item.quantity, 0),
    }),
    [items]
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) throw new Error('useCart must be used inside <CartProvider>');
  return context;
}
