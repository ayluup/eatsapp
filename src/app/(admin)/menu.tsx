import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useNavigation } from "expo-router";
import { useSafeRouter } from "../../hooks/use-safe-router";
import { useCallback, useLayoutEffect, useState } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AssistantButton } from "../../components/assistant-button";
import { AccessibilityToggleButton } from "../../components/accessibility-toggle-button";
import { ThemeToggleButton } from "../../components/theme-toggle-button";
import { useAuth } from "../../context/AuthContext";
import { supabase } from "../../services/supabase";

import {
  Animated,
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { ThemeColors } from "../../constants/theme";
import { useAppTheme } from "../../context/ThemeContext";
import { useThemedStyles } from "../../hooks/use-themed-styles";
import { showAlert } from "../../components/app-alert";

export type Menu = {
  id: number;
  nombre: string;
  descripcion: string | null;
  precio: number;
  disponible: boolean;
  stock: number | null;
  imagen_url: string | null;
  categoria: string;
  created_at: string;
};

const formatPrice = (price: number) => "$" + price.toLocaleString("es-AR");
const CATEGORIES = ["Todos", "Comida", "Gaseosas", "Bebidas"];

// Trae los productos (null si falló)
async function fetchMenusData(): Promise<Menu[] | null> {
  try {
    const { data, error } = await supabase
      .from("menus")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data || [];
  } catch (err: any) {
    console.error("Error cargando menú:", err.message);
    showAlert("Error", "No se pudieron cargar los productos");
    return null;
  }
}

export default function AdminMenuScreen() {
  const { colors: c, styles } = useThemedStyles(createStyles);
  const { reduceMotion, a11y } = useAppTheme();
  const [menus, setMenus] = useState<Menu[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState("Todos");

  const router = useSafeRouter();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { signOut, role } = useAuth();

  const categoryScale = useState(
    CATEGORIES.map(() => new Animated.Value(1)),
  )[0];

  useLayoutEffect(() => {
    navigation.setOptions({ headerShown: false });
  }, [navigation]);

  const applyMenus = (data: Menu[] | null) => {
    if (data) setMenus(data);
    setLoading(false);
  };

  const fetchMenus = () => fetchMenusData().then(applyMenus);

  useFocusEffect(
    useCallback(() => {
      fetchMenusData().then(applyMenus);
    }, []),
  );

  const toggleStock = async (item: Menu) => {
    if (item.stock === 0) {
      showAlert(
        "Sin unidades",
        `Editá "${item.nombre}" y cargá cuántas unidades hay para volver a ponerlo en stock.`,
      );
      return;
    }
    const disponible = !item.disponible;
    setMenus((prev) =>
      prev.map((m) => (m.id === item.id ? { ...m, disponible } : m)),
    );
    const { error } = await supabase
      .from("menus")
      .update({ disponible })
      .eq("id", item.id);
    if (error) {
      setMenus((prev) =>
        prev.map((m) =>
          m.id === item.id ? { ...m, disponible: !disponible } : m,
        ),
      );
      showAlert("Error", "No se pudo cambiar el stock");
    }
  };

  const handleDelete = async (id: number) => {
    showAlert("Eliminar Producto", "¿Estás segura?", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Eliminar",
        style: "destructive",
        onPress: async () => {
          try {
            const { error } = await supabase
              .from("menus")
              .delete()
              .eq("id", id);
            if (error) throw error;
            setMenus((prev) => prev.filter((m) => m.id !== id));
          } catch {
            showAlert("Error", "No se pudo eliminar");
          }
        },
      },
    ]);
  };

  const animateCategoryPress = (index: number, callback: () => void) => {
    if (reduceMotion) return callback();
    Animated.sequence([
      Animated.timing(categoryScale[index], {
        toValue: 0.96,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.timing(categoryScale[index], {
        toValue: 1,
        duration: 100,
        useNativeDriver: true,
      }),
    ]).start(callback);
  };

  const visibleItems =
    selectedCategory === "Todos"
      ? menus
      : menus.filter((item) => item.categoria === selectedCategory);

  return (
    <View style={styles.container}>
      <View style={styles.bgTop} />
      <View style={styles.bgBottom} />

      <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
        <View style={styles.headerText}>
          <Text style={styles.headerSubtitle} numberOfLines={1}>
            ADMINISTRACIÓN
          </Text>
          <Text
            style={styles.title}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.7}
          >
            Gestión de Menú
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
        <AssistantButton href="/(admin)/asistente" />
      </View>

      <View style={styles.categoriesRow} accessibilityRole="tablist">
        {CATEGORIES.map((cat, index) => (
          <Animated.View
            key={cat}
            style={{
              flex: 1,
              transform: [{ scale: categoryScale[index] }],
            }}
          >
            <Pressable
              style={[
                styles.categoryBtn,
                selectedCategory === cat && styles.categoryBtnActive,
              ]}
              onPress={() =>
                animateCategoryPress(index, () => setSelectedCategory(cat))
              }
              accessibilityRole="tab"
              accessibilityLabel={`Categoría ${cat}`}
              accessibilityState={{ selected: selectedCategory === cat }}
            >
              <Text
                style={[
                  styles.categoryText,
                  selectedCategory === cat && styles.categoryTextActive,
                ]}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.8}
              >
                {cat}
              </Text>
            </Pressable>
          </Animated.View>
        ))}
      </View>

      <FlatList
        data={visibleItems}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={[
          styles.list,
          { paddingBottom: insets.bottom + 130 },
        ]}
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) => {
          const hasImage = !!item.imagen_url;
          return (
            <Pressable
              style={({ pressed }) => [
                styles.card,
                pressed && styles.cardPressed,
              ]}
              onPress={() => router.push(`/editar?id=${item.id}`)}
              accessibilityRole="button"
              accessibilityLabel={`${item.nombre}, ${formatPrice(item.precio)}`}
              accessibilityHint="Abre la edición del producto"
            >
              {hasImage && (
                <View style={styles.imageContainer}>
                  <Image
                    source={{ uri: item.imagen_url! }}
                    style={styles.productImage}
                    accessible
                    accessibilityLabel={`Foto de ${item.nombre}`}
                  />
                </View>
              )}
              <View style={styles.info}>
                <Text style={styles.name} numberOfLines={2}>
                  {item.nombre}
                </Text>
                <Text style={styles.desc} numberOfLines={2}>
                  {item.descripcion || "Sin descripción"}
                </Text>
                <Text style={styles.price}>{formatPrice(item.precio)}</Text>
                <View style={styles.badgesRow}>
                  <Text style={styles.catBadge}>{item.categoria}</Text>
                  <Pressable
                    style={({ pressed }) => [
                      styles.stockBadge,
                      item.disponible ? styles.inStock : styles.outOfStock,
                      pressed && styles.stockPressed,
                    ]}
                    onPress={(e) => {
                      e.stopPropagation();
                      toggleStock(item);
                    }}
                    hitSlop={8}
                    accessibilityLabel={
                      item.disponible
                        ? "Marcar como agotado"
                        : "Marcar en stock"
                    }
                  >
                    <Ionicons
                      name={
                        item.disponible ? "checkmark-circle" : "close-circle"
                      }
                      size={12}
                      color={item.disponible ? c.successStrong : c.dangerStrong}
                    />
                    <Text
                      style={[
                        styles.stockText,
                        item.disponible
                          ? styles.inStockText
                          : styles.outOfStockText,
                      ]}
                    >
                      {item.disponible
                        ? item.stock == null
                          ? "En Stock"
                          : `${item.stock} u.`
                        : "Agotado"}
                    </Text>
                    <Ionicons
                      name="swap-horizontal"
                      size={12}
                      color={item.disponible ? c.successStrong : c.dangerStrong}
                    />
                  </Pressable>
                </View>
              </View>
              <Pressable
                style={({ pressed }) => [
                  styles.deleteBtn,
                  pressed && styles.deleteBtnPressed,
                ]}
                onPress={(e) => {
                  e.stopPropagation();
                  handleDelete(item.id);
                }}
                accessibilityRole="button"
                accessibilityLabel={`Eliminar ${item.nombre}`}
              >
                <Ionicons
                  name="trash-outline"
                  size={22}
                  color={c.textSecondary}
                />
              </Pressable>
            </Pressable>
          );
        }}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <View style={styles.emptyIconBox}>
              <Ionicons
                name="fast-food-outline"
                size={56}
                color={c.accentStrong}
              />
            </View>
            <Text style={styles.emptyTitle}>
              {selectedCategory === "Todos"
                ? "Tu menú está vacío"
                : `No hay productos en ${selectedCategory}`}
            </Text>
            <Text style={styles.emptyText}>
              {selectedCategory === "Todos"
                ? 'Tocá "Agregar" en la barra inferior para crear tu primer producto'
                : "Probá cambiando de categoría o agregando nuevos productos"}
            </Text>
          </View>
        }
        refreshing={loading}
        onRefresh={fetchMenus}
      />

      <View style={[styles.floatingNavWrapper, { bottom: insets.bottom + 16 }]}>
        <View style={styles.floatingNav}>
          <Pressable style={styles.navItemActive}>
            <Ionicons name="restaurant" size={24} color={c.accent} />
            <Text style={styles.navTextActive} numberOfLines={1}>
              Menú
            </Text>
          </Pressable>
          <Pressable
            style={styles.navItemInactive}
            onPress={() => router.push("/agregar")}
          >
            <Ionicons name="add-circle" size={24} color={c.textMuted} />
            <Text style={styles.navTextInactive} numberOfLines={1}>
              Agregar
            </Text>
          </Pressable>
          <Pressable
            style={styles.navItemInactive}
            onPress={() => router.push("/(admin)/pedidos")}
          >
            <Ionicons name="list" size={24} color={c.textMuted} />
            <Text style={styles.navTextInactive} numberOfLines={1}>
              Pedidos
            </Text>
          </Pressable>

          {role === "superadmin" && (
            <Pressable
              style={styles.navItemInactive}
              onPress={() => router.push("/(admin)/usuarios")}
            >
              <Ionicons name="people-outline" size={24} color={c.textMuted} />
              <Text style={styles.navTextInactive} numberOfLines={1}>
                Usuarios
              </Text>
            </Pressable>
          )}
          <Pressable
            style={styles.navItemInactive}
            onPress={() => router.push("/(admin)/perfil")}
          >
            <Ionicons
              name="person-circle-outline"
              size={24}
              color={c.textMuted}
            />
            <Text style={styles.navTextInactive} numberOfLines={1}>
              Perfil
            </Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const createStyles = (c: ThemeColors) =>
  StyleSheet.create({
    container: { flex: 1 },
    bgTop: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      bottom: "30%",
      backgroundColor: c.decorAdmin,
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

    loadingContainer: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      backgroundColor: c.surfaceAlt,
    },
    loadingOverlay: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      bottom: "48%",
      backgroundColor: c.border,
      borderBottomRightRadius: 80,
      borderBottomLeftRadius: 20,
      zIndex: 0,
    },
    loadingText: {
      marginTop: 16,
      fontSize: 15,
      fontWeight: "600",
      color: c.textSecondary,
      letterSpacing: 0.3,
      zIndex: 1,
    },

    header: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      gap: 12,
      paddingHorizontal: 20,
      paddingBottom: 12,
      zIndex: 1,
    },

    headerText: { flex: 1, minWidth: 0 },
    headerSubtitle: {
      fontSize: 12,
      color: c.textSecondary,
      fontWeight: "700",
      textTransform: "uppercase",
      letterSpacing: 1.2,
      marginBottom: 4,
    },
    title: {
      fontSize: 26,
      fontWeight: "800",
      color: c.text,
      letterSpacing: -0.5,
    },
    logoutBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      padding: 10,
      borderRadius: 12,
      backgroundColor: c.dangerSoft,
    },
    headerActions: { flexDirection: "row", gap: 8, flexShrink: 0 },
    logoutText: { fontSize: 13, fontWeight: "700", color: c.danger },
    toolsRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 10,
      paddingHorizontal: 20,
      paddingBottom: 12,
      zIndex: 1,
    },
    logoutBtnPressed: { opacity: 0.7, transform: [{ scale: 0.95 }] },

    categoriesRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      paddingHorizontal: 20,
      paddingVertical: 12,
      gap: 6,
      zIndex: 1,
    },
    categoryBtn: {
      height: 38,
      paddingHorizontal: 6,
      justifyContent: "center",
      alignItems: "center",
      borderRadius: 19,
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: c.border,
    },
    categoryBtnActive: {
      backgroundColor: c.categoryActiveAdmin,
      borderColor: "transparent",
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 8,
      elevation: 4,
    },
    categoryText: { fontSize: 13, fontWeight: "600", color: c.textSecondary },
    categoryTextActive: { color: c.onAccent, fontWeight: "700" },

    list: {
      paddingHorizontal: 20,
      paddingTop: 4,
      alignItems: "center",
      zIndex: 1,
    },
    card: {
      width: "100%",
      maxWidth: 320,
      flexDirection: "row",
      backgroundColor: c.surface,
      borderRadius: 20,
      padding: 14,
      marginBottom: 14,
      alignItems: "center",
      shadowColor: c.shadow,
      shadowOpacity: 0.08,
      shadowRadius: 12,
      elevation: 4,
      borderWidth: 1,
      borderColor: c.borderSoft,
    },
    cardPressed: { transform: [{ scale: 0.98 }], opacity: 0.95 },

    imageContainer: { marginRight: 12 },
    productImage: {
      width: 64,
      height: 64,
      borderRadius: 16,
      backgroundColor: c.surfaceMuted,
    },

    info: { flex: 1, minWidth: 0, paddingRight: 6 },
    name: { fontSize: 16, fontWeight: "700", color: c.text, marginBottom: 4 },
    desc: {
      fontSize: 13,
      color: c.textSecondary,
      lineHeight: 18,
      marginBottom: 8,
    },
    price: {
      fontSize: 18,
      fontWeight: "800",
      color: c.accentStrong,
      marginBottom: 8,
    },

    badgesRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      flexWrap: "wrap",
    },
    catBadge: {
      fontSize: 11,
      fontWeight: "600",
      color: c.textBody,
      backgroundColor: c.surfaceMuted,
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 6,
    },
    stockBadge: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 6,
    },
    inStock: { backgroundColor: c.successSoft },
    outOfStock: { backgroundColor: c.dangerSoft },
    stockPressed: { opacity: 0.6 },
    stockText: { fontSize: 11, fontWeight: "700" },
    inStockText: { color: c.successStrong },
    outOfStockText: { color: c.dangerStrong },

    deleteBtn: { padding: 8, borderRadius: 10 },
    deleteBtnPressed: {
      backgroundColor: c.surfaceMuted,
      transform: [{ scale: 0.9 }],
    },

    emptyContainer: {
      alignItems: "center",
      marginTop: 80,
      padding: 24,
      zIndex: 1,
    },
    emptyIconBox: {
      width: 88,
      height: 88,
      borderRadius: 44,
      backgroundColor: c.infoSoft,
      justifyContent: "center",
      alignItems: "center",
      marginBottom: 20,
    },
    emptyTitle: {
      fontSize: 20,
      fontWeight: "800",
      color: c.text,
      marginBottom: 8,
      textAlign: "center",
    },
    emptyText: {
      fontSize: 15,
      color: c.textSecondary,
      textAlign: "center",
      maxWidth: 260,
      lineHeight: 22,
    },

    floatingNavWrapper: {
      position: "absolute",
      left: 16,
      right: 16,
      zIndex: 10,
      alignItems: "center",
    },
    // Ocupa todo el ancho disponible (hasta 480) para que entren los 5 botones
    floatingNav: {
      width: "100%",
      maxWidth: 480,
      flexDirection: "row",
      backgroundColor: c.surface,
      borderRadius: 32,
      padding: 6,
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
      minWidth: 0,
      alignItems: "center",
      justifyContent: "center",
      gap: 4,
      paddingVertical: 10,
      borderRadius: 24,
    },
    navItemInactive: {
      flex: 1,
      minWidth: 0,
      alignItems: "center",
      justifyContent: "center",
      gap: 4,
      paddingVertical: 10,
      borderRadius: 24,
    },
    navTextActive: { fontSize: 11, fontWeight: "700", color: c.accent },
    navTextInactive: { fontSize: 11, fontWeight: "600", color: c.textMuted },
  });
