import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { useCart } from "../../hooks/useCart";
import { supabase } from "../../services/supabase";

import {
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { ThemeColors } from "../../constants/theme";
import { useThemedStyles } from "../../hooks/use-themed-styles";

export type MenuItem = {
  id: number;
  nombre: string;
  descripcion: string | null;
  precio: number;
  disponible: boolean;
  imagen_url: string | null;
  categoria: string;
};

const formatPrice = (p: number) => "$" + p.toLocaleString("es-AR");
const CATEGORIES = ["Todos", "Comida", "Gaseosas", "Bebidas"];

export default function StudentMenuScreen() {
  const { colors: c, styles } = useThemedStyles(createStyles);
  const [menu, setMenu] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState("Todos");

  const { addToCart, count: cartCount } = useCart();
  const { signOut } = useAuth();
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
      const safeData = (data || []).map((item) => ({
        ...item,
        categoria: item.categoria || "Comida",
      }));
      setMenu(safeData);
    } catch (err: any) {
      console.error("Error cargando menú:", err.message);
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

  const filteredMenu =
    selectedCategory === "Todos"
      ? menu
      : menu.filter((item) => item.categoria === selectedCategory);

  return (
    <View style={styles.container}>
      <View style={styles.bgTop} />
      <View style={styles.bgBottom} />

      {/* ✅ HEADER CON LOGOUT POSICIONADO CORRECTAMENTE */}
      <View style={styles.header}>
        <View style={styles.headerTextContainer}>
          <Text style={styles.title}>Menú del Kiosco</Text>
          <Text style={styles.subtitle}>
            Seleccioná lo que quieras pedir hoy
          </Text>
        </View>

        <Pressable
          style={({ pressed }) => [
            styles.logoutBtn,
            pressed && styles.logoutBtnPressed,
          ]}
          onPress={async () => {
            await signOut();
          }}
        >
          <Ionicons name="log-out-outline" size={22} color={c.danger} />
        </Pressable>
      </View>

      <View style={styles.categoriesRow}>
        {CATEGORIES.map((cat) => (
          <Pressable
            key={cat}
            style={[
              styles.categoryBtn,
              selectedCategory === cat && styles.categoryBtnActive,
            ]}
            onPress={() => setSelectedCategory(cat)}
          >
            <Text
              style={[
                styles.categoryText,
                selectedCategory === cat && styles.categoryTextActive,
              ]}
            >
              {cat}
            </Text>
          </Pressable>
        ))}
      </View>

      <FlatList
        data={filteredMenu}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) => {
          const hasImage =
            typeof item.imagen_url === "string" && item.imagen_url.length > 0;
          const isDisabled = !item.disponible;

          return (
            <Pressable
              style={[
                styles.card,
                !hasImage && styles.cardNoImage,
                isDisabled && styles.cardDisabled,
              ]}
              onPress={() => handleAddToCart(item)}
              disabled={isDisabled}
            >
              {hasImage && (
                <Image
                  source={{ uri: item.imagen_url! }}
                  style={styles.image}
                />
              )}

              <View style={[styles.info, !hasImage && styles.infoFullWidth]}>
                <Text style={[styles.name, isDisabled && styles.textDisabled]}>
                  {item.nombre}
                </Text>
                <Text style={styles.desc} numberOfLines={2}>
                  {item.descripcion || "Sin descripción"}
                </Text>
                <Text style={[styles.price, isDisabled && styles.textDisabled]}>
                  {formatPrice(item.precio)}
                </Text>

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
                    color={c.onAccent}
                  />
                  <Text style={styles.stockText}>
                    {item.disponible ? "Disponible" : "Agotado"}
                  </Text>
                </View>
              </View>

              {!isDisabled && (
                <Pressable
                  style={styles.addButton}
                  onPress={() => handleAddToCart(item)}
                >
                  <Ionicons name="add" size={24} color={c.onAccent} />
                </Pressable>
              )}
            </Pressable>
          );
        }}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="fast-food-outline" size={48} color={c.textFaint} />
            <Text style={styles.emptyTitle}>
              {selectedCategory === "Todos"
                ? "No hay productos disponibles"
                : `No hay productos en ${selectedCategory}`}
            </Text>
            <Text style={styles.emptyText}>
              {selectedCategory === "Todos"
                ? "Volvé más tarde o consultá en el kiosco"
                : "Probá seleccionando otra categoría"}
            </Text>
          </View>
        }
      />

      {showToast && (
        <View style={styles.toastContainer}>
          <View style={styles.toast}>
            <Ionicons name="checkmark-circle" size={20} color={c.success} />
            <Text style={styles.toastText}>"{lastAddedItem}" agregado</Text>
          </View>
        </View>
      )}

      <View style={styles.floatingNavWrapper}>
        <View style={styles.floatingNav}>
          {/* Menú: ACTIVO (Blanco con texto Azul) */}
          <Pressable style={styles.navItemActive}>
            <Ionicons name="restaurant" size={24} color={c.accent} />
            <Text style={styles.navTextActive}>Menú</Text>
          </Pressable>
          <Pressable
            style={styles.navItemInactive}
            onPress={() => router.push("/(student)/carrito")}
          >
            <View style={styles.cartIconWrapper}>
              {cartCount > 0 && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>
                    {cartCount > 9 ? "+9" : cartCount}
                  </Text>
                </View>
              )}
              <Ionicons
                name="cart-outline"
                size={24}
                color={cartCount > 0 ? c.text : c.textMuted}
              />
            </View>
            <Text
              style={[
                styles.navTextInactive,
                cartCount > 0 && styles.navTextDark,
              ]}
            >
              Carrito
            </Text>
          </Pressable>

          <Pressable
            style={styles.navItemInactive}
            onPress={() => router.push("/(student)/mis-pedidos")}
          >
            <Ionicons name="receipt-outline" size={24} color={c.textMuted} />
            <Text style={styles.navTextInactive}>Pedidos</Text>
          </Pressable>
          <Pressable
            style={styles.navItemInactive}
            onPress={() => router.push("/(student)/perfil")}
          >
            <Ionicons name="person-circle-outline" size={24} color={c.textMuted} />
            <Text style={styles.navTextInactive}>Perfil</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const createStyles = (c: ThemeColors) => StyleSheet.create({
  container: { flex: 1 },

  bgTop: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: "30%",
    backgroundColor: c.decorStudent,
    borderBottomRightRadius: 80,
    borderBottomLeftRadius: 80,
    zIndex: 0,
  },
  bgBottom: {
    position: "absolute",
    top: "48%",
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: c.surfaceAlt,
    borderTopLeftRadius: 80,
    borderTopRightRadius: 80,
    zIndex: 0,
  },

  loading: { flex: 1, justifyContent: "center", alignItems: "center" },

  // ✅ HEADER MEJORADO CON LOGOUT ALINEADO
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start", // Alinea al inicio para que el logout quede arriba
    paddingHorizontal: 24,
    paddingTop: 60,
    paddingBottom: 16,
    zIndex: 1,
  },
  headerTextContainer: { flex: 1 }, // Permite que el texto ocupe el espacio disponible
  title: {
    fontSize: 28,
    fontWeight: "800",
    color: c.text,
    letterSpacing: -0.5,
  },
  subtitle: { fontSize: 15, color: c.textSecondary, marginTop: 4 },

  // ✅ ESTILOS DEL BOTÓN DE SALIR TIPO CÁPSULA
  logoutBtn: {
    padding: 10,
    borderRadius: 12,
    backgroundColor: c.dangerSoft,
    marginLeft: 12,
    borderWidth: 1,
    borderColor: c.dangerBorder,
  },
  logoutBtnPressed: { opacity: 0.7, transform: [{ scale: 0.95 }] },

  categoriesRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 24,
    paddingVertical: 12,
    gap: 8,
    zIndex: 1,
  },
  categoryBtn: {
    flex: 1,
    height: 38,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 19,
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.border,
  },
  categoryBtnActive: { backgroundColor: "#cd9443", borderColor: "#cd9443" },
  categoryText: { fontSize: 13, fontWeight: "600", color: c.textSecondary },
  categoryTextActive: { color: c.onAccent, fontWeight: "700" },

  list: {
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 140,
    alignItems: "center",
    zIndex: 1,
  },

  card: {
    width: "100%",
    maxWidth: 320,
    flexDirection: "row",
    backgroundColor: c.surface,
    borderRadius: 20,
    padding: 18,
    marginBottom: 14,
    alignItems: "center",
    shadowColor: c.shadow,
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 4,
    borderWidth: 1,
    borderColor: c.borderSoft,
  },
  cardNoImage: { paddingRight: 18 },
  cardDisabled: { opacity: 0.8, backgroundColor: c.surfaceAlt },
  image: {
    width: 72,
    height: 72,
    borderRadius: 16,
    backgroundColor: c.surfaceMuted,
    marginRight: 16,
  },
  info: { flex: 1 },
  infoFullWidth: { flex: 1, marginRight: 0 },
  name: { fontSize: 16, fontWeight: "700", color: c.text, marginBottom: 3 },
  textDisabled: { color: c.textMuted },
  desc: { fontSize: 13, color: c.textSecondary, lineHeight: 18, marginBottom: 6 },
  price: { fontSize: 18, fontWeight: "800", color: c.accent, marginBottom: 6 },

  stockBadge: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    gap: 4,
  },
  badgeInStock: { backgroundColor: "#87c397" },
  badgeOutOfStock: { backgroundColor: "#b51212" },
  stockText: { fontSize: 11, fontWeight: "700", color: c.onAccent },

  addButton: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: "#63c184",
    justifyContent: "center",
    alignItems: "center",
    marginLeft: 12,
  },

  emptyContainer: {
    alignItems: "center",
    marginTop: 80,
    padding: 24,
    zIndex: 1,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: c.text,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 15,
    color: c.textSecondary,
    textAlign: "center",
    maxWidth: 260,
    lineHeight: 22,
  },

  toastContainer: {
    position: "absolute",
    bottom: 100,
    left: 24,
    right: 24,
    alignItems: "center",
    zIndex: 100,
  },
  toast: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: c.surface,
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 16,
    shadowColor: c.shadow,
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 8,
    gap: 10,
    borderWidth: 1,
    borderColor: c.border,
  },
  toastText: { fontSize: 14, fontWeight: "600", color: c.text },

  floatingNavWrapper: {
    position: "absolute",
    bottom: 32,
    left: 24,
    right: 24,
    zIndex: 10,
    alignItems: "center",
  },
  floatingNav: {
    flexDirection: "row",
    backgroundColor: c.surface,
    borderRadius: 32,
    padding: 8,
    shadowColor: c.shadow,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 24,
    elevation: 12,
    borderWidth: 1,
    borderColor: c.borderSoft,
  },

  navItemActive: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingVertical: 12,
    borderRadius: 24,
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.surface,
  },

  navItemInactive: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingVertical: 12,
    borderRadius: 24,
  },

  navTextActive: { color: c.accent, fontSize: 12, fontWeight: "800" },
  navTextInactive: { fontSize: 12, fontWeight: "600", color: c.textMuted },
  navTextDark: { color: c.text, fontWeight: "700" },

  cartIconWrapper: {
    position: "relative",
    alignItems: "center",
    justifyContent: "center",
  },
  badge: {
    position: "absolute",
    top: -6,
    right: -8,
    backgroundColor: c.danger,
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 4,
    zIndex: 10,
    borderWidth: 2,
    borderColor: c.surface,
  },
  badgeText: { color: c.onAccent, fontSize: 10, fontWeight: "800" },
});
