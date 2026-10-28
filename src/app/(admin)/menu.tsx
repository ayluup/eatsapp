import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useRouter } from "expo-router";
import { useEffect, useLayoutEffect, useState } from "react";
import { Animated } from "react-native";
import { useAuth } from "../../context/AuthContext";
import { supabase } from "../../services/supabase";

import {
  Alert,
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { ThemeColors } from "../../constants/theme";
import { useThemedStyles } from "../../hooks/use-themed-styles";

export type Menu = {
  id: number;
  nombre: string;
  descripcion: string | null;
  precio: number;
  disponible: boolean;
  imagen_url: string | null;
  categoria: string;
  created_at: string;
};

const formatPrice = (price: number) => "$" + price.toLocaleString("es-AR");
const CATEGORIES = ["Todos", "Comida", "Gaseosas", "Bebidas"];

export default function AdminMenuScreen() {
  const { colors: c, styles } = useThemedStyles(createStyles);
  const [menus, setMenus] = useState<Menu[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState("Todos");

  const router = useRouter();
  const navigation = useNavigation();
  const { signOut, role } = useAuth();

  const categoryScale = useState(
    CATEGORIES.map(() => new Animated.Value(1)),
  )[0];

  useLayoutEffect(() => {
    navigation.setOptions({ headerShown: false });
  }, [navigation]);

  useEffect(() => {
    fetchMenus();
  }, []);

  const fetchMenus = async () => {
    try {
      const { data, error } = await supabase
        .from("menus")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      setMenus(data || []);
    } catch (err: any) {
      console.error("Error cargando menú:", err.message);
      Alert.alert("Error", "No se pudieron cargar los productos");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: number) => {
    Alert.alert("Eliminar Producto", "¿Estás segura?", [
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
          } catch (err) {
            Alert.alert("Error", "No se pudo eliminar");
          }
        },
      },
    ]);
  };

  const animateCategoryPress = (index: number, callback: () => void) => {
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

      <View style={styles.header}>
        <View>
          <Text style={styles.headerSubtitle}>PANEL DE ADMINISTRACIÓN</Text>
          <Text style={styles.title}>Gestión de Menú</Text>
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
        {CATEGORIES.map((cat, index) => (
          <Animated.View
            key={cat}
            style={{
              flex: 1,
              transform: [{ scale: categoryScale[index] }], // Solo escala, sin translateY
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
          </Animated.View>
        ))}
      </View>

      <FlatList
        data={visibleItems}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={styles.list}
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
            >
              {hasImage && (
                <View style={styles.imageContainer}>
                  <Image
                    source={{ uri: item.imagen_url! }}
                    style={styles.productImage}
                  />
                </View>
              )}
              <View style={styles.info}>
                <Text style={styles.name}>{item.nombre}</Text>
                <Text style={styles.desc} numberOfLines={2}>
                  {item.descripcion || "Sin descripción"}
                </Text>
                <Text style={styles.price}>{formatPrice(item.precio)}</Text>
                <View style={styles.badgesRow}>
                  <Text style={styles.catBadge}>{item.categoria}</Text>
                  <View
                    style={[
                      styles.stockBadge,
                      item.disponible ? styles.inStock : styles.outOfStock,
                    ]}
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
                      {item.disponible ? "En Stock" : "Agotado"}
                    </Text>
                  </View>
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
              >
                <Ionicons name="trash-outline" size={22} color={c.textSecondary} />
              </Pressable>
            </Pressable>
          );
        }}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <View style={styles.emptyIconBox}>
              <Ionicons name="fast-food-outline" size={56} color={c.accentStrong} />
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

      <View style={styles.floatingNavWrapper}>
        <View style={styles.floatingNav}>
          <Pressable style={styles.navItemActive}>
            <Ionicons name="restaurant" size={24} color={c.accent} />
            <Text style={styles.navTextActive}>Menú</Text>
          </Pressable>
          <Pressable
            style={styles.navItemInactive}
            onPress={() => router.push("/agregar")}
          >
            <Ionicons name="add-circle" size={24} color={c.textMuted} />
            <Text style={styles.navTextInactive}>Agregar</Text>
          </Pressable>
          <Pressable
            style={styles.navItemInactive}
            onPress={() => router.push("/(admin)/pedidos")}
          >
            <Ionicons name="list" size={24} color={c.textMuted} />
            <Text style={styles.navTextInactive}>Pedidos</Text>
          </Pressable>

          {role === "superadmin" && (
            <Pressable
              style={styles.navItemInactive}
              onPress={() => router.push("/(admin)/usuarios")}
            >
              <Ionicons name="people-outline" size={24} color={c.textMuted} />
              <Text style={styles.navTextInactive}>Usuarios</Text>
            </Pressable>
          )}
          <Pressable
            style={styles.navItemInactive}
            onPress={() => router.push("/(admin)/perfil")}
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
    paddingHorizontal: 24,
    paddingTop: 60,
    paddingBottom: 16,
    zIndex: 1,
  },
  headerSubtitle: {
    fontSize: 12,
    color: c.textSecondary,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 1.2,
    marginBottom: 4,
  },
  title: {
    fontSize: 28,
    fontWeight: "800",
    color: c.text,
    letterSpacing: -0.5,
  },
  logoutBtn: { padding: 10, borderRadius: 12, backgroundColor: c.dangerSoft },
  logoutBtnPressed: { opacity: 0.7, transform: [{ scale: 0.95 }] },

  categoriesRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 24,
    paddingVertical: 16,
    gap: 8,
    zIndex: 1,
  },
  categoryBtn: {
    height: 38,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 19,
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.border,
  },
  categoryBtnActive: {
    backgroundColor: "#289397cb",
    borderColor: "transparent",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
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
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
    borderWidth: 1,
    borderColor: c.borderSoft,
  },
  cardPressed: { transform: [{ scale: 0.98 }], opacity: 0.95 },

  imageContainer: { marginRight: 16 },
  productImage: {
    width: 72,
    height: 72,
    borderRadius: 16,
    backgroundColor: c.surfaceMuted,
  },

  info: { flex: 1, paddingRight: 6 },
  name: { fontSize: 16, fontWeight: "700", color: c.text, marginBottom: 4 },
  desc: { fontSize: 13, color: c.textSecondary, lineHeight: 18, marginBottom: 8 },
  price: { fontSize: 18, fontWeight: "800", color: c.accentStrong, marginBottom: 8 },

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
  stockText: { fontSize: 11, fontWeight: "700" },
  inStockText: { color: c.successStrong },
  outOfStockText: { color: c.dangerStrong },

  deleteBtn: { padding: 8, borderRadius: 10 },
  deleteBtnPressed: { backgroundColor: c.surfaceMuted, transform: [{ scale: 0.9 }] },

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
  },
  navItemInactive: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingVertical: 12,
    borderRadius: 24,
  },
  navTextActive: { fontSize: 12, fontWeight: "700", color: c.accent },
  navTextInactive: { fontSize: 12, fontWeight: "600", color: c.textMuted },
});
