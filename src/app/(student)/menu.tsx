import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { useCart } from "../../hooks/useCart";
import { supabase } from "../../services/supabase";

import {
    ActivityIndicator,
    FlatList,
    Image,
    Pressable,
    StyleSheet,
    Text,
    View,
} from "react-native";

export type MenuItem = {
  id: number;
  nombre: string;
  descripcion: string | null;
  precio: number;
  disponible: boolean;
  imagen_url: string | null;
};

const formatPrice = (p: number) => "$" + p.toLocaleString("es-AR");

export default function StudentMenuScreen() {
  const [menu, setMenu] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);

  // ✅ Hook real que sincroniza contador con AsyncStorage
  const { addToCart, count: cartCount } = useCart();

  const [showToast, setShowToast] = useState(false);
  const [lastAddedItem, setLastAddedItem] = useState("");
  const router = useRouter();

  useEffect(() => {
    fetchMenu();
  }, []);

  const fetchMenu = async () => {
    try {
      const { data, error } = await supabase
        .from("menus")
        .select("*")
        .order("nombre", { ascending: true });
      if (error) throw error;
      setMenu(data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleAddToCart = (item: MenuItem) => {
    if (!item.disponible) return;

    addToCart({
      id: item.id,
      nombre: item.nombre,
      precio: item.precio,
      imagen_url: item.imagen_url,
    });

    setLastAddedItem(item.nombre);
    setShowToast(true);
    setTimeout(() => setShowToast(false), 1500);
  };

  if (loading)
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color="#10B981" />
      </View>
    );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Menú del Kiosco</Text>
        <Text style={styles.subtitle}>Seleccioná lo que quieras pedir hoy</Text>
      </View>

      <FlatList
        data={menu}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) => (
          <Pressable
            style={[styles.card, !item.disponible && styles.cardDisabled]}
            onPress={() => handleAddToCart(item)}
            disabled={!item.disponible}
          >
            {item.imagen_url ? (
              <Image source={{ uri: item.imagen_url }} style={styles.image} />
            ) : (
              <View style={[styles.image, styles.placeholderImg]} />
            )}

            <View style={styles.info}>
              <Text
                style={[styles.name, !item.disponible && styles.textDisabled]}
              >
                {item.nombre}
              </Text>
              <Text style={styles.desc} numberOfLines={2}>
                {item.descripcion || "Sin descripción"}
              </Text>

              {/* ✅ PRECIO PRIMERO */}
              <Text
                style={[styles.price, !item.disponible && styles.textDisabled]}
              >
                {formatPrice(item.precio)}
              </Text>

              {/* ✅ BADGE DE STOCK DEBAJO DEL PRECIO (SIN TILDE) */}
              <View
                style={[
                  styles.stockBadge,
                  item.disponible
                    ? styles.badgeInStock
                    : styles.badgeOutOfStock,
                ]}
              >
                <Ionicons
                  name={item.disponible ? "checkmark-circle" : "close-circle"}
                  size={14}
                  color="#fff"
                />
                <Text style={styles.stockText}>
                  {item.disponible ? "Disponible" : "Agotado"}
                </Text>
              </View>
            </View>

            <View
              style={[
                styles.addButton,
                !item.disponible && styles.addBtnDisabled,
              ]}
            >
              <Ionicons
                name={item.disponible ? "add" : "lock-closed"}
                size={24}
                color={item.disponible ? "#fff" : "#CBD5E1"}
              />
            </View>
          </Pressable>
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="fast-food-outline" size={48} color="#CBD5E1" />
            <Text style={styles.emptyText}>No hay productos disponibles </Text>
          </View>
        }
      />

      {showToast && (
        <View style={styles.toastContainer}>
          <View style={styles.toast}>
            <Ionicons name="checkmark-circle" size={20} color="#10B981" />
            <Text style={styles.toastText}>"{lastAddedItem}" agregado</Text>
          </View>
        </View>
      )}

      <View style={styles.bottomNav}>
        <Pressable style={styles.navItemActive}>
          <Ionicons name="restaurant-outline" size={26} color="#10B981" />
          <Text style={styles.navTextActive}>Menú</Text>
        </Pressable>

        <Pressable
          style={styles.navItemInactive}
          onPress={() => router.push("/(student)/carrito")}
        >
          <View style={styles.cartBadgeWrapper}>
            {cartCount > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>
                  {cartCount > 9 ? "+9" : cartCount}
                </Text>
              </View>
            )}
            {/* ✅ ÍCONO ACTUALIZADO A CART-OUTLINE */}
            <Ionicons
              name="cart-outline"
              size={26}
              color={cartCount > 0 ? "#0F172A" : "#94A3B8"}
            />
          </View>
          <Text
            style={[
              styles.navTextInactive,
              cartCount > 0 && styles.navTextActiveDark,
            ]}
          >
            Mi Carrito
          </Text>
        </Pressable>

        <Pressable
          style={styles.navItemInactive}
          onPress={() => router.push("/(student)/mis-pedidos")}
        >
          <Ionicons name="receipt-outline" size={26} color="#94A3B8" />
          <Text style={styles.navTextInactive}>Mis Pedidos</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F8FAFC" },
  loading: { flex: 1, justifyContent: "center", alignItems: "center" },

  header: { paddingHorizontal: 24, paddingTop: 60, paddingBottom: 20 },
  title: { fontSize: 28, fontWeight: "800", color: "#0F172A" },
  subtitle: { fontSize: 15, color: "#64748B", marginTop: 4 },

  list: { paddingHorizontal: 16, paddingBottom: 100 },

  card: {
    flexDirection: "row",
    backgroundColor: "#FFF",
    borderRadius: 20,
    padding: 16,
    marginBottom: 14,
    alignItems: "center",
    shadowColor: "#0F172A",
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  cardDisabled: { opacity: 0.6, backgroundColor: "#F8FAFC" },

  image: {
    width: 72,
    height: 72,
    borderRadius: 14,
    backgroundColor: "#F1F5F9",
  },
  placeholderImg: { justifyContent: "center", alignItems: "center" },

  info: { flex: 1, marginLeft: 16, marginRight: 12 },
  name: { fontSize: 16, fontWeight: "700", color: "#0F172A", marginBottom: 4 },
  textDisabled: { color: "#94A3B8" },
  desc: { fontSize: 13, color: "#64748B", lineHeight: 18, marginBottom: 8 },

  // ✅ PRECIO CON MARGEN INFERIOR PARA SEPARAR DEL BADGE
  price: { fontSize: 17, fontWeight: "800", color: "#10B981", marginBottom: 6 },

  // ✅ BADGE DE STOCK SIN TILDE
  stockBadge: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    gap: 4,
  },
  badgeInStock: { backgroundColor: "#10B981" },
  badgeOutOfStock: { backgroundColor: "#EF4444" },
  stockText: { color: "#fff", fontSize: 11, fontWeight: "700" },

  addButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "#10B981",
    justifyContent: "center",
    alignItems: "center",
  },
  addBtnDisabled: { backgroundColor: "#E2E8F0" },

  empty: { alignItems: "center", marginTop: 80, gap: 12 },
  emptyText: { fontSize: 16, color: "#64748B", textAlign: "center" },

  toastContainer: {
    position: "absolute",
    bottom: 90,
    left: 20,
    right: 20,
    alignItems: "center",
    zIndex: 100,
  },
  toast: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 16,
    shadowColor: "#0F172A",
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 8,
    gap: 10,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  toastText: { fontSize: 14, fontWeight: "600", color: "#0F172A" },

  bottomNav: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    backgroundColor: "#FFF",
    borderTopWidth: 1,
    borderTopColor: "#E2E8F0",
    paddingBottom: 25,
    paddingTop: 12,
    paddingHorizontal: 20,
    shadowColor: "#0F172A",
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 10,
  },
  navItemActive: { flex: 1, alignItems: "center", gap: 4 },
  navItemInactive: { flex: 1, alignItems: "center", gap: 4 },
  navTextActive: { fontSize: 12, fontWeight: "700", color: "#10B981" },
  navTextInactive: { fontSize: 12, fontWeight: "600", color: "#94A3B8" },
  navTextActiveDark: { color: "#0F172A", fontWeight: "700" },

  cartBadgeWrapper: {
    position: "relative",
    alignItems: "center",
    justifyContent: "center",
  },
  badge: {
    position: "absolute",
    top: -6,
    right: -8,
    backgroundColor: "#EF4444",
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 4,
    zIndex: 10,
    borderWidth: 2,
    borderColor: "#FFF",
  },
  badgeText: { color: "#fff", fontSize: 10, fontWeight: "800" },
});
