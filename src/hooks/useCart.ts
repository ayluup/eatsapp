// src/hooks/useCart.ts
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useState } from "react";
import { DeviceEventEmitter } from "react-native"; // ✅ Nativo, sin instalar nada

export type CartItem = {
  id: number;
  nombre: string;
  precio: number;
  imagen_url: string | null;
  cantidad: number;
  // Unidades que había al agregarlo (null = sin límite). El servidor
  // vuelve a controlar al confirmar, por si alguien pidió antes.
  stock?: number | null;
};

// ¿Se puede sumar una unidad más?
export const canAddMore = (item: Pick<CartItem, "cantidad" | "stock">) =>
  item.stock == null || item.cantidad < item.stock;

const CART_KEY = "@kiosco_cart";
const EVENT_NAME = "cart-updated"; // Nombre del evento global

// Las fotos viejas en base64 pesan cientos de KB cada una y en Android
// AsyncStorage no puede leer valores de más de ~2 MB: se guardan sin foto.
const withoutInlineImage = (item: CartItem): CartItem =>
  item.imagen_url?.startsWith("data:") ? { ...item, imagen_url: null } : item;

// Lee el carrito guardado
export async function readCart(): Promise<CartItem[] | null> {
  try {
    const json = await AsyncStorage.getItem(CART_KEY);
    return json ? (JSON.parse(json) as CartItem[]).map(withoutInlineImage) : [];
  } catch (e) {
    // Carrito ilegible (ej. uno viejo con fotos, demasiado grande): se descarta
    console.warn("No se pudo leer el carrito:", e);
    await AsyncStorage.removeItem(CART_KEY).catch(() => {});
    return [];
  }
}

// Guarda el carrito y avisa a todas las pantallas (también lo usa el asistente)
export async function writeCart(newItems: CartItem[]) {
  await AsyncStorage.setItem(CART_KEY, JSON.stringify(newItems.map(withoutInlineImage)));
  DeviceEventEmitter.emit(EVENT_NAME);
}

export function useCart() {
  const [items, setItems] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(true);

  const loadCart = () =>
    readCart().then((saved) => {
      if (saved) setItems(saved);
      setLoading(false);
    });

  useEffect(() => {
    loadCart();

    // Escuchar cambios desde cualquier pantalla
    const subscription = DeviceEventEmitter.addListener(EVENT_NAME, () => {
      loadCart();
    });

    return () => subscription.remove(); // Limpiar al desmontar
  }, []);

  const saveCart = async (newItems: CartItem[]) => {
    try {
      setItems(newItems);
      await writeCart(newItems);
    } catch (e) {
      console.error(e);
    }
  };

  // Devuelve false si ya no quedan unidades para agregar
  const addToCart = (item: Omit<CartItem, "cantidad">) => {
    const existing = items.find((i) => i.id === item.id);
    if (existing) {
      const updated = { ...existing, stock: item.stock };
      if (!canAddMore(updated)) return false;
      saveCart(
        items.map((i) =>
          i.id === item.id ? { ...updated, cantidad: i.cantidad + 1 } : i,
        ),
      );
    } else {
      if (item.stock === 0) return false;
      saveCart([...items, { ...item, cantidad: 1 }]);
    }
    return true;
  };

  const updateQuantity = (id: number, delta: number) => {
    saveCart(
      items.map((item) => {
        if (item.id === id) {
          const max = item.stock ?? Infinity;
          return {
            ...item,
            cantidad: Math.min(max, Math.max(1, item.cantidad + delta)),
          };
        }
        return item;
      }),
    );
  };

  const removeItem = (id: number) => {
    saveCart(items.filter((item) => item.id !== id));
  };

  const clearCart = () => {
    saveCart([]);
  };

  const resetCount = () => {
    saveCart([]);
  };

  const total = items.reduce(
    (sum, item) => sum + item.precio * item.cantidad,
    0,
  );
  const count = items.reduce((sum, item) => sum + item.cantidad, 0);

  return {
    items,
    loading,
    addToCart,
    updateQuantity,
    removeItem,
    clearCart,
    resetCount,
    reload: loadCart,
    total,
    count,
  };
}
