import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router";
import { useSafeRouter } from "../../hooks/use-safe-router";
import { useCallback, useState } from "react";
import { AssistantButton } from "../../components/assistant-button";
import { AccessibilityToggleButton } from "../../components/accessibility-toggle-button";
import { ThemeToggleButton } from "../../components/theme-toggle-button";
import { useAuth } from "../../context/AuthContext";
import { useCart } from "../../hooks/useCart";
import { showAlert } from "../../components/app-alert";
import { useAppTheme } from "../../context/ThemeContext";
import { announce } from "../../utils/announce";
import { supabase } from "../../services/supabase";

import {
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
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
  stock: number | null;
  imagen_url: string | null;
  categoria: string;
};

const formatPrice = (p: number) => "$" + p.toLocaleString("es-AR");
const CATEGORIES = ["Todos", "Comida", "Gaseosas", "Bebidas"];

// Para buscar sin importar mayúsculas ni tildes ("cafe" encuentra "Café")
const normalize = (t: string) =>
  t.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

// Trae los productos (null si falló)
async function fetchMenuData(): Promise<MenuItem[] | null> {
  try {
    const { data, error } = await supabase
      .from("menus")
      .select("*")
      .order("nombre", { ascending: true });
    if (error) throw error;
    return (data || []).map((item) => ({
      ...item,
      categoria: item.categoria || "Comida",
    }));
  } catch (err: any) {
    console.error("Error cargando menú:", err.message);
    return null;
  }
}

