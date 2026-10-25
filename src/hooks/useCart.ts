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
};

const CART_KEY = "@kiosco_cart";
const EVENT_NAME = "cart-updated"; // Nombre del evento global

export function useCart() {
  const [items, setItems] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadCart();

    // Escuchar cambios desde cualquier pantalla
    const subscription = DeviceEventEmitter.addListener(EVENT_NAME, () => {
      loadCart();
    });

    return () => subscription.remove(); // Limpiar al desmontar
  }, []);

  const loadCart = async () => {
    try {
      const json = await AsyncStorage.getItem(CART_KEY);
      if (json) setItems(JSON.parse(json));
      else setItems([]);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const saveCart = async (newItems: CartItem[]) => {
    try {
      await AsyncStorage.setItem(CART_KEY, JSON.stringify(newItems));
      setItems(newItems);
      // 🚨 Emitir evento para actualizar TODAS las pantallas
      DeviceEventEmitter.emit(EVENT_NAME);
    } catch (e) {
      console.error(e);
    }
  };

  const addToCart = (item: Omit<CartItem, "cantidad">) => {
    const existing = items.find((i) => i.id === item.id);
    if (existing) {
      saveCart(
        items.map((i) =>
          i.id === item.id ? { ...i, cantidad: i.cantidad + 1 } : i,
        ),
      );
    } else {
      saveCart([...items, { ...item, cantidad: 1 }]);
    }
  };

  const updateQuantity = (id: number, delta: number) => {
    saveCart(
      items.map((item) => {
        if (item.id === id) {
          return { ...item, cantidad: Math.max(1, item.cantidad + delta) };
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
    total,
    count,
  };
}