export default function StudentMenuScreen() {
  const { colors: c, styles } = useThemedStyles(createStyles);
  const { a11y } = useAppTheme();
  const [menu, setMenu] = useState<MenuItem[]>([]);
  const [selectedCategory, setSelectedCategory] = useState("Todos");
  const [search, setSearch] = useState("");

  const { addToCart, count: cartCount } = useCart();
  const { signOut } = useAuth();
  const [showToast, setShowToast] = useState(false);
  const [lastAddedItem, setLastAddedItem] = useState("");
  const router = useSafeRouter();
  const [refreshing, setRefreshing] = useState(false);

  // Deslizar hacia abajo para recargar
  const onRefresh = async () => {
    setRefreshing(true);
    const data = await fetchMenuData();
    if (data) setMenu(data);
    setRefreshing(false);
  };

  // Al volver a la pantalla se recarga (ej. cambió el stock)
  useFocusEffect(
    useCallback(() => {
      fetchMenuData().then((data) => {
        if (data) setMenu(data);
      });
    }, []),
  );

  const handleAddToCart = (item: MenuItem) => {
    if (!item.disponible) return;
    const added = addToCart({
      id: item.id,
      nombre: item.nombre,
      precio: item.precio,
      imagen_url: item.imagen_url,
      stock: item.stock,
    });
    if (!added) {
      showAlert(
        "No hay más unidades",
        `Ya tenés en el carrito todas las unidades de ${item.nombre} que quedan.`,
      );
      return;
    }
    setLastAddedItem(item.nombre);
    setShowToast(true);
    announce(`${item.nombre} agregado al carrito`);
    // En modo accesible el aviso queda más tiempo para poder leerlo
    setTimeout(() => setShowToast(false), a11y.longerMessages ? 4000 : 1500);
  };

  const query = normalize(search.trim());
  const filteredMenu = menu.filter(
    (item) =>
      (selectedCategory === "Todos" || item.categoria === selectedCategory) &&
      (!query ||
        normalize(item.nombre).includes(query) ||
        normalize(item.descripcion ?? "").includes(query)),
  );

  return (
    <View style={styles.container}>
      <View style={styles.bgTop} />
      <View style={styles.bgBottom} />

      {/* ✅ HEADER CON LOGOUT POSICIONADO CORRECTAMENTE */}
      <View style={styles.header}>
        <View style={styles.headerTextContainer}>
          <Text style={styles.title} accessibilityRole="header">Menú del Kiosco</Text>
          <Text style={styles.subtitle}>
            Seleccioná lo que quieras pedir hoy
          </Text>
        </View>

        <View style={styles.headerActions}>
          <Pressable
            style={({ pressed }) => [
              styles.logoutBtn,
              pressed && styles.logoutBtnPressed,
            ]}
            onPress={async () => {
              await signOut();
            }}
            accessibilityRole="button"
            accessibilityLabel="Cerrar sesión"
          >
            <Ionicons name="log-out-outline" size={22} color={c.danger} />
            {a11y.showLabels && <Text style={styles.logoutText}>Salir</Text>}
          </Pressable>
        </View>
      </View>

      {/* Asistente, tema y accesibilidad debajo del título */}
      <View style={styles.toolsRow}>
        <AccessibilityToggleButton />
        <ThemeToggleButton />
        <AssistantButton href="/(student)/asistente" />
      </View>

      <View style={styles.searchBox}>
        <Ionicons name="search" size={18} color={c.textMuted} />
        <TextInput
          style={styles.searchInput}
          value={search}
          onChangeText={setSearch}
          placeholder="Buscar en el menú…"
          placeholderTextColor={c.textMuted}
          returnKeyType="search"
          autoCorrect={false}
        />
        {search.length > 0 && (
          <Pressable
            onPress={() => setSearch("")}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel="Borrar búsqueda"
          >
            <Ionicons name="close-circle" size={18} color={c.textMuted} />
          </Pressable>
        )}
      </View>

      <View style={styles.categoriesRow} accessibilityRole="tablist">
        {CATEGORIES.map((cat) => (
          <Pressable
            key={cat}
            style={[
              styles.categoryBtn,
              selectedCategory === cat && styles.categoryBtnActive,
            ]}
            onPress={() => setSelectedCategory(cat)}
            accessibilityRole="tab"
            accessibilityLabel={`Categoría ${cat}`}
            accessibilityState={{ selected: selectedCategory === cat }}
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
        refreshing={refreshing}
        onRefresh={onRefresh}
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
              accessibilityRole="button"
              accessibilityLabel={`${item.nombre}, ${formatPrice(item.precio)}, ${
                !item.disponible
                  ? "agotado"
                  : item.stock != null && item.stock <= 5
                    ? `quedan ${item.stock}`
                    : "disponible"
              }`}
              accessibilityHint={isDisabled ? undefined : "Agrega el producto al carrito"}
              accessibilityState={{ disabled: isDisabled }}
            >
              {hasImage && (
                <Image
                  source={{ uri: item.imagen_url! }}
                  style={styles.image}
                  accessible
                  accessibilityLabel={`Foto de ${item.nombre}`}
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
                    {!item.disponible
                      ? "Agotado"
                      : item.stock != null && item.stock <= 5
                        ? `Quedan ${item.stock}`
                        : "Disponible"}
                  </Text>
                </View>
              </View>

              {!isDisabled && (
                <Pressable
                  style={styles.addButton}
                  onPress={() => handleAddToCart(item)}
                  accessibilityRole="button"
                  accessibilityLabel={`Agregar ${item.nombre} al carrito`}
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
              {query
                ? `No encontramos "${search.trim()}"`
                : selectedCategory === "Todos"
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
            <Text style={styles.toastText}>&quot;{lastAddedItem}&quot; agregado</Text>
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
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    padding: 10,
    borderRadius: 12,
    backgroundColor: c.dangerSoft,
    borderWidth: 1,
    borderColor: c.dangerBorder,
  },
  headerActions: { flexDirection: "row", gap: 10, marginLeft: 12 },
  logoutText: { fontSize: 13, fontWeight: "700", color: c.danger },
  toolsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    paddingHorizontal: 24,
    paddingBottom: 12,
    zIndex: 1,
  },
  logoutBtnPressed: { opacity: 0.7, transform: [{ scale: 0.95 }] },

  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginHorizontal: 24,
    marginTop: 4,
    paddingHorizontal: 14,
    height: 46,
    borderRadius: 16,
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.border,
    zIndex: 1,
  },
  searchInput: { flex: 1, fontSize: 15, color: c.text, paddingVertical: 0 },

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
  categoryBtnActive: {
    backgroundColor: c.categoryActiveStudent,
    borderColor: c.categoryActiveStudent,
  },
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
  badgeInStock: { backgroundColor: c.stockIn },
  badgeOutOfStock: { backgroundColor: c.stockOut },
  stockText: { fontSize: 11, fontWeight: "700", color: c.onAccent },

  addButton: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: c.addProduct,
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
